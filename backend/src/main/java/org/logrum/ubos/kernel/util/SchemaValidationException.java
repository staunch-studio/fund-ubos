package org.logrum.ubos.kernel.util;

import java.util.List;
import java.util.Set;

/**
 * Exception thrown when JSON data fails schema validation.
 */
public class SchemaValidationException extends RuntimeException {

    private final String entityType;
    private final String slug;
    private final List<String> errors;

    public SchemaValidationException(String entityType, String slug, Set<com.networknt.schema.ValidationMessage> validationErrors) {
        super(String.format("Schema validation failed for %s/%s: %d error(s)", 
                           entityType, slug, validationErrors.size()));
        this.entityType = entityType;
        this.slug = slug;
        this.errors = validationErrors.stream()
            .map(com.networknt.schema.ValidationMessage::getMessage)
            .toList();
    }

    public SchemaValidationException(String entityType, String slug, String error) {
        super(String.format("Schema validation failed for %s/%s: %s", entityType, slug, error));
        this.entityType = entityType;
        this.slug = slug;
        this.errors = List.of(error);
    }

    public String getEntityType() {
        return entityType;
    }

    public String getSlug() {
        return slug;
    }

    public List<String> getErrors() {
        return errors;
    }

    public String getErrorsAsString() {
        return String.join("; ", errors);
    }
}
