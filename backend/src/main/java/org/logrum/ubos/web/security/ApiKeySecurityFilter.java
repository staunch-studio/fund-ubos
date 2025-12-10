package org.logrum.ubos.web.security;

import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.service.ApiKeyService;
import org.logrum.ubos.web.console.dto.ApiKeyEntityPayload;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * WebFilter for API key authentication using Version Chain storage.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiKeySecurityFilter implements WebFilter {

    private static final String API_KEY_HEADER = "X-API-KEY";
    private static final String API_KEY_ATTRIBUTE = "API_KEY_PRINCIPAL";

    private final ApiKeyService apiKeyService;

    public ApiKeySecurityFilter(ApiKeyService apiKeyService) {
        this.apiKeyService = apiKeyService;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        // Skip API key check for public endpoints
        if (isPublicEndpoint(path)) {
            return chain.filter(exchange);
        }

        // Check for API key header
        String apiKey = request.getHeaders().getFirst(API_KEY_HEADER);

        if (apiKey == null || apiKey.isBlank()) {
            // No API key - let other filters handle auth
            return chain.filter(exchange);
        }

        // Validate API key against Version Chain
        return apiKeyService.validateKey(apiKey)
            .flatMap(validPayload -> {
                // Check scope
                String requiredScope = getRequiredScope(path, request.getMethod().name());
                if (!validPayload.hasScope(requiredScope)) {
                    log.warn("🔒 API key '{}' lacks scope '{}' for {} {}",
                            validPayload.keyName(), requiredScope, request.getMethod(), path);
                    return unauthorized(exchange, "Insufficient permissions");
                }

                // Store validated key
                exchange.getAttributes().put(API_KEY_ATTRIBUTE, validPayload);
                log.debug("✅ API key '{}' authenticated for {} {}",
                         validPayload.keyName(), request.getMethod(), path);

                return chain.filter(exchange);
            })
            .switchIfEmpty(Mono.defer(() -> {
                log.warn("🔒 Invalid API key for {} {}", request.getMethod(), path);
                return unauthorized(exchange, "Invalid or expired API key");
            }));
    }

    private boolean isPublicEndpoint(String path) {
        return path.startsWith("/actuator/health") ||
               path.equals("/api/health") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs");
    }

    private String getRequiredScope(String path, String method) {
        if (path.startsWith("/api/external/")) {
            return "EXTERNAL_COMMIT";
        }
        if ("POST".equals(method) || "PUT".equals(method) ||
            "DELETE".equals(method) || "PATCH".equals(method)) {
            return "FULL_ACCESS";
        }
        return "READ_ONLY";
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().add("Content-Type", "application/json");
        String body = String.format("{\"error\":\"Unauthorized\",\"message\":\"%s\"}", message);
        return exchange.getResponse()
            .writeWith(Mono.just(exchange.getResponse()
                .bufferFactory().wrap(body.getBytes())));
    }

    /**
     * Get the authenticated API key from the exchange.
     */
    public static ApiKeyEntityPayload getApiKey(ServerWebExchange exchange) {
        return exchange.getAttribute(API_KEY_ATTRIBUTE);
    }
}
