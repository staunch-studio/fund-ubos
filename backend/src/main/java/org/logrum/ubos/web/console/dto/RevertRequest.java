package org.logrum.ubos.web.console.dto;

/**
 * DTO for the revert mutation request body.
 *
 * @param slug           the entity slug identifier (required)
 * @param type           the entity type (e.g., "LOGIC", "TYPE"), defaults to "LOGIC" if null
 * @param branch         the branch name (e.g., "master"), defaults to "master" if null
 * @param targetCommitId the target commit ID to revert to (required)
 * @param message        optional commit message describing the revert
 */
public record RevertRequest(
    String slug,
    String type,
    String branch,
    Long targetCommitId,
    String message
) {
    /**
     * Returns the resolved type, defaulting to "LOGIC" if not provided.
     */
    public String resolvedType() {
        return (type == null || type.isBlank()) ? "LOGIC" : type.toUpperCase();
    }

    /**
     * Returns the resolved branch, defaulting to "master" if not provided.
     */
    public String resolvedBranch() {
        return (branch == null || branch.isBlank()) ? "master" : branch;
    }

    /**
     * Returns the resolved message with a default if not provided.
     */
    public String resolvedMessage() {
        return (message == null || message.isBlank()) 
            ? "Reverted to commit " + targetCommitId 
            : message;
    }
}
