package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;

/**
 * Payload structure for Webhook configuration stored in Version Chain.
 * 
 * <p>Storage convention:
 * <ul>
 *   <li>Entity Type: 'WEBHOOK'</li>
 *   <li>Slug: hookName</li>
 * </ul>
 *
 * @param hookName      unique name for the webhook
 * @param triggerEvent  event that triggers this webhook (COMMIT, MERGE, DEPLOY, REVERT)
 * @param targetUrl     URL to send the webhook to
 * @param entityType    optional filter for entity type (null = all types)
 * @param secretToken   optional secret for HMAC signature
 * @param isActive      whether the webhook is active
 * @param retryCount    number of retry attempts on failure
 * @param timeoutMs     request timeout in milliseconds
 * @param description   optional description
 * @param createdAt     when the webhook was created
 * @param createdBy     who created the webhook
 */
public record WebhookEntityPayload(
    String hookName,
    String triggerEvent,
    String targetUrl,
    String entityType,
    String secretToken,
    boolean isActive,
    int retryCount,
    int timeoutMs,
    String description,
    LocalDateTime createdAt,
    String createdBy
) {
    /**
     * Entity type for webhooks in the version chain.
     */
    public static final String ENTITY_TYPE = "WEBHOOK";

    /**
     * Supported trigger events.
     */
    public enum TriggerEvent {
        COMMIT,   // After a commit is created
        MERGE,    // After a branch merge
        DEPLOY,   // After environment deployment
        REVERT    // After a revert operation
    }

    /**
     * Create with default values for optional fields.
     */
    public static WebhookEntityPayload create(String hookName, String triggerEvent, 
                                               String targetUrl, String entityType,
                                               String secretToken, String description,
                                               String createdBy) {
        return new WebhookEntityPayload(
            hookName,
            triggerEvent,
            targetUrl,
            entityType,
            secretToken,
            true,  // active by default
            3,     // default retry count
            5000,  // default timeout
            description,
            LocalDateTime.now(),
            createdBy
        );
    }

    /**
     * Create a deactivated version of this payload.
     */
    public WebhookEntityPayload deactivate() {
        return new WebhookEntityPayload(
            hookName, triggerEvent, targetUrl, entityType, secretToken,
            false, retryCount, timeoutMs, description, createdAt, createdBy
        );
    }

    /**
     * Check if this webhook matches the given event and entity type.
     */
    public boolean matches(String event, String type) {
        if (!isActive) return false;
        if (!triggerEvent.equals(event)) return false;
        // entityType filter: null means match all types
        return entityType == null || entityType.isEmpty() || entityType.equals(type);
    }
}
