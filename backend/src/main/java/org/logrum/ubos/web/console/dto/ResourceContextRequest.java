package org.logrum.ubos.web.console.dto;

/**
 * DTO for read requests that require entity context.
 * Used by GET endpoints like /snapshot, /history.
 *
 * @param slug   the entity slug identifier (required)
 * @param type   the entity type (e.g., "LOGIC", "TYPE"), defaults to "LOGIC" if null
 * @param branch the branch name, defaults to "master" if null
 * @param uri    optional UBOS URI (if provided, overrides slug/type/branch)
 */
public record ResourceContextRequest(
    String slug,
    String type,
    String branch,
    String uri
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
     * Checks if the request has a valid slug.
     */
    public boolean hasSlug() {
        return slug != null && !slug.isBlank();
    }

    /**
     * Checks if the request has a UBOS URI.
     */
    public boolean hasUri() {
        return uri != null && !uri.isBlank();
    }
}
