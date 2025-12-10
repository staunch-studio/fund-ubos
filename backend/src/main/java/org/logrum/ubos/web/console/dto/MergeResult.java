package org.logrum.ubos.web.console.dto;

import java.util.List;

/**
 * DTO representing the result of a merge operation.
 *
 * @param success       whether the overall merge was successful
 * @param message       summary message of the merge operation
 * @param mergedCount   number of entities successfully merged
 * @param skippedCount  number of entities skipped (no changes)
 * @param failedCount   number of entities that failed to merge
 * @param mergedSlugs   list of successfully merged entity slugs
 * @param skippedSlugs  list of skipped entity slugs
 * @param failedSlugs   list of failed entity slugs with error messages
 */
public record MergeResult(
    boolean success,
    String message,
    int mergedCount,
    int skippedCount,
    int failedCount,
    List<String> mergedSlugs,
    List<String> skippedSlugs,
    List<MergeFailure> failedSlugs
) {
    /**
     * Represents a failed merge for a specific entity.
     */
    public record MergeFailure(String slug, String error) {}

    /**
     * Creates a successful merge result for a single entity.
     */
    public static MergeResult singleSuccess(String slug, Long commitId) {
        return new MergeResult(
            true,
            String.format("Successfully merged '%s' (commit: %d)", slug, commitId),
            1, 0, 0,
            List.of(slug),
            List.of(),
            List.of()
        );
    }

    /**
     * Creates a skipped merge result (no changes needed).
     */
    public static MergeResult skipped(String slug, String reason) {
        return new MergeResult(
            true,
            reason,
            0, 1, 0,
            List.of(),
            List.of(slug),
            List.of()
        );
    }

    /**
     * Creates a failed merge result.
     */
    public static MergeResult failure(String slug, String error) {
        return new MergeResult(
            false,
            error,
            0, 0, 1,
            List.of(),
            List.of(),
            List.of(new MergeFailure(slug, error))
        );
    }
}
