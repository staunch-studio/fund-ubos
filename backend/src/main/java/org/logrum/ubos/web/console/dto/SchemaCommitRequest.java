package org.logrum.ubos.web.console.dto;

/**
 * DTO for committing a JSON Schema definition.
 * 
 * <p>Schema entities are stored with:
 * <ul>
 *   <li>entityType = 'SCHEMA'</li>
 *   <li>slug = the target entity type this schema describes (e.g., 'LOGIC')</li>
 * </ul>
 *
 * @param targetType        the entity type this schema describes (e.g., "LOGIC", "TYPE", "DATA")
 * @param jsonSchemaContent the JSON Schema definition content
 * @param author            the author committing the schema
 * @param message           the commit message
 * @param branch            optional branch (defaults to "master")
 */
public record SchemaCommitRequest(
    String targetType,
    String jsonSchemaContent,
    String author,
    String message,
    String branch
) {
    /**
     * Returns the resolved author, defaulting to "SchemaAdmin" if not provided.
     */
    public String resolvedAuthor() {
        return (author == null || author.isBlank()) ? "SchemaAdmin" : author;
    }

    /**
     * Returns the resolved message with a default if not provided.
     */
    public String resolvedMessage() {
        return (message == null || message.isBlank())
            ? "Updated schema for " + targetType
            : message;
    }

    /**
     * Returns the resolved branch, defaulting to "master" if not provided.
     */
    public String resolvedBranch() {
        return (branch == null || branch.isBlank()) ? "master" : branch;
    }

    /**
     * Returns the slug for the schema entity (the target type in uppercase).
     */
    public String schemaSlug() {
        return targetType != null ? targetType.toUpperCase() : null;
    }
}
