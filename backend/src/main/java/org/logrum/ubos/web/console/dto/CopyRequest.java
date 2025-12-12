package org.logrum.ubos.web.console.dto;

/**
 * Request body for copying an entity snapshot to a new slug and/or branch.
 *
 * @param sourceUriString source UBOS URI (can include branch/commit)
 * @param targetSlug      new slug/path
 * @param targetBranch    branch to commit on (defaults to master if blank)
 * @param author          optional author id
 * @param message         optional commit message
 */
public record CopyRequest(
    String sourceUriString,
    String targetSlug,
    String targetBranch,
    String author,
    String message
) {
    public String resolvedAuthor() {
        return (author == null || author.isBlank()) ? "system" : author;
    }

    public String resolvedTargetBranch() {
        return (targetBranch == null || targetBranch.isBlank()) ? "master" : targetBranch;
    }

    public String resolvedMessage() {
        return (message == null || message.isBlank()) ? "Copy entity" : message;
    }
}
