package org.logrum.ubos.kernel.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.util.ReactiveRetry;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Service for auditing and retrieving historical data of LCM entities.
 * <p>
 * Provides methods to query process logs, process details, and entity commit history.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LcmAuditService {

    private final DatabaseClient dbClient;
    
    private final Retry retryPolicy = ReactiveRetry.databaseTransientErrors();

    /**
     * Retrieves information about a specific process.
     *
     * @param processId the process ID to query
     * @return a Mono containing process information, or empty if not found
     */
    public Mono<Map<String, Object>> getProcessInfo(String processId) {
        String sql = """
            SELECT process_id, process_name, operator_id, started_at
            FROM lcm_process_commit_log
            WHERE process_id = :processId
        """;

        return dbClient.sql(sql)
            .bind("processId", processId)
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("processId", row.get("process_id", String.class));
                result.put("processName", row.get("process_name", String.class));
                result.put("operatorId", row.get("operator_id", String.class));
                result.put("startedAt", row.get("started_at", LocalDateTime.class));
                return result;
            })
            .one()
            .retryWhen(retryPolicy);
    }

    /**
     * Counts the number of commits associated with a process.
     *
     * @param processId the process ID to query
     * @return a Mono containing the commit count
     */
    public Mono<Long> getProcessCommitCount(String processId) {
        String sql = """
            SELECT COUNT(*) as count
            FROM lcm_process_entity_map
            WHERE process_id = :processId
        """;

        return dbClient.sql(sql)
            .bind("processId", processId)
            .map((row, meta) -> row.get("count", Long.class))
            .one()
            .defaultIfEmpty(0L)
            .retryWhen(retryPolicy);
    }

    /**
     * Retrieves processes filtered by operator.
     *
     * @param operatorId the operator ID to filter by
     * @param limit      maximum number of results
     * @return a Flux of maps containing process information
     */
    public Flux<Map<String, Object>> getProcessesByOperator(String operatorId, int limit) {
        String sql = """
            SELECT process_id, process_name, operator_id, started_at
            FROM lcm_process_commit_log
            WHERE operator_id = :operatorId
            ORDER BY started_at DESC
            LIMIT :limit
        """;

        return dbClient.sql(sql)
            .bind("operatorId", operatorId)
            .bind("limit", limit)
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("processId", row.get("process_id", String.class));
                result.put("processName", row.get("process_name", String.class));
                result.put("operatorId", row.get("operator_id", String.class));
                result.put("startedAt", row.get("started_at", LocalDateTime.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Retrieves the most recent processes from the audit log.
     *
     * @return a Flux of maps containing process information
     */
    public Flux<Map<String, Object>> getRecentProcesses() {
        String sql = """
            SELECT process_id, process_name, operator_id, started_at
            FROM lcm_process_commit_log
            ORDER BY started_at DESC
            LIMIT 50
        """;

        return dbClient.sql(sql)
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("processId", row.get("process_id", String.class));
                result.put("processName", row.get("process_name", String.class));
                result.put("operatorId", row.get("operator_id", String.class));
                result.put("startedAt", row.get("started_at", LocalDateTime.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Retrieves detailed information about a specific process, including all associated commits.
     *
     * @param processId the process ID to query
     * @return a Flux of maps containing commit details linked to the process
     */
    public Flux<Map<String, Object>> getProcessDetails(String processId) {
        String sql = """
            SELECT v.commit_id, v.entity_id, v.branch_name, v.message, v.author_id, v.committed_at,
                   i.entity_type, i.slug
            FROM lcm_process_entity_map m
            JOIN lcm_entity_version_chain v ON m.commit_id = v.commit_id
            JOIN lcm_entity_instance i ON v.entity_id = i.id
            WHERE m.process_id = :processId
            ORDER BY v.committed_at DESC
        """;

        return dbClient.sql(sql)
            .bind("processId", processId)
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("commitId", row.get("commit_id", Long.class));
                result.put("entityId", row.get("entity_id", String.class));
                result.put("entityType", row.get("entity_type", String.class));
                result.put("slug", row.get("slug", String.class));
                result.put("branchName", row.get("branch_name", String.class));
                result.put("message", row.get("message", String.class));
                result.put("authorId", row.get("author_id", String.class));
                result.put("committedAt", row.get("committed_at", LocalDateTime.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Retrieves the commit history for a specific entity by slug.
     * <p>
     * Returns all commits across all branches for the given entity, ordered by commit time (newest first).
     *
     * @param slug the entity slug identifier
     * @return a Flux of maps containing commit history details
     */
    public Flux<Map<String, Object>> getEntityHistory(String slug) {
        String sql = """
            SELECT v.commit_id, v.branch_name, v.parent_commit_id, v.message, v.author_id, v.committed_at
            FROM lcm_entity_version_chain v
            JOIN lcm_entity_instance i ON v.entity_id = i.id
            WHERE i.slug = :slug
            ORDER BY v.committed_at DESC
        """;

        return dbClient.sql(sql)
            .bind("slug", slug)
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("commitId", row.get("commit_id", Long.class));
                result.put("branchName", row.get("branch_name", String.class));
                result.put("parentCommitId", row.get("parent_commit_id", Long.class));
                result.put("message", row.get("message", String.class));
                result.put("authorId", row.get("author_id", String.class));
                result.put("committedAt", row.get("committed_at", LocalDateTime.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Retrieves the commit history for a specific entity by type and slug.
     * <p>
     * This method provides more precise filtering when multiple entities may have the same slug
     * but different types.
     *
     * @param type the entity type (e.g., "LOGIC", "TYPE", "DATA")
     * @param slug the entity slug identifier
     * @return a Flux of maps containing commit history details
     */
    public Flux<Map<String, Object>> getEntityHistory(String type, String slug) {
        String sql = """
            SELECT v.commit_id, v.branch_name, v.parent_commit_id, v.message, v.author_id, v.committed_at
            FROM lcm_entity_version_chain v
            JOIN lcm_entity_instance i ON v.entity_id = i.id
            WHERE i.entity_type = :type AND i.slug = :slug
            ORDER BY v.committed_at DESC
        """;

        return dbClient.sql(sql)
            .bind("type", type)
            .bind("slug", slug)
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("commitId", row.get("commit_id", Long.class));
                result.put("branchName", row.get("branch_name", String.class));
                result.put("parentCommitId", row.get("parent_commit_id", Long.class));
                result.put("message", row.get("message", String.class));
                result.put("authorId", row.get("author_id", String.class));
                result.put("committedAt", row.get("committed_at", LocalDateTime.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Retrieves commit history for an entity filtered by branch.
     *
     * @param type   the entity type
     * @param slug   the entity slug identifier
     * @param branch the branch name to filter by
     * @return a Flux of maps containing commit history for the specified branch
     */
    public Flux<Map<String, Object>> getEntityHistoryByBranch(String type, String slug, String branch) {
        String sql = """
            SELECT v.commit_id, v.branch_name, v.parent_commit_id, v.message, v.author_id, v.committed_at
            FROM lcm_entity_version_chain v
            JOIN lcm_entity_instance i ON v.entity_id = i.id
            WHERE i.entity_type = :type AND i.slug = :slug AND v.branch_name = :branch
            ORDER BY v.committed_at DESC
        """;

        return dbClient.sql(sql)
            .bind("type", type)
            .bind("slug", slug)
            .bind("branch", branch)  // ← 添加这一行
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("commitId", row.get("commit_id", Long.class));
                result.put("branchName", row.get("branch_name", String.class));
                result.put("parentCommitId", row.get("parent_commit_id", Long.class));
                result.put("message", row.get("message", String.class));
                result.put("authorId", row.get("author_id", String.class));
                result.put("committedAt", row.get("committed_at", LocalDateTime.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Helper method to handle null values in result maps.
     */
    private Object nullSafe(Object value) {
        return value != null ? value : "";
    }
}