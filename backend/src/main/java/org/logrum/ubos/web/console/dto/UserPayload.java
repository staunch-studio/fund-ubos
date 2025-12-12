package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Payload for USER entity stored in the Version Chain.
 * 
 * <p>User entities are stored with:
 * <ul>
 *   <li>Entity Type: 'USER'</li>
 *   <li>Slug: username (unique identifier)</li>
 * </ul>
 *
 * @param username    unique username identifier
 * @param email       user's email address
 * @param displayName user's display name
 * @param groups      list of group slugs the user belongs to
 * @param enabled     whether the user account is active
 * @param createdAt   when the user was created
 * @param lastLoginAt when the user last logged in
 * @param metadata    additional user metadata
 */
public record UserPayload(
    String username,
    String email,
    String displayName,
    List<String> groups,
    Boolean enabled,
    LocalDateTime createdAt,
    LocalDateTime lastLoginAt,
    java.util.Map<String, Object> metadata
) {
    /**
     * Default constructor with reasonable defaults.
     */
    public UserPayload {
        if (groups == null) {
            groups = List.of();
        }
        if (enabled == null) {
            enabled = true;
        }
    }

    /**
     * Create a minimal user payload.
     */
    public static UserPayload create(String username, String email, List<String> groups) {
        return new UserPayload(
            username,
            email,
            username, // displayName defaults to username
            groups,
            true,
            LocalDateTime.now(),
            null,
            null
        );
    }

    /**
     * Check if the user belongs to a specific group.
     */
    public boolean belongsToGroup(String groupName) {
        return groups != null && groups.contains(groupName);
    }
}
