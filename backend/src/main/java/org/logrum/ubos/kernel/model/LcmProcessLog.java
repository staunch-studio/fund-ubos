package org.logrum.ubos.kernel.model;
import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import java.time.LocalDateTime;

@Data @Builder
@Table("lcm_process_commit_log")
public class LcmProcessLog {
    @Id private String processId;
    private String processName;
    private String operatorId;
    private LocalDateTime startedAt;
}