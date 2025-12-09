package org.logrum.ubos.kernel.service;

import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class LcmAuditService {

    private final DatabaseClient dbClient;

    public Flux<Map<String, Object>> getRecentProcesses() {
        String sql = """
            SELECT process_id, process_name, operator_id, started_at 
            FROM lcm_process_commit_log 
            ORDER BY started_at DESC 
            LIMIT 50
        """;
        return dbClient.sql(sql).fetch().all();
    }

    public Flux<Map<String, Object>> getProcessDetails(String processId) {
        String sql = """
            SELECT 
                i.slug as entity_slug,
                i.entity_type,
                v.branch_name,
                v.message,
                v.author_id,
                v.committed_at,
                v.snapshot_data
            FROM lcm_process_entity_map m
            JOIN lcm_entity_version_chain v ON m.commit_id = v.commit_id
            JOIN lcm_entity_instance i ON v.entity_id = i.id
            WHERE m.process_id = :pid
            ORDER BY v.committed_at ASC
        """;
        return dbClient.sql(sql)
            .bind("pid", processId)
            .fetch()
            .all();
    }

    public Flux<Map<String, Object>> getEntityHistory(String slug) {
        String sql = """
            SELECT v.commit_id, v.branch_name, v.message, v.author_id, v.committed_at
            FROM lcm_entity_version_chain v
            JOIN lcm_entity_instance i ON v.entity_id = i.id
            WHERE i.slug = :slug
            ORDER BY v.committed_at DESC
            LIMIT 20
        """;
        return dbClient.sql(sql)
            .bind("slug", slug)
            .fetch()
            .all();
    }
}