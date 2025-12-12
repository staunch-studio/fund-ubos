package org.logrum.ubos.kernel.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.web.console.dto.SystemHealthDto;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LcmMetricsService {

    private final LcmApprovalService approvalService;
    private final WebhookService webhookService;
    private final LcmKernelService kernelService;
    private final DatabaseClient dbClient;

    public Mono<SystemHealthDto> getSystemHealthStatus() {
        Mono<Boolean> dbUpMono = dbClient.sql("SELECT 1")
            .map((row, meta) -> true)
            .one()
            .defaultIfEmpty(false)
            .onErrorReturn(false);

        Mono<Long> entityCountMono = dbClient.sql("SELECT COUNT(1) AS c FROM lcm_entity_instance")
            .map((row, meta) -> {
                Long v = row.get("c", Long.class);
                return v == null ? 0L : v;
            })
            .one()
            .defaultIfEmpty(0L)
            .onErrorReturn(0L);

        Mono<Long> commitCountMono = dbClient.sql("SELECT COUNT(1) AS c FROM lcm_entity_version_chain")
            .map((row, meta) -> {
                Long v = row.get("c", Long.class);
                return v == null ? 0L : v;
            })
            .one()
            .defaultIfEmpty(0L)
            .onErrorReturn(0L);

        return Mono.zip(dbUpMono, entityCountMono, commitCountMono)
            .map(t -> {
                boolean dbUp = t.getT1();
                long entities = t.getT2();
                long commits = t.getT3();
                String status = dbUp ? "UP" : "DOWN";
                return new SystemHealthDto(Instant.now(), dbUp, entities, commits, status);
            });
    }

    public Mono<Map<String, Object>> getWorkflowQueueStatus() {
        Mono<Long> pendingApprovalsMono =
            approvalService.findPending()
                .count()
                .onErrorReturn(0L);

        Mono<Long> pendingWebhooksMono =
            webhookService.getPendingDispatchCount()
                .onErrorReturn(0L);

        return Mono.zip(pendingApprovalsMono, pendingWebhooksMono)
            .map(t -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("pendingApprovalRequests", t.getT1());
                m.put("pendingWebhookDispatches", t.getT2());
                m.put("timestamp", Instant.now().toString());
                return m;
            });
    }

    public Mono<Map<String, Object>> getCommitMetrics() {
        Mono<Long> totalLast24hMono = dbClient.sql("""
                SELECT COUNT(1) AS c
                FROM lcm_entity_version_chain
                WHERE committed_at >= (NOW() - INTERVAL '24 HOURS')
            """)
            .map((row, meta) -> {
                Long v = row.get("c", Long.class);
                return v == null ? 0L : v;
            })
            .one()
            .defaultIfEmpty(0L)
            .onErrorReturn(0L);

        Mono<LinkedHashMap<String, Long>> commitsPerTypeMono = dbClient.sql("""
                SELECT i.entity_type AS entity_type, COUNT(1) AS c
                FROM lcm_entity_version_chain v
                JOIN lcm_entity_instance i ON i.id = v.entity_id
                WHERE v.committed_at >= (NOW() - INTERVAL '24 HOURS')
                GROUP BY i.entity_type
                ORDER BY i.entity_type
            """)
            .map((row, meta) -> {
                String type = row.get("entity_type", String.class);
                Long c = row.get("c", Long.class);
                Map<String, Long> one = new LinkedHashMap<>();
                one.put(type == null ? "UNKNOWN" : type, c == null ? 0L : c);
                return one;
            })
            .all()
            .reduce(new LinkedHashMap<String, Long>(), (acc, one) -> {
                acc.putAll(one);
                return acc;
            })
            .defaultIfEmpty(new LinkedHashMap<String, Long>())
            .onErrorReturn(new LinkedHashMap<String, Long>());

        // If you don't have a stored "latency" metric, a reasonable proxy is
        // the average time between commit timestamps within the last 24h.
        Mono<Double> avgSecondsBetweenCommitsMono = dbClient.sql("""
                WITH ordered AS (
                    SELECT committed_at,
                           LAG(committed_at) OVER (ORDER BY committed_at) AS prev_committed_at
                    FROM lcm_entity_version_chain
                    WHERE committed_at >= (NOW() - INTERVAL '24 HOURS')
                )
                SELECT AVG(EXTRACT(EPOCH FROM (committed_at - prev_committed_at))) AS avg_s
                FROM ordered
                WHERE prev_committed_at IS NOT NULL
            """)
            .map((row, meta) -> {
                Double v = row.get("avg_s", Double.class);
                return v;
            })
            .one()
            .defaultIfEmpty(null)
            .onErrorReturn(null);

        return Mono.zip(totalLast24hMono, commitsPerTypeMono, avgSecondsBetweenCommitsMono)
            .map(t -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("totalCommitsLast24h", t.getT1());
                m.put("commitsPerEntityTypeLast24h", t.getT2());
                m.put("avgSecondsBetweenCommitsLast24h", t.getT3()); // proxy metric
                m.put("timestamp", Instant.now().toString());
                return m;
            });
    }

    public Mono<Map<String, Object>> getCacheHitRatio() {
        long hits = kernelService.getSnapshotCacheHits();
        long misses = kernelService.getSnapshotCacheMisses();
        long total = hits + misses;
        double ratio = total == 0 ? 0.0 : ((double) hits / (double) total);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("snapshotCacheType", "ConcurrentHashMap");
        m.put("hits", hits);
        m.put("misses", misses);
        m.put("requests", total);
        m.put("hitRatio", ratio);
        m.put("cacheSize", kernelService.getSnapshotCacheSize());
        m.put("timestamp", Instant.now().toString());
        return Mono.just(m);
    }
}
