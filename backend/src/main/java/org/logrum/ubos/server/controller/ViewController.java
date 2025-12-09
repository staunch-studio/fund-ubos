package org.logrum.ubos.server.controller;

import com.fasterxml.jackson.databind.ObjectMapper; 
import org.logrum.ubos.common.AuthContext;
import org.logrum.ubos.common.UbosConstants;
import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/view")
@RequiredArgsConstructor
public class ViewController {

    private final LcmKernelService kernelService;
    private final ObjectMapper objectMapper;

    @GetMapping("/{slug}")
    public Mono<Map<String, Object>> getViewDefinition(
        @PathVariable String slug,
        ServerWebExchange exchange) {

        
        return Mono.deferContextual(contextView -> {
            AuthContext authContext = contextView.get(UbosConstants.AUTH_CONTEXT_KEY);
            
            final String targetBranch = authContext.getRole().equals("ADMIN") ? "dev" : authContext.getTenantId().toLowerCase();

            
            
            exchange.getResponse().getHeaders().add("X-UBOS-BRANCH", targetBranch);

            
            return kernelService.getResourceSnapshot("VIEW", slug, targetBranch)
                .map(jsonString -> {
                    try {
                        return (Map<String, Object>) objectMapper.readValue(jsonString, Map.class);
                    } catch (Exception e) {
                        throw new RuntimeException("View JSON parsing failed: " + e.getMessage(), e);
                    }
                })
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "View definition not found for slug: " + slug)));
        });
    }
}