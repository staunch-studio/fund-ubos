package org.logrum.ubos.engine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.logrum.ubos.engine.executor.LcmLogicExecutor;
import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.util.Map;

@Slf4j
@Service
public class LcmEventService {

    private final LcmKernelService kernelService;
    private final LcmLogicExecutor logicExecutor;
    private final ObjectMapper objectMapper;

    
    public LcmEventService(LcmKernelService kernelService,
        @Lazy LcmLogicExecutor logicExecutor,
        ObjectMapper objectMapper) {
        this.kernelService = kernelService;
        this.logicExecutor = logicExecutor;
        this.objectMapper = objectMapper;
    }

    public void publish(String eventName, Map<String, Object> payload) {
        log.info(" [Nervous System] Event Fired: [{}]", eventName);

        
        
        Flux<Map<String, Object>> listeners = kernelService.search(
            "LISTENER",
            "master", 
            Map.of("trigger", eventName)
        );

        
        listeners.publishOn(Schedulers.boundedElastic()) 
            .flatMap(listenerSnapshot -> {
                try {
                    
                    String snapshotJson = objectMapper.writeValueAsString(listenerSnapshot);

                    log.info("⚡ [Synapse] Triggering listener...");
                    
                    return logicExecutor.execute(snapshotJson, payload)
                        .onErrorResume(e -> {
                            log.error("Listener execution failed", e);
                            return reactor.core.publisher.Mono.empty(); 
                        });
                } catch (Exception e) {
                    return reactor.core.publisher.Mono.error(e);
                }
            })
            .subscribe(); 
    }
}