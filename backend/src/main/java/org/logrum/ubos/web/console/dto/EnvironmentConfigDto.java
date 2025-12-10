package org.logrum.ubos.web.console.dto;

import org.logrum.ubos.kernel.model.LcmEnvironmentConfig;

import java.time.LocalDateTime;

/**
 * DTO for environment configuration requests and responses.
 *
 * @param envName        the environment name (e.g., "UAT", "PROD") - required
 * @param mappedBranch   the default branch for this environment (defaults to "master")
 * @param mappedCommitId optional: pin to a specific commit for stable testing
 * @param description    description of the environment
 * @param updatedAt      timestamp of the last update (read-only, set by server)
 */
public record EnvironmentConfigDto(
    String envName,
    String mappedBranch,
    Long mappedCommitId,
    String description,
    LocalDateTime updatedAt
) {
    /**
     * Returns the resolved branch, defaulting to "master" if not provided.
     */
    public String resolvedBranch() {
        return (mappedBranch == null || mappedBranch.isBlank()) ? "master" : mappedBranch;
    }

    /**
     * Creates a DTO from an entity.
     *
     * @param entity the environment config entity
     * @return a new DTO instance
     */
    public static EnvironmentConfigDto fromEntity(LcmEnvironmentConfig entity) {
        return new EnvironmentConfigDto(
            entity.getEnvName(),
            entity.getMappedBranch(),
            entity.getMappedCommitId(),
            entity.getDescription(),
            entity.getUpdatedAt()
        );
    }

    /**
     * Checks if this environment is pinned to a specific commit.
     */
    public boolean isPinned() {
        return mappedCommitId != null;
    }
}
