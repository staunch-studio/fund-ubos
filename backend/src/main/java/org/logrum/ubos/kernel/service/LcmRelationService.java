package org.logrum.ubos.kernel.service;

import org.logrum.ubos.kernel.model.LcmEntityInstance;
import org.logrum.ubos.kernel.repository.LcmEntityRepository;
import org.logrum.ubos.kernel.util.ReactiveRetry; 
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class LcmRelationService {

    private final DatabaseClient dbClient;
    private final LcmEntityRepository entityRepository;

    public Mono<Void> createRelation(String sourceSlug, String targetSlug, String relationType) {

        
        Mono<String> sourceIdMono = dbClient.sql("SELECT id FROM lcm_entity_instance WHERE slug = :slug")
            .bind("slug", sourceSlug).fetch().one().map(r -> (String)r.get("id"))
            .retryWhen(ReactiveRetry.databaseTransientErrors()); 

        Mono<String> targetIdMono = dbClient.sql("SELECT id FROM lcm_entity_instance WHERE slug = :slug")
            .bind("slug", targetSlug).fetch().one().map(r -> (String)r.get("id"))
            .retryWhen(ReactiveRetry.databaseTransientErrors()); 

        
        return Mono.zip(sourceIdMono, targetIdMono)
            .flatMap(tuple -> {
                String sql = """
                        INSERT INTO lcm_entity_relation (source_entity_id, target_entity_id, relation_type)
                        VALUES (:srcId, :tgtId, :relType)
                    """;
                return dbClient.sql(sql)
                    .bind("srcId", tuple.getT1())
                    .bind("tgtId", tuple.getT2())
                    .bind("relType", relationType)
                    .then()
                    .retryWhen(ReactiveRetry.databaseTransientErrors()); 
            })
            .switchIfEmpty(Mono.error(new RuntimeException("Source or Target entity not found for relation. Entity Slugs must exist before linking.")));
    }

    public Flux<String> getRelatedEntities(String sourceSlug, String relationType) {

        String sql = """
            SELECT T.slug 
            FROM lcm_entity_relation R
            JOIN lcm_entity_instance S ON R.source_entity_id = S.id
            JOIN lcm_entity_instance T ON R.target_entity_id = T.id
            WHERE S.slug = :srcSlug AND R.relation_type = :relType
        """;

        return dbClient.sql(sql)
            .bind("srcSlug", sourceSlug)
            .bind("relType", relationType)
            .map((row, meta) -> row.get("slug", String.class))
            .all()
            .retryWhen(ReactiveRetry.databaseTransientErrors()) 
            .filter(Objects::nonNull)
            .distinct()
            .onErrorResume(e -> {
                log.error("Failed to query relations.", e);
                return Flux.empty();
            });
    }
}