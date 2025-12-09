package org.logrum.ubos.kernel.repository;

import org.logrum.ubos.kernel.model.LcmEntitySearchIndex;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LcmSearchIndexRepository extends R2dbcRepository<LcmEntitySearchIndex, Long> {
    
}