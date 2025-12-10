package org.logrum.ubos.web.console.dto;

import java.util.Map;

/**
 * DTO representing a search result from the entity search index.
 *
 * @param entityId     the entity identifier
 * @param entityType   the entity type (e.g., "LOGIC", "TYPE")
 * @param slug         the entity slug
 * @param branchName   the branch where the match was found
 * @param commitId     the commit ID containing the match
 * @param matchedField the field name that matched the query
 * @param matchedValue the value that matched the query
 * @param snapshotData the full snapshot data (optional, may be null)
 */
public record SearchResult(
    String entityId,
    String entityType,
    String slug,
    String branchName,
    Long commitId,
    String matchedField,
    String matchedValue,
    String snapshotData
) {
    /**
     * Creates a SearchResult from a raw map returned by the database query.
     *
     * @param map the raw database result map
     * @return a typed SearchResult instance
     */
    public static SearchResult fromMap(Map<String, Object> map) {
        return new SearchResult(
            (String) map.get("entityId"),
            (String) map.get("entityType"),
            (String) map.get("slug"),
            (String) map.get("branchName"),
            map.get("commitId") instanceof Long l ? l : null,
            (String) map.get("matchedField"),
            (String) map.get("matchedValue"),
            (String) map.get("snapshotData")
        );
    }
}
