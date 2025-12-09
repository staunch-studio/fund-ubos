package org.logrum.ubos.kernel.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable; 
import org.springframework.data.relational.core.mapping.Table;
import java.time.LocalDateTime;

@Data
@Table("lcm_entity_instance")

public class LcmEntityInstance implements Persistable<String> {
    @Id
    private String id;
    private String entityType;
    private String slug;
    private LocalDateTime createdAt;

    
    @Transient
    private boolean isNewEntity = false;

    
    @Override
    @Transient
    public boolean isNew() {
        return isNewEntity || id == null;
    }
}