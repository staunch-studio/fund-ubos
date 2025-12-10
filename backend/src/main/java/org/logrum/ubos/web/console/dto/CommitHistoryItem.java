package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;

/**
 * DTO representing a single commit history entry.
 *
 * @param commitId       the unique commit identifier
 * @param branchName     the branch where this commit was made
 * @param parentCommitId the parent commit ID (null for initial commits)
 * @param message        the commit message
 * @param authorId       the author who made this commit
 * @param committedAt    the timestamp when the commit was made
 */
public record CommitHistoryItem(
    Long commitId,
    String branchName,
    Long parentCommitId,
    String message,
    String authorId,
    LocalDateTime committedAt
) {
    /**
     * Creates a CommitHistoryItem from a raw map returned by the database query.
     *
     * @param map the raw database result map
     * @return a typed CommitHistoryItem instance
     */
    public static CommitHistoryItem fromMap(java.util.Map<String, Object> map) {
        return new CommitHistoryItem(
            map.get("commitId") instanceof Long l ? l : null,
            (String) map.get("branchName"),
            map.get("parentCommitId") instanceof Long l ? l : null,
            (String) map.get("message"),
            (String) map.get("authorId"),
            (LocalDateTime) map.get("committedAt")
        );
    }
}
