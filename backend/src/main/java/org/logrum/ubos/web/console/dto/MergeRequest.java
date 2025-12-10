package org.logrum.ubos.web.console.dto;

import java.util.List;

/**
 * DTO for branch merge mutation request.
 *
 * @param sourceBranch the branch to merge from (e.g., "feature-v2")
 * @param targetBranch the branch to merge into (e.g., "master")
 * @param type         the entity type (e.g., "LOGIC"), defaults to "LOGIC" if null
 * @param slugs        list of entity slugs to merge (if empty, merges all entities)
 * @param author       the author performing the merge
 * @param message      the merge commit message
 */
public record MergeRequest(
    String sourceBranch,
    String targetBranch,
    String type,
    List<String> slugs,
    String author,
    String message
) {
    /**
     * Returns the resolved type, defaulting to "LOGIC" if not provided.
     */
    public String resolvedType() {
        return (type == null || type.isBlank()) ? "LOGIC" : type.toUpperCase();
    }

    /**
     * Returns the resolved target branch, defaulting to "master" if not provided.
     */
    public String resolvedTargetBranch() {
        return (targetBranch == null || targetBranch.isBlank()) ? "master" : targetBranch;
    }

    /**
     * Returns the resolved author, defaulting to "MergeBot" if not provided.
     */
    public String resolvedAuthor() {
        return (author == null || author.isBlank()) ? "MergeBot" : author;
    }

    /**
     * Returns the resolved message with a default if not provided.
     */
    public String resolvedMessage() {
        return (message == null || message.isBlank())
            ? String.format("Merge branch '%s' into '%s'", sourceBranch, resolvedTargetBranch())
            : message;
    }

    /**
     * Checks if the request has valid slugs to merge.
     */
    public boolean hasSlugs() {
        return slugs != null && !slugs.isEmpty();
    }
}
