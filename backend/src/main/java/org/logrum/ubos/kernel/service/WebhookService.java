package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.web.console.dto.WebhookEntityPayload;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import reactor.util.retry.Retry;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;

/**
 * Service for managing webhooks stored in the Version Chain.
 * 
 * <p>Webhooks are stored as entities with:
 * <ul>
 *   <li>Entity Type: 'WEBHOOK'</li>
 *   <li>Slug: hookName</li>
 * </ul>
 */
@Slf4j
@Service
public class WebhookService {

    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    // Lazy reference to LcmKernelService
    private LcmKernelService kernelService;

    public WebhookService(ObjectMapper objectMapper, WebClient.Builder webClientBuilder) {
        this.objectMapper = objectMapper;
        this.webClientBuilder = webClientBuilder;
    }

    /**
     * Set the kernel service (called during initialization).
     */
    public void setKernelService(LcmKernelService kernelService) {
        this.kernelService = kernelService;
        log.info("🔔 Webhook service initialized with kernel service");
    }

    /**
     * Save (create or update) a webhook configuration.
     */
    public Mono<Long> saveWebhook(WebhookEntityPayload payload, String author) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        log.info("💾 Saving webhook: {}", payload.hookName());

        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);

            return kernelService.commit(
                WebhookEntityPayload.ENTITY_TYPE,
                payload.hookName(),
                "master",
                jsonPayload,
                author,
                "Webhook configuration: " + payload.hookName()
            );
        } catch (JsonProcessingException e) {
            return Mono.error(new RuntimeException("Failed to serialize webhook payload", e));
        }
    }

    /**
     * Create a new webhook.
     */
    public Mono<Long> createWebhook(String hookName, String triggerEvent, String targetUrl,
                                     String entityType, String secretToken, String description,
                                     String createdBy) {
        WebhookEntityPayload payload = WebhookEntityPayload.create(
            hookName, triggerEvent, targetUrl, entityType, secretToken, description, createdBy
        );
        return saveWebhook(payload, createdBy);
    }

    /**
     * Deactivate a webhook.
     */
    public Mono<Long> deactivateWebhook(String hookName, String deactivatedBy) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        log.info("🔕 Deactivating webhook: {}", hookName);

        return kernelService.getResourceSnapshot(WebhookEntityPayload.ENTITY_TYPE, hookName, "master")
            .flatMap(json -> {
                try {
                    WebhookEntityPayload current = objectMapper.readValue(json, WebhookEntityPayload.class);
                    WebhookEntityPayload deactivated = current.deactivate();
                    String newJson = objectMapper.writeValueAsString(deactivated);

                    return kernelService.commit(
                        WebhookEntityPayload.ENTITY_TYPE,
                        hookName,
                        "master",
                        newJson,
                        deactivatedBy,
                        "Deactivated webhook: " + hookName
                    );
                } catch (JsonProcessingException e) {
                    return Mono.error(new RuntimeException("Failed to process webhook", e));
                }
            })
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Webhook not found: " + hookName)));
    }

    /**
     * Get all webhooks.
     */
    public Flux<WebhookEntityPayload> findAll() {
        if (kernelService == null) {
            return Flux.error(new IllegalStateException("Kernel service not initialized"));
        }

        return kernelService.search(WebhookEntityPayload.ENTITY_TYPE, "master", Map.of())
            .map(this::mapToPayload)
            .filter(payload -> payload != null);
    }

    /**
     * Get a specific webhook by name.
     */
    public Mono<WebhookEntityPayload> findByName(String hookName) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        return kernelService.getResourceSnapshot(WebhookEntityPayload.ENTITY_TYPE, hookName, "master")
            .flatMap(json -> {
                try {
                    return Mono.just(objectMapper.readValue(json, WebhookEntityPayload.class));
                } catch (JsonProcessingException e) {
                    log.error("Failed to parse webhook payload", e);
                    return Mono.empty();
                }
            });
    }

    /**
     * Send webhooks for a triggered event (fire-and-forget).
     */
    public void sendWebhookAsync(String triggerEvent, String entityType, Long commitId,
                                  String slug, String branch, String author, String message) {
        WebhookPayload payload = new WebhookPayload(
            triggerEvent, LocalDateTime.now(), entityType, slug, branch, commitId, author, message
        );

        sendWebhook(triggerEvent, entityType, payload)
            .subscribeOn(Schedulers.boundedElastic())
            .subscribe(
                result -> log.debug("Webhook sent successfully"),
                error -> log.error("Webhook dispatch failed: {}", error.getMessage())
            );
    }

    /**
     * Send webhooks for a triggered event (reactive).
     */
    public Mono<Void> sendWebhook(String triggerEvent, String entityType, WebhookPayload payload) {
        if (kernelService == null) {
            return Mono.empty();
        }

        log.info("🔔 Dispatching webhooks for event: {} (type: {})", triggerEvent, entityType);

        return findMatchingWebhooks(triggerEvent, entityType)
            .flatMap(webhook -> executeWebhook(webhook, payload))
            .then();
    }

    /**
     * Operational metrics hook: number of pending webhook dispatches.
     *
     * <p>Default implementation returns 0 until a real queue/table is implemented.
     * Replace with an actual query when you introduce a dispatch queue.
     */
    public Mono<Long> getPendingDispatchCount() {
        return Mono.just(0L);
    }

    /**
     * Find all active webhooks matching the trigger event and entity type.
     */
    private Flux<WebhookEntityPayload> findMatchingWebhooks(String triggerEvent, String entityType) {
        return findAll()
            .filter(webhook -> webhook.matches(triggerEvent, entityType));
    }

    /**
     * Execute a single webhook call.
     */
    private Mono<Void> executeWebhook(WebhookEntityPayload webhook, WebhookPayload payload) {
        long startTime = System.currentTimeMillis();

        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            String signature = webhook.secretToken() != null && !webhook.secretToken().isBlank()
                ? computeHmacSignature(payloadJson, webhook.secretToken())
                : null;

            WebClient webClient = webClientBuilder.build();

            return webClient.post()
                .uri(webhook.targetUrl())
                .header("Content-Type", "application/json")
                .header("X-UBOS-Event", payload.event())
                .header("X-UBOS-Hook", webhook.hookName())
                .header("X-UBOS-Signature", signature != null ? signature : "")
                .bodyValue(payloadJson)
                .retrieve()
                .toBodilessEntity()
                .timeout(Duration.ofMillis(webhook.timeoutMs()))
                .retryWhen(Retry.backoff(webhook.retryCount(), Duration.ofSeconds(1))
                    .filter(this::isRetryableError))
                .doOnSuccess(response -> {
                    long duration = System.currentTimeMillis() - startTime;
                    log.info("✅ Webhook '{}' succeeded ({}ms)", webhook.hookName(), duration);
                })
                .doOnError(error -> {
                    long duration = System.currentTimeMillis() - startTime;
                    log.error("❌ Webhook '{}' failed: {} ({}ms)", 
                             webhook.hookName(), error.getMessage(), duration);
                })
                .then()
                .onErrorResume(e -> Mono.empty());  // Don't fail the entire chain

        } catch (JsonProcessingException e) {
            log.error("Failed to serialize webhook payload: {}", e.getMessage());
            return Mono.empty();
        }
    }

    /**
     * Check if an error is retryable.
     */
    private boolean isRetryableError(Throwable error) {
        if (error instanceof WebClientResponseException wce) {
            int status = wce.getStatusCode().value();
            return status >= 500 || status == 429;
        }
        return true;
    }

    /**
     * Compute HMAC-SHA256 signature.
     */
    private String computeHmacSignature(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return "sha256=" + Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            log.error("Failed to compute HMAC: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Map search result to WebhookEntityPayload.
     */
    private WebhookEntityPayload mapToPayload(Map<String, Object> result) {
        try {
            String snapshotData = (String) result.get("snapshotData");
            if (snapshotData == null || snapshotData.isBlank()) {
                return null;
            }
            return objectMapper.readValue(snapshotData, WebhookEntityPayload.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse webhook payload: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Webhook payload sent to target URLs.
     */
    public record WebhookPayload(
        String event,
        LocalDateTime timestamp,
        String entityType,
        String slug,
        String branch,
        Long commitId,
        String author,
        String message
    ) {}
}
