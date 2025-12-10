package org.logrum.ubos.kernel.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * JSON Schema validator for entity data.
 * 
 * <p>Schema definitions are stored as regular UBOS entities with:
 * <ul>
 *   <li>entityType = 'SCHEMA'</li>
 *   <li>slug = '{targetEntityType}' (e.g., 'LOGIC', 'TYPE', 'DATA')</li>
 * </ul>
 * 
 * <p>The schema content is fetched from the 'master' branch by default.
 */
@Slf4j
@Component
public class JsonSchemaValidator {

    private final ObjectMapper objectMapper;
    
    // Lazy-initialized reference to avoid circular dependency
    private SchemaFetcher schemaFetcher;

    // Schema cache to avoid repeated lookups
    private final Map<String, CachedSchema> schemaCache = new ConcurrentHashMap<>();

    // Cache entry with expiration
    private record CachedSchema(JsonSchema schema, long cachedAt) {
        boolean isExpired() {
            // Cache expires after 5 minutes
            return System.currentTimeMillis() - cachedAt > 300_000;
        }
    }

    /**
     * Functional interface for fetching schema content.
     * This allows breaking the circular dependency with LcmKernelService.
     */
    @FunctionalInterface
    public interface SchemaFetcher {
        Mono<String> fetchSchema(String schemaType, String schemaSlug, String branch);
    }

    public JsonSchemaValidator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Set the schema fetcher (called by Spring during initialization).
     * This breaks the circular dependency with LcmKernelService.
     */
    public void setSchemaFetcher(SchemaFetcher schemaFetcher) {
        this.schemaFetcher = schemaFetcher;
    }

    /**
     * Validate JSON data against the schema for the given entity type.
     * 
     * <p>Schema lookup convention:
     * <ul>
     *   <li>Schema entity type: 'SCHEMA'</li>
     *   <li>Schema slug: '{targetEntityType}' (e.g., 'LOGIC' for LOGIC entities)</li>
     *   <li>Branch: 'master' (always use master branch for schema)</li>
     * </ul>
     *
     * @param targetEntityType the entity type being validated (e.g., "LOGIC", "TYPE")
     * @param targetSlug       the entity slug being validated
     * @param jsonData         the JSON data to validate
     * @return Mono<Void> that completes if validation passes, errors if validation fails
     */
    public Mono<Void> validate(String targetEntityType, String targetSlug, String jsonData) {
        // Skip validation for SCHEMA type itself (to allow bootstrapping)
        if ("SCHEMA".equalsIgnoreCase(targetEntityType)) {
            log.debug("⏭️ Skipping schema validation for SCHEMA entity");
            return Mono.empty();
        }

        if (schemaFetcher == null) {
            log.warn("⚠️ Schema fetcher not initialized, skipping validation");
            return Mono.empty();
        }

        String schemaSlug = targetEntityType.toUpperCase();
        String cacheKey = schemaSlug;

        // Check cache first
        CachedSchema cached = schemaCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            return validateWithSchema(cached.schema(), targetEntityType, targetSlug, jsonData);
        }

        // Fetch schema from version chain
        return schemaFetcher.fetchSchema("SCHEMA", schemaSlug, "master")
            .flatMap(schemaContent -> {
                try {
                    JsonSchema schema = compileSchema(schemaContent);
                    schemaCache.put(cacheKey, new CachedSchema(schema, System.currentTimeMillis()));
                    log.debug("📋 Loaded schema for entity type '{}'", targetEntityType);
                    return validateWithSchema(schema, targetEntityType, targetSlug, jsonData);
                } catch (Exception e) {
                    log.error("Failed to compile schema for {}: {}", targetEntityType, e.getMessage());
                    return Mono.error(new SchemaValidationException(targetEntityType, targetSlug,
                        "Invalid schema definition: " + e.getMessage()));
                }
            })
            .switchIfEmpty(Mono.defer(() -> {
                // No schema defined - validation passes by default
                log.debug("📋 No schema defined for entity type '{}', validation skipped", targetEntityType);
                return Mono.empty();
            }));
    }

    /**
     * Validate JSON data against a compiled schema.
     */
    private Mono<Void> validateWithSchema(JsonSchema schema, String entityType, String slug, String jsonData) {
        try {
            JsonNode dataNode = objectMapper.readTree(jsonData);
            Set<ValidationMessage> errors = schema.validate(dataNode);

            if (!errors.isEmpty()) {
                log.warn("❌ Schema validation failed for {}/{}: {}", entityType, slug, errors);
                return Mono.error(new SchemaValidationException(entityType, slug, errors));
            }

            log.debug("✅ Schema validation passed for {}/{}", entityType, slug);
            return Mono.empty();

        } catch (Exception e) {
            log.error("Failed to validate JSON for {}/{}: {}", entityType, slug, e.getMessage());
            return Mono.error(new SchemaValidationException(entityType, slug,
                "Invalid JSON format: " + e.getMessage()));
        }
    }

    /**
     * Compile a JSON Schema from its string content.
     */
    private JsonSchema compileSchema(String schemaContent) {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);
        return factory.getSchema(schemaContent);
    }

    /**
     * Clear the entire schema cache.
     */
    public void clearCache() {
        schemaCache.clear();
        log.info("🗑️ Schema cache cleared");
    }

    /**
     * Clear cache for a specific entity type.
     */
    public void clearCache(String entityType) {
        schemaCache.remove(entityType.toUpperCase());
        log.info("🗑️ Schema cache cleared for {}", entityType);
    }

    /**
     * Get cache statistics for monitoring.
     */
    public Map<String, Object> getCacheStats() {
        return Map.of(
            "size", schemaCache.size(),
            "keys", schemaCache.keySet()
        );
    }
}
