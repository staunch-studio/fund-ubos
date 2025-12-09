package org.logrum.ubos.kernel.model;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import java.math.BigDecimal;

@Data
@Builder
@Table("lcm_entity_search_index")
public class LcmEntitySearchIndex {
    @Id
    private Long id;
    private Long commitId;
    private String propName;
    private String valText;
    private BigDecimal valNum;
}