package org.logrum.ubos.web.console.dto;

import java.util.Map;

public record MergeConflictResult(
    String status, // "AUTO_MERGED" | "CONFLICT"
    String autoMergedResult, // JSON string when AUTO_MERGED, null otherwise
    Map<String, ConflictTriplet> conflicts
) {
    public static MergeConflictResult autoMerged(String mergedJson) {
        return new MergeConflictResult("AUTO_MERGED", mergedJson, Map.of());
    }

    public static MergeConflictResult conflict(Map<String, ConflictTriplet> conflicts) {
        return new MergeConflictResult("CONFLICT", null, conflicts);
    }

    public record ConflictTriplet(
        Object baseValue,
        Object ourValue,
        Object theirValue
    ) {}
}
