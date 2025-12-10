package org.logrum.ubos.web.console.dto;

/**
 * Request body for URI-based revert operations.
 * Supports both URI mode and legacy mode for backward compatibility.
 *
 * @param uri            the UBOS URI (preferred)
 * @param slug           legacy: entity slug
 * @param type           legacy: entity type
 * @param branch         legacy: branch name
 * @param targetCommitId the commit ID to revert to (required)
 * @param author         optional author identifier
 * @param message        optional revert message
 */
public record UriRevertRequest(
    String uri,
    String slug,
    String type,
    String branch,
    Long targetCommitId,
    String author,
    String message
) {
    public boolean hasUri() {
        return uri != null && !uri.isBlank();
    }

    public boolean hasSlug() {
        return slug != null && !slug.isBlank();
    }

    public String resolvedType() {
        return (type == null || type.isBlank()) ? "LOGIC" : type.toUpperCase();
    }

    public String resolvedBranch() {
        return (branch == null || branch.isBlank()) ? "master" : branch;
    }

    public String resolvedAuthor() {
        return (author == null || author.isBlank()) ? "system" : author;
    }
}
