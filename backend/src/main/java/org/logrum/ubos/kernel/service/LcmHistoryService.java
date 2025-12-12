package org.logrum.ubos.kernel.service;

import lombok.RequiredArgsConstructor;
import org.logrum.ubos.web.console.dto.HistoryEvent;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LcmHistoryService {

    private final DatabaseClient dbClient;

    public Flux<HistoryEvent> blame(String entityId) {
        String sql = """
            WITH ordered AS (
                SELECT
                    v.commit_id,
                    v.author_id,
                    v.message,
                    v.committed_at,
                    v.snapshot_data::jsonb AS cur,
                    LAG(v.snapshot_data::jsonb) OVER (PARTITION BY v.entity_id ORDER BY v.commit_id) AS prev
                FROM lcm_entity_version_chain v
                WHERE v.entity_id = :entityId
            )
            SELECT
                o.commit_id                         AS commit_id,
                o.author_id                         AS author_id,
                o.committed_at                      AS committed_at,
                o.message                           AS message,
                (
                    SELECT ARRAY(
                        SELECT DISTINCT k FROM (
                            -- keys present in current where value changed (or key is new)
                            SELECT e.key AS k
                            FROM jsonb_each(o.cur) e
                            WHERE o.prev IS NULL
                               OR (o.prev ? e.key) IS FALSE
                               OR (o.prev -> e.key) IS DISTINCT FROM e.value

                            UNION ALL

                            -- keys removed in current (present in prev but missing in cur)
                            SELECT e2.key AS k
                            FROM jsonb_each(o.prev) e2
                            WHERE o.prev IS NOT NULL
                              AND (o.cur ? e2.key) IS FALSE
                        ) u
                        ORDER BY k
                    )
                ) AS changed_fields
            FROM ordered o
            ORDER BY o.commit_id
        """;

        return dbClient.sql(sql)
            .bind("entityId", entityId)
            .map((row, meta) -> {
                Long commitId = row.get("commit_id", Long.class);
                String author = row.get("author_id", String.class);
                LocalDateTime ts = row.get("committed_at", LocalDateTime.class);
                String msg = row.get("message", String.class);

                String[] changed = row.get("changed_fields", String[].class);
                List<String> changedFields = changed == null ? Collections.emptyList() : Arrays.asList(changed);

                return new HistoryEvent(
                    commitId == null ? null : String.valueOf(commitId),
                    author,
                    ts,
                    msg,
                    changedFields
                );
            })
            .all();
    }
}
