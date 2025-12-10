package org.logrum.ubos.kernel.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.model.LcmEnvironmentConfig;
import org.logrum.ubos.kernel.repository.LcmEnvironmentRepository;
import org.logrum.ubos.kernel.util.ReactiveRetry;
import org.logrum.ubos.web.console.dto.EnvironmentConfigDto;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Service for managing environment configurations.
 * Provides CRUD operations and environment resolution logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LcmEnvironmentService {

    private final LcmEnvironmentRepository envRepo;
    private final DatabaseClient dbClient;

    private final Retry retryPolicy = ReactiveRetry.databaseTransientErrors();

    /**
     * Get all environment configurations.
     *
     * @return Flux of all environment configurations
     */
    public Flux<LcmEnvironmentConfig> findAll() {
        return envRepo.findAllOrdered()
            .retryWhen(retryPolicy);
    }

    /**
     * Get a specific environment configuration by name.
     *
     * @param envName the environment name
     * @return Mono of the environment configuration, or empty if not found
     */
    public Mono<LcmEnvironmentConfig> findByName(String envName) {
        return envRepo.findById(envName.toUpperCase())
            .retryWhen(retryPolicy);
    }

    /**
     * Save (create or update) an environment configuration.
     *
     * @param dto the environment configuration DTO
     * @return Mono of the saved environment configuration
     */
    @Transactional
    public Mono<LcmEnvironmentConfig> save(EnvironmentConfigDto dto) {
        String envName = dto.envName().toUpperCase();
        
        log.info("💾 Saving environment config: {}", envName);

        return envRepo.existsById(envName)
            .flatMap(exists -> {
                LcmEnvironmentConfig config = LcmEnvironmentConfig.builder()
                    .envName(envName)
                    .mappedBranch(dto.resolvedBranch())
                    .mappedCommitId(dto.mappedCommitId())
                    .description(dto.description())
                    .updatedAt(LocalDateTime.now())
                    .build();

                if (exists) {
                    // Update existing - use DatabaseClient for upsert
                    return updateEnvironment(config);
                } else {
                    // Insert new
                    config.markAsNew();
                    return envRepo.save(config);
                }
            })
            .doOnSuccess(saved -> log.info("✅ Environment '{}' saved successfully", saved.getEnvName()))
            .retryWhen(retryPolicy);
    }

    /**
     * Update an existing environment configuration.
     */
    private Mono<LcmEnvironmentConfig> updateEnvironment(LcmEnvironmentConfig config) {
        String sql = """
            UPDATE sys_environment_config 
            SET mapped_branch = :branch, 
                mapped_commit_id = :commitId, 
                description = :description, 
                updated_at = :updatedAt
            WHERE env_name = :envName
        """;

        return dbClient.sql(sql)
            .bind("envName", config.getEnvName())
            .bind("branch", config.getMappedBranch())
            .bindNull("commitId", Long.class)
            .bind("description", config.getDescription() != null ? config.getDescription() : "")
            .bind("updatedAt", config.getUpdatedAt())
            .then()
            .then(Mono.defer(() -> {
                // Handle nullable commitId separately
                if (config.getMappedCommitId() != null) {
                    return dbClient.sql("UPDATE sys_environment_config SET mapped_commit_id = :commitId WHERE env_name = :envName")
                        .bind("commitId", config.getMappedCommitId())
                        .bind("envName", config.getEnvName())
                        .then();
                }
                return Mono.empty();
            }))
            .thenReturn(config);
    }

    /**
     * Delete an environment configuration.
     *
     * @param envName the environment name to delete
     * @return Mono<Void>
     */
    @Transactional
    public Mono<Void> delete(String envName) {
        log.info("🗑️ Deleting environment config: {}", envName);
        return envRepo.deleteById(envName.toUpperCase())
            .retryWhen(retryPolicy);
    }

    /**
     * Resolve the active commit ID for a given environment.
     * 
     * <p>Resolution logic:
     * <ol>
     *   <li>If mappedCommitId is set, return it directly (pinned commit)</li>
     *   <li>Otherwise, return null to indicate "use branch HEAD"</li>
     * </ol>
     *
     * @param envName the environment name
     * @return Mono containing resolution result with commit ID and branch info
     */
    public Mono<Map<String, Object>> resolveActiveCommit(String envName) {
        log.debug("🔍 Resolving active commit for environment: {}", envName);

        return findByName(envName)
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                "Environment not found: " + envName)))
            .map(config -> {
                Map<String, Object> result = new java.util.LinkedHashMap<>();
                result.put("envName", config.getEnvName());
                result.put("mappedBranch", config.getMappedBranch());
                result.put("description", config.getDescription());
                
                if (config.getMappedCommitId() != null) {
                    // Pinned to specific commit
                    result.put("resolvedCommitId", config.getMappedCommitId());
                    result.put("resolutionMode", "PINNED");
                    result.put("message", String.format(
                        "Environment '%s' is pinned to commit %d", 
                        config.getEnvName(), config.getMappedCommitId()));
                } else {
                    // Use branch HEAD
                    result.put("resolvedCommitId", null);
                    result.put("resolutionMode", "BRANCH_HEAD");
                    result.put("message", String.format(
                        "Environment '%s' uses HEAD of branch '%s'", 
                        config.getEnvName(), config.getMappedBranch()));
                }
                
                return result;
            });
    }

    /**
     * Resolve the active commit ID for a specific entity in an environment.
     * 
     * @param envName    the environment name
     * @param entityType the entity type
     * @param slug       the entity slug
     * @return Mono containing the resolved commit ID (null if using branch HEAD)
     */
    public Mono<Long> resolveEntityCommit(String envName, String entityType, String slug) {
        return findByName(envName)
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                "Environment not found: " + envName)))
            .flatMap(config -> {
                if (config.getMappedCommitId() != null) {
                    // Environment is pinned to a global commit
                    // This is a simplified approach - in reality you might want to
                    // resolve the entity's state at that commit
                    return Mono.just(config.getMappedCommitId());
                }
                // Return empty to indicate "use branch HEAD"
                return Mono.empty();
            });
    }

    /**
     * Get all environments that are currently using a specific branch.
     *
     * @param branch the branch name
     * @return Flux of environment configurations
     */
    public Flux<LcmEnvironmentConfig> findByBranch(String branch) {
        return envRepo.findByMappedBranch(branch)
            .retryWhen(retryPolicy);
    }

    /**
     * Pin an environment to a specific commit.
     *
     * @param envName  the environment name
     * @param commitId the commit ID to pin to
     * @return Mono of the updated environment configuration
     */
    @Transactional
    public Mono<LcmEnvironmentConfig> pinToCommit(String envName, Long commitId) {
        log.info("📌 Pinning environment '{}' to commit {}", envName, commitId);

        String sql = """
            UPDATE sys_environment_config 
            SET mapped_commit_id = :commitId, updated_at = NOW()
            WHERE env_name = :envName
        """;

        return dbClient.sql(sql)
            .bind("envName", envName.toUpperCase())
            .bind("commitId", commitId)
            .fetch()
            .rowsUpdated()
            .flatMap(rows -> {
                if (rows == 0) {
                    return Mono.error(new IllegalArgumentException(
                        "Environment not found: " + envName));
                }
                return findByName(envName);
            })
            .doOnSuccess(config -> log.info("✅ Environment '{}' pinned to commit {}", envName, commitId))
            .retryWhen(retryPolicy);
    }

    /**
     * Unpin an environment (revert to using branch HEAD).
     *
     * @param envName the environment name
     * @return Mono of the updated environment configuration
     */
    @Transactional
    public Mono<LcmEnvironmentConfig> unpinFromCommit(String envName) {
        log.info("📌 Unpinning environment '{}' (will use branch HEAD)", envName);

        String sql = """
            UPDATE sys_environment_config 
            SET mapped_commit_id = NULL, updated_at = NOW()
            WHERE env_name = :envName
        """;

        return dbClient.sql(sql)
            .bind("envName", envName.toUpperCase())
            .fetch()
            .rowsUpdated()
            .flatMap(rows -> {
                if (rows == 0) {
                    return Mono.error(new IllegalArgumentException(
                        "Environment not found: " + envName));
                }
                return findByName(envName);
            })
            .doOnSuccess(config -> log.info("✅ Environment '{}' unpinned", envName))
            .retryWhen(retryPolicy);
    }
}
