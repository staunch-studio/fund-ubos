package org.logrum.ubos.kernel.repository;

import org.logrum.ubos.kernel.model.LcmEnvironmentConfig;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Repository for environment configuration CRUD operations.
 */
@Repository
public interface LcmEnvironmentRepository extends R2dbcRepository<LcmEnvironmentConfig, String> {

    /**
     * Find all environments mapped to a specific branch.
     *
     * @param branch the branch name
     * @return Flux of matching environment configurations
     */
    Flux<LcmEnvironmentConfig> findByMappedBranch(String branch);

    /**
     * Find all environments ordered by name.
     *
     * @return Flux of all environment configurations ordered alphabetically
     */
    @Query("SELECT * FROM sys_environment_config ORDER BY env_name")
    Flux<LcmEnvironmentConfig> findAllOrdered();

    /**
     * Check if an environment exists by name.
     *
     * @param envName the environment name
     * @return Mono<Boolean> true if exists
     */
    Mono<Boolean> existsByEnvName(String envName);
}
