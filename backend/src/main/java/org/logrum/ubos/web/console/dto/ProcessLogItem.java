package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO representing a process log entry from lcm_process_commit_log.
 *
 * @param processId   the unique process identifier
 * @param processName the name/description of the process
 * @param operatorId  the user who initiated the process
 * @param startedAt   when the process was started
 */
public record ProcessLogItem(
    String processId,
    String processName,
    String operatorId,
    LocalDateTime startedAt
) {
    /**
     * Creates a ProcessLogItem from a raw map returned by the database query.
     *
     * @param map the raw database result map
     * @return a typed ProcessLogItem instance
     */
    public static ProcessLogItem fromMap(Map<String, Object> map) {
        return new ProcessLogItem(
            (String) map.get("processId"),
            (String) map.get("processName"),
            (String) map.get("operatorId"),
            (LocalDateTime) map.get("startedAt")
        );
    }
}
