package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;

/**
 * Payload structure for API Key stored in Version Chain.
 * 
 * <p>Storage convention:
 * <ul>
 *   <li>Entity Type: 'SECURITY_KEY'</li>
 *   <li>Slug: keyId (UUID)</li>
 * </ul>
 *
 * @param keyId       unique identifier for the key (UUID)
 * @param keyName     friendly name for the key
 * @param hashedKey   SHA-256 hash of the plain text key
 * @param description optional description
 * @param scope       access scope (READ_ONLY, FULL_ACCESS, EXTERNAL_COMMIT)
 * @param isActive    whether the key is active
 * @param createdAt   when the key was created
 * @param expiresAt   when the key expires (null = never)
 * @param createdBy   who created the key
 */
public record ApiKeyEntityPayload(
    String keyId,
    String keyName,
    String hashedKey,
    String description,
    String scope,
    boolean isActive,
    LocalDateTime createdAt,
    LocalDateTime expiresAt,
    String createdBy
) {
    /**
     * Entity type for API keys in the version chain.
     */
    public static final String ENTITY_TYPE = "SECURITY_KEY";

    /**
     * Check if the key has expired.
     */
    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * Check if the key is valid (active and not expired).
     */
    public boolean isValid() {
        return isActive && !isExpired();
    }

    /**
     * Check if the key has the required scope.
     */
    public boolean hasScope(String requiredScope) {
        if ("FULL_ACCESS".equals(scope)) {
            return true;
        }
        return scope != null && scope.equals(requiredScope);
    }

    /**
     * Create a deactivated version of this payload.
     */
    public ApiKeyEntityPayload deactivate() {
        return new ApiKeyEntityPayload(
            keyId, keyName, hashedKey, description, scope,
            false, createdAt, expiresAt, createdBy
        );
    }
}
