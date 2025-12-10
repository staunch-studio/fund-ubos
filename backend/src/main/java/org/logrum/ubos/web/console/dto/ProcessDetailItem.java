package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO representing a commit detail within a process from lcm_process_entity_map.
 *
 * @param commitId    the commit identifier
 * @param entityId    the entity identifier
 * @param entityType  the entity type (e.g., "LOGIC", "TYPE")
 * @param slug        the entity slug
 * @param branchName  the branch where the commit was made
 * @param message     the commit message
 * @param authorId    the author of the commit
 * @param committedAt when the commit was made
 */
public record ProcessDetailItem(
    Long commitId,
    String entityId,
    String entityType,
    String slug,
    String branchName,
    String message,
    String authorId,
    LocalDateTime committedAt
) {
    /**
     * Creates a ProcessDetailItem from a raw map returned by the database query.
     *
     * @param map the raw database result map
     * @return a typed ProcessDetailItem instance
     */
    public static ProcessDetailItem fromMap(Map<String, Object> map) {
        return new ProcessDetailItem(
            map.get("commitId") instanceof Long l ? l : null,
            (String) map.get("entityId"),
            (String) map.get("entityType"),
            (String) map.get("slug"),
            (String) map.get("branchName"),
            (String) map.get("message"),
            (String) map.get("authorId"),
            (LocalDateTime) map.get("committedAt")
        );
    }
}
