package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.repository.LcmEntityRepository;
import org.logrum.ubos.web.console.dto.GroupPayload;
import org.logrum.ubos.web.console.dto.PolicyPayload;
import org.logrum.ubos.web.console.dto.UserPayload;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service for managing USER and GROUP entities in the Version Chain.
 * 
 * <p>This service provides CRUD operations for identity entities:
 * <ul>
 *   <li>USER entities (entityType='USER', slug=username)</li>
 *   <li>GROUP entities (entityType='GROUP', slug=groupName)</li>
 *   <li>POLICY entities (entityType='POLICY', slug=policyName)</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LcmUserService {

    public static final String ENTITY_TYPE_USER = "USER";
    public static final String ENTITY_TYPE_GROUP = "GROUP";
    public static final String ENTITY_TYPE_POLICY = "POLICY";
    
    private static final String DEFAULT_BRANCH = "master";
    private static final String SYSTEM_AUTHOR = "system";

    private final LcmKernelService kernelService;
    private final LcmEntityRepository entityRepo;
    private final ObjectMapper objectMapper;

    // ==================== User Operations ====================

    /**
     * Create or update a user entity.
     *
     * @param payload the user payload
     * @param author  who is creating/updating this user
     * @return the commit ID
     */
    public Mono<Long> saveUser(UserPayload payload, String author) {
        if (payload.username() == null || payload.username().isBlank()) {
            return Mono.error(new IllegalArgumentException("username is required"));
        }

        log.info("👤 Saving user: {}", payload.username());

        try {
            String jsonContent = objectMapper.writeValueAsString(payload);
            return kernelService.commit(
                ENTITY_TYPE_USER,
                payload.username(),
                DEFAULT_BRANCH,
                jsonContent,
                author != null ? author : SYSTEM_AUTHOR,
                "User updated: " + payload.username()
            );
        } catch (JsonProcessingException e) {
            return Mono.error(new IllegalArgumentException("Failed to serialize user: " + e.getMessage()));
        }
    }

    /**
     * Get a user by username.
     *
     * @param username the username (slug)
     * @return the user payload
     */
    public Mono<UserPayload> getUser(String username) {
        return kernelService.getResourceSnapshot(ENTITY_TYPE_USER, username, DEFAULT_BRANCH)
            .flatMap(json -> {
                try {
                    return Mono.just(objectMapper.readValue(json, UserPayload.class));
                } catch (JsonProcessingException e) {
                    log.error("Failed to parse user JSON for {}: {}", username, e.getMessage());
                    return Mono.error(new IllegalStateException("Invalid user data"));
                }
            });
    }

    /**
     * Get all users.
     *
     * @return stream of user payloads
     */
    public Flux<UserPayload> getAllUsers() {
        return entityRepo.findAll()
            .filter(e -> ENTITY_TYPE_USER.equalsIgnoreCase(e.getEntityType()))
            .flatMap(entity -> getUser(entity.getSlug()));
    }

    /**
     * Delete a user (creates a tombstone version).
     *
     * @param username the username to delete
     * @param author   who is deleting
     * @return the commit ID
     */
    public Mono<Long> deleteUser(String username, String author) {
        log.info("🗑️ Deleting user: {}", username);
        
        // Create a tombstone record
        UserPayload tombstone = new UserPayload(
            username, null, null, List.of(), false, null, null, 
            java.util.Map.of("deleted", true, "deletedAt", LocalDateTime.now().toString())
        );
        
        try {
            String jsonContent = objectMapper.writeValueAsString(tombstone);
            return kernelService.commit(
                ENTITY_TYPE_USER,
                username,
                DEFAULT_BRANCH,
                jsonContent,
                author,
                "User deleted: " + username
            );
        } catch (JsonProcessingException e) {
            return Mono.error(new IllegalArgumentException("Failed to serialize tombstone: " + e.getMessage()));
        }
    }

    // ==================== Group Operations ====================

    /**
     * Create or update a group entity.
     *
     * @param payload the group payload
     * @param author  who is creating/updating this group
     * @return the commit ID
     */
    public Mono<Long> saveGroup(GroupPayload payload, String author) {
        if (payload.groupName() == null || payload.groupName().isBlank()) {
            return Mono.error(new IllegalArgumentException("groupName is required"));
        }

        log.info("👥 Saving group: {}", payload.groupName());

        try {
            String jsonContent = objectMapper.writeValueAsString(payload);
            return kernelService.commit(
                ENTITY_TYPE_GROUP,
                payload.groupName(),
                DEFAULT_BRANCH,
                jsonContent,
                author != null ? author : SYSTEM_AUTHOR,
                "Group updated: " + payload.groupName()
            );
        } catch (JsonProcessingException e) {
            return Mono.error(new IllegalArgumentException("Failed to serialize group: " + e.getMessage()));
        }
    }

    /**
     * Get a group by name.
     *
     * @param groupName the group name (slug)
     * @return the group payload
     */
    public Mono<GroupPayload> getGroup(String groupName) {
        return kernelService.getResourceSnapshot(ENTITY_TYPE_GROUP, groupName, DEFAULT_BRANCH)
            .flatMap(json -> {
                try {
                    return Mono.just(objectMapper.readValue(json, GroupPayload.class));
                } catch (JsonProcessingException e) {
                    log.error("Failed to parse group JSON for {}: {}", groupName, e.getMessage());
                    return Mono.error(new IllegalStateException("Invalid group data"));
                }
            });
    }

    /**
     * Get all groups.
     *
     * @return stream of group payloads
     */
    public Flux<GroupPayload> getAllGroups() {
        return entityRepo.findAll()
            .filter(e -> ENTITY_TYPE_GROUP.equalsIgnoreCase(e.getEntityType()))
            .flatMap(entity -> getGroup(entity.getSlug()));
    }

    /**
     * Get groups for a specific user.
     *
     * @param username the username
     * @return stream of group payloads the user belongs to
     */
    public Flux<GroupPayload> getGroupsForUser(String username) {
        return getUser(username)
            .flatMapMany(user -> Flux.fromIterable(user.groups()))
            .flatMap(this::getGroup);
    }

    // ==================== Policy Operations ====================

    /**
     * Create or update a policy entity.
     *
     * @param payload the policy payload
     * @param author  who is creating/updating this policy
     * @return the commit ID
     */
    public Mono<Long> savePolicy(PolicyPayload payload, String author) {
        if (payload.policyName() == null || payload.policyName().isBlank()) {
            return Mono.error(new IllegalArgumentException("policyName is required"));
        }

        log.info("📋 Saving policy: {}", payload.policyName());

        try {
            String jsonContent = objectMapper.writeValueAsString(payload);
            return kernelService.commit(
                ENTITY_TYPE_POLICY,
                payload.policyName(),
                DEFAULT_BRANCH,
                jsonContent,
                author != null ? author : SYSTEM_AUTHOR,
                "Policy updated: " + payload.policyName()
            );
        } catch (JsonProcessingException e) {
            return Mono.error(new IllegalArgumentException("Failed to serialize policy: " + e.getMessage()));
        }
    }

    /**
     * Get a policy by name.
     *
     * @param policyName the policy name (slug)
     * @return the policy payload
     */
    public Mono<PolicyPayload> getPolicy(String policyName) {
        return kernelService.getResourceSnapshot(ENTITY_TYPE_POLICY, policyName, DEFAULT_BRANCH)
            .flatMap(json -> {
                try {
                    return Mono.just(objectMapper.readValue(json, PolicyPayload.class));
                } catch (JsonProcessingException e) {
                    log.error("Failed to parse policy JSON for {}: {}", policyName, e.getMessage());
                    return Mono.error(new IllegalStateException("Invalid policy data"));
                }
            });
    }

    /**
     * Get all policies.
     *
     * @return stream of policy payloads
     */
    public Flux<PolicyPayload> getAllPolicies() {
        return entityRepo.findAll()
            .filter(e -> ENTITY_TYPE_POLICY.equalsIgnoreCase(e.getEntityType()))
            .flatMap(entity -> getPolicy(entity.getSlug()));
    }

    /**
     * Get policies for a specific group.
     *
     * @param groupName the group name
     * @return stream of policy payloads assigned to the group
     */
    public Flux<PolicyPayload> getPoliciesForGroup(String groupName) {
        return getGroup(groupName)
            .flatMapMany(group -> Flux.fromIterable(group.policies()))
            .flatMap(this::getPolicy);
    }
}
