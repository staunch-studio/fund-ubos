package org.logrum.ubos.kernel.repository;

import org.logrum.ubos.kernel.model.LcmEntityInstance;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface LcmEntityRepository extends R2dbcRepository<LcmEntityInstance, String> {
    
    Mono<LcmEntityInstance> findByEntityTypeAndSlug(String entityType, String slug);
}