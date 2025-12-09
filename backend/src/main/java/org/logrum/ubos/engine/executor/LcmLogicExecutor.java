package org.logrum.ubos.engine.executor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.logrum.ubos.common.AuthContext;
import org.logrum.ubos.common.UbosConstants;
import org.logrum.ubos.engine.service.LcmEventService;
import org.logrum.ubos.kernel.service.LcmKernelService;
import org.logrum.ubos.kernel.service.LcmRelationService;
import groovy.lang.Binding;
import groovy.lang.GroovyShell;
import groovy.lang.Script;
import lombok.extern.slf4j.Slf4j;
import org.codehaus.groovy.control.CompilerConfiguration;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.concurrent.*;

@Slf4j
@Service
public class LcmLogicExecutor {

    private final ObjectMapper objectMapper;
    private final CompilerConfiguration compilerConfig;
    private final LcmKernelService kernelService;
    private final LcmEventService eventService;

    private final ExecutorService sandboxPool = Executors.newCachedThreadPool();
    private final Map<String, Class<?>> scriptCache = new ConcurrentHashMap<>();

    private static final long MAX_EXECUTION_TIME_MS = 3000;

    private final LcmRelationService relationService;

    
    public LcmLogicExecutor(ObjectMapper objectMapper, CompilerConfiguration compilerConfig,
        LcmKernelService kernelService, @Lazy LcmEventService eventService, LcmRelationService relationService) {
        this.objectMapper = objectMapper;
        this.compilerConfig = compilerConfig;
        this.kernelService = kernelService;
        this.eventService = eventService;
        this.relationService = relationService;
    }

    public Mono<Object> execute(String snapshotJson, Map<String, Object> contextParams) {

        
        return Mono.deferContextual(contextView -> {

            
            AuthContext authContext = contextView.getOrDefault(UbosConstants.AUTH_CONTEXT_KEY,
                AuthContext.builder().userId("SYSTEM").username("SYSTEM_USER").role("SYSTEM").tenantId("MASTER").build());

            
            
            contextParams.put("currentUser", authContext);

            
            return Mono.create(sink -> {
                try {
                    
                    JsonNode root = objectMapper.readTree(snapshotJson);
                    String scriptContent = root.path("content").asText();
                    if (scriptContent == null || scriptContent.isBlank()) {
                        sink.error(new IllegalArgumentException("Logic content is empty"));
                        return;
                    }

                    String cacheKey = String.valueOf(scriptContent.hashCode());
                    Class<?> scriptClass = scriptCache.computeIfAbsent(cacheKey, k -> {
                        GroovyShell shell = new GroovyShell(compilerConfig);
                        return shell.getClassLoader().parseClass(scriptContent);
                    });

                    
                    Binding binding = new Binding();
                    binding.setVariable("ctx", contextParams);
                    binding.setVariable("log", log);
                    binding.setVariable("kernel", kernelService);
                    binding.setVariable("jsonUtils", objectMapper);
                    binding.setVariable("dispatcher", eventService);
                    binding.setVariable("relations", relationService);

                    Script script = (Script) scriptClass.getDeclaredConstructor().newInstance();
                    script.setBinding(binding);

                    
                    Future<Object> future = sandboxPool.submit(() -> {
                        return script.run();
                    });

                    
                    CompletableFuture.runAsync(() -> {
                        try {
                            
                            Object result = future.get(MAX_EXECUTION_TIME_MS, TimeUnit.MILLISECONDS);
                            sink.success(result);
                        } catch (TimeoutException e) {
                            log.error("⚔️ [Immune System] Logic timeout! Sending INTERRUPT signal...");
                            future.cancel(true); 
                            sink.error(new RuntimeException("Security Alert: Logic killed by Immune System (Timeout)."));
                        } catch (Exception e) {
                            
                            Throwable cause = e;
                            while ((cause instanceof ExecutionException || cause instanceof CompletionException) && cause.getCause() != null) {
                                cause = cause.getCause();
                            }
                            sink.error(cause);
                        }
                    });

                } catch (Exception e) {
                    sink.error(e);
                }
            });
        });
    }

    public void invalidateCache() {
        scriptCache.clear();
        log.info("Script cache cleared.");
    }
}