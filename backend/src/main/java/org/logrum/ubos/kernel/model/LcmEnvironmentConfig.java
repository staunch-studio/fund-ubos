package org.logrum.ubos.kernel.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

/**
 * Entity representing environment configuration mapping.
 * Maps running environments (UAT, PROD, etc.) to specific UBOS states.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("sys_environment_config")
public class LcmEnvironmentConfig implements Persistable<String> {

    /**
     * Environment name (e.g., "UAT", "PROD", "DEV").
     * This is the primary key.
     */
    @Id
    @Column("env_name")
    private String envName;

    /**
     * The default branch for this environment.
     */
    @Column("mapped_branch")
    private String mappedBranch;

    /**
     * Optional: Pin to a specific commit ID for stable testing.
     * If null, the environment uses the HEAD of the mapped branch.
     */
    @Column("mapped_commit_id")
    private Long mappedCommitId;

    /**
     * Description of the environment.
     */
    private String description;

    /**
     * Timestamp of the last update.
     */
    @Column("updated_at")
    private LocalDateTime updatedAt;

    /**
     * Flag to indicate if this is a new entity (for R2DBC insert/update logic).
     */
    @Transient
    private boolean isNew;

    @Override
    public String getId() {
        return envName;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    /**
     * Mark this entity as new for insertion.
     */
    public void markAsNew() {
        this.isNew = true;
    }
}
