package org.logrum.ubos.web.console.dto;

/**
 * DTO for external programmatic commits (used by CI/CD systems).
 *
 * @param type        the entity type (e.g., "LOGIC", "TYPE")
 * @param slug        the entity slug identifier
 * @param branch      the branch to commit to (defaults to "master")
 * @param jsonContent the JSON content to commit
 * @param message     the commit message
 */
public record ExternalCommitRequest(
    String type,
    String slug,
    String branch,
    String jsonContent,
    String message
) {
    /**
     * Returns the resolved type, defaulting to "LOGIC".
     */
    public String resolvedType() {
        return (type == null || type.isBlank()) ? "LOGIC" : type.toUpperCase();
    }

    /**
     * Returns the resolved branch, defaulting to "master".
     */
    public String resolvedBranch() {
        return (branch == null || branch.isBlank()) ? "master" : branch;
    }

    /**
     * Returns the resolved message with a default.
     */
    public String resolvedMessage() {
        return (message == null || message.isBlank()) 
            ? "External commit via API" 
            : message;
    }
}
