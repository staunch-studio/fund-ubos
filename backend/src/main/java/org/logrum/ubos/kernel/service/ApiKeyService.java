package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.web.console.dto.ApiKeyEntityPayload;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing API keys stored in the Version Chain.
 * 
 * <p>API keys are stored as entities with:
 * <ul>
 *   <li>Entity Type: 'SECURITY_KEY'</li>
 *   <li>Slug: keyId (UUID)</li>
 * </ul>
 */
@Slf4j
@Service
public class ApiKeyService {

    private final ObjectMapper objectMapper;
    
    // Lazy reference to LcmKernelService to avoid circular dependency
    private LcmKernelService kernelService;

    private final SecureRandom secureRandom = new SecureRandom();

    // Cache for validated keys (keyHash -> payload)
    private final Map<String, CachedKey> keyCache = new ConcurrentHashMap<>();

    private record CachedKey(ApiKeyEntityPayload payload, long cachedAt) {
        boolean isExpired() {
            // Cache expires after 5 minutes
            return System.currentTimeMillis() - cachedAt > 300_000;
        }
    }

    public ApiKeyService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Set the kernel service (called during initialization to break circular dependency).
     */
    public void setKernelService(LcmKernelService kernelService) {
        this.kernelService = kernelService;
        log.info("🔑 API Key service initialized with kernel service");
    }

    /**
     * Generate a new API key.
     * 
     * <p>IMPORTANT: The plain text key is only returned once at creation time.
     *
     * @param keyName     friendly name for the key
     * @param description optional description
     * @param scope       access scope
     * @param expiresAt   optional expiration date
     * @param createdBy   the user creating the key
     * @return result containing the plain text key (show once) and commit ID
     */
    public Mono<ApiKeyGenerationResult> generateKey(String keyName, String description,
                                                     String scope, LocalDateTime expiresAt,
                                                     String createdBy) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        log.info("🔑 Generating new API key: {}", keyName);

        String keyId = UUID.randomUUID().toString();
        String plainTextKey = generateSecureKey();
        String hashedKey = hashKey(plainTextKey);

        ApiKeyEntityPayload payload = new ApiKeyEntityPayload(
            keyId,
            keyName,
            hashedKey,
            description,
            scope != null ? scope : "READ_ONLY",
            true,
            LocalDateTime.now(),
            expiresAt,
            createdBy
        );

        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);

            return kernelService.commit(
                    ApiKeyEntityPayload.ENTITY_TYPE,
                    keyId,
                    "master",
                    jsonPayload,
                    createdBy,
                    "Created API key: " + keyName
                )
                .map(commitId -> {
                    log.info("✅ API key '{}' generated (ID: {}, commit: {})", keyName, keyId, commitId);
                    return new ApiKeyGenerationResult(plainTextKey, keyId, payload, commitId);
                });

        } catch (JsonProcessingException e) {
            return Mono.error(new RuntimeException("Failed to serialize API key payload", e));
        }
    }

    /**
     * Result of API key generation.
     */
    public record ApiKeyGenerationResult(
        String plainTextKey,  // Only shown once!
        String keyId,
        ApiKeyEntityPayload payload,
        Long commitId
    ) {}

    /**
     * Validate an API key from the X-API-KEY header.
     *
     * @param plainTextKey the plain text API key
     * @return the API key payload if valid, empty if invalid
     */
    public Mono<ApiKeyEntityPayload> validateKey(String plainTextKey) {
        if (plainTextKey == null || plainTextKey.isBlank() || kernelService == null) {
            return Mono.empty();
        }

        String hashedKey = hashKey(plainTextKey);

        // Check cache first
        CachedKey cached = keyCache.get(hashedKey);
        if (cached != null && !cached.isExpired() && cached.payload().isValid()) {
            return Mono.just(cached.payload());
        }

        // Search all SECURITY_KEY entities for matching hash
        return findKeyByHash(hashedKey)
            .filter(ApiKeyEntityPayload::isValid)
            .doOnNext(payload -> {
                // Cache the validated key
                keyCache.put(hashedKey, new CachedKey(payload, System.currentTimeMillis()));
            });
    }

    /**
     * Validate key and check scope.
     */
    public Mono<ApiKeyEntityPayload> validateKeyWithScope(String plainTextKey, String requiredScope) {
        return validateKey(plainTextKey)
            .filter(payload -> payload.hasScope(requiredScope));
    }

    /**
     * Find a key by its hash by searching all SECURITY_KEY entities.
     */
    private Mono<ApiKeyEntityPayload> findKeyByHash(String hashedKey) {
        return kernelService.search(ApiKeyEntityPayload.ENTITY_TYPE, "master", Map.of())
            .map(this::mapToPayload)
            .filter(payload -> payload != null && hashedKey.equals(payload.hashedKey()))
            .next();
    }

    /**
     * Revoke (deactivate) an API key.
     */
    public Mono<Long> revokeKey(String keyId, String revokedBy) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        log.info("🔒 Revoking API key: {}", keyId);

        return kernelService.getResourceSnapshot(ApiKeyEntityPayload.ENTITY_TYPE, keyId, "master")
            .flatMap(json -> {
                try {
                    ApiKeyEntityPayload current = objectMapper.readValue(json, ApiKeyEntityPayload.class);
                    ApiKeyEntityPayload deactivated = current.deactivate();
                    String newJson = objectMapper.writeValueAsString(deactivated);

                    // Clear cache
                    keyCache.values().removeIf(cached -> 
                        cached.payload().keyId().equals(keyId));

                    return kernelService.commit(
                        ApiKeyEntityPayload.ENTITY_TYPE,
                        keyId,
                        "master",
                        newJson,
                        revokedBy,
                        "Revoked API key: " + current.keyName()
                    );
                } catch (JsonProcessingException e) {
                    return Mono.error(new RuntimeException("Failed to process API key", e));
                }
            })
            .switchIfEmpty(Mono.error(new IllegalArgumentException("API key not found: " + keyId)));
    }

    /**
     * Get all API keys.
     */
    public Flux<ApiKeyEntityPayload> findAll() {
        if (kernelService == null) {
            return Flux.error(new IllegalStateException("Kernel service not initialized"));
        }

        return kernelService.search(ApiKeyEntityPayload.ENTITY_TYPE, "master", Map.of())
            .map(this::mapToPayload)
            .filter(payload -> payload != null);
    }

    /**
     * Get a specific API key by ID.
     */
    public Mono<ApiKeyEntityPayload> findById(String keyId) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        return kernelService.getResourceSnapshot(ApiKeyEntityPayload.ENTITY_TYPE, keyId, "master")
            .flatMap(json -> {
                try {
                    return Mono.just(objectMapper.readValue(json, ApiKeyEntityPayload.class));
                } catch (JsonProcessingException e) {
                    log.error("Failed to parse API key payload", e);
                    return Mono.empty();
                }
            });
    }

    /**
     * Clear the key cache.
     */
    public void clearCache() {
        keyCache.clear();
        log.info("🗑️ API key cache cleared");
    }

    /**
     * Map a search result to ApiKeyEntityPayload.
     */
    private ApiKeyEntityPayload mapToPayload(Map<String, Object> result) {
        try {
            String snapshotData = (String) result.get("snapshotData");
            if (snapshotData == null || snapshotData.isBlank()) {
                return null;
            }
            return objectMapper.readValue(snapshotData, ApiKeyEntityPayload.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse API key payload: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Generate a secure random API key.
     */
    private String generateSecureKey() {
        byte[] keyBytes = new byte[32];
        secureRandom.nextBytes(keyBytes);
        return "ubos_" + Base64.getUrlEncoder().withoutPadding().encodeToString(keyBytes);
    }

    /**
     * Hash an API key using SHA-256.
     */
    private String hashKey(String plainTextKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(plainTextKey.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
