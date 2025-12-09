package org.logrum.ubos.kernel.repository;

import org.logrum.ubos.kernel.model.LcmEntityVersionChain;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface LcmVersionRepository extends R2dbcRepository<LcmEntityVersionChain, Long> {

    
    @Query("""
        SELECT v.* FROM lcm_entity_version_chain v
        JOIN lcm_entity_branch_head h ON v.commit_id = h.head_commit_id
        WHERE h.entity_id = :entityId AND h.branch_name = :branchName
    """)
    Mono<LcmEntityVersionChain> findHeadSnapshot(String entityId, String branchName);
}