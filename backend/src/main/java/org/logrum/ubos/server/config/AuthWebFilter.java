package org.logrum.ubos.server.config;

import com.fasterxml.jackson.databind.ObjectMapper; 
import org.logrum.ubos.common.AuthContext;
import org.logrum.ubos.common.UbosConstants;
import org.logrum.ubos.kernel.service.LcmKernelService;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.Map;

@Component
public class AuthWebFilter implements WebFilter
{

    public static final Class<AuthContext> CONTEXT_KEY = UbosConstants.AUTH_CONTEXT_KEY;

    
    private final LcmKernelService kernelService;
    private final ObjectMapper objectMapper;

    public AuthWebFilter(LcmKernelService kernelService, ObjectMapper objectMapper) {
        this.kernelService = kernelService;
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        
        AuthContext defaultContext = AuthContext.builder().userId("A001").username("Architect").role("ADMIN").tenantId("MASTER").build();

        
        String userId = defaultContext.getUserId(); 

        
        
        Mono<String> policyBranchMono = kernelService.getResourceSnapshot(
                "CONFIG",
                "policy.user." + userId,
                "master"
            )
            .onErrorResume(e -> Mono.empty()); 

        
        Mono<AuthContext> finalContextMono = policyBranchMono
            .flatMap(json -> {
                
                try {
                    Map<String, String> policy = objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {});
                    String policyBranch = policy.getOrDefault("policyBranch", "master");

                    
                    return Mono.just(AuthContext.builder()
                        .userId(userId)
                        .username(defaultContext.getUsername())
                        .role(defaultContext.getRole())
                        .tenantId(policyBranch) 
                        .build());

                } catch (Exception e) {
                    
                    return Mono.just(defaultContext);
                }
            })
            .defaultIfEmpty(defaultContext); 

        
        return finalContextMono.flatMap(finalContext -> {
            return chain.filter(exchange)
                .contextWrite(ctx -> ctx.put(CONTEXT_KEY, finalContext));
        });
    }
}