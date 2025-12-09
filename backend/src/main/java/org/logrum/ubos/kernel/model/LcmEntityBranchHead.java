package org.logrum.ubos.kernel.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.relational.core.mapping.Table;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Table("lcm_entity_branch_head")
public class LcmEntityBranchHead {
    private String entityId;
    private String branchName;
    private Long headCommitId;
    private LocalDateTime updatedAt;
}