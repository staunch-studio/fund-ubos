package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Payload for GROUP entity stored in the Version Chain.
 * 
 * <p>Group entities are stored with:
 * <ul>
 *   <li>Entity Type: 'GROUP'</li>
 *   <li>Slug: groupName (unique identifier)</li>
 * </ul>
 * 
 * <p>Roles define what actions group members can perform:
 * <ul>
 *   <li>ADMIN - Full access to all operations</li>
 *   <li>EDITOR - Can commit, merge, and revert</li>
 *   <li>VIEWER - Read-only access</li>
 *   <li>APPROVER - Can approve/reject approval requests</li>
 * </ul>
 *
 * @param groupName   unique group identifier (slug)
 * @param displayName human-readable group name
 * @param description group description
 * @param roles       list of roles assigned to this group
 * @param policies    list of policy slugs that define detailed permissions
 * @param parentGroup optional parent group for hierarchy
 * @param createdAt   when the group was created
 * @param metadata    additional group metadata
 */
public record GroupPayload(
    String groupName,
    String displayName,
    String description,
    List<String> roles,
    List<String> policies,
    String parentGroup,
    LocalDateTime createdAt,
    java.util.Map<String, Object> metadata
) {
    // Standard roles
    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_EDITOR = "EDITOR";
    public static final String ROLE_VIEWER = "VIEWER";
    public static final String ROLE_APPROVER = "APPROVER";

    /**
     * Default constructor with reasonable defaults.
     */
    public GroupPayload {
        if (roles == null) {
            roles = List.of(ROLE_VIEWER);
        }
        if (policies == null) {
            policies = List.of();
        }
    }

    /**
     * Create a minimal group payload.
     */
    public static GroupPayload create(String groupName, List<String> roles) {
        return new GroupPayload(
            groupName,
            groupName,
            null,
            roles,
            List.of(),
            null,
            LocalDateTime.now(),
            null
        );
    }

    /**
     * Check if the group has a specific role.
     */
    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }

    /**
     * Check if the group has admin privileges.
     */
    public boolean isAdmin() {
        return hasRole(ROLE_ADMIN);
    }
}
