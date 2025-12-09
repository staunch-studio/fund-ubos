package org.logrum.ubos.common;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthContext {
    private final String userId;
    private final String username;
    private final String role; 
    private final String tenantId; 
}