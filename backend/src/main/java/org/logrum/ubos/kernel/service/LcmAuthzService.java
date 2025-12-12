package org.logrum.ubos.kernel.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.util.UbosUriUtil;
import org.logrum.ubos.web.console.dto.GroupPayload;
import org.logrum.ubos.web.console.dto.PolicyPayload;
import org.logrum.ubos.web.console.dto.UserPayload;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Authorization service for checking user permissions.
 * 
 * <p>This service evaluates access control based on:
 * <ol>
 *   <li>User's group memberships</li>
 *   <li>Roles assigned to those groups</li>
 *   <li>Policy rules associated with those groups</li>
 * </ol>
 * 
 * <p>Permission evaluation flow:
 * <pre>
 * User -> Groups -> Roles + Policies -> Permission Decision
 * </pre>
 * 
 * <p>Default behavior (when no users/policies exist):
 * All operations are permitted to allow initial system setup.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LcmAuthzService {

    private final LcmUserService userService;

    // Standard actions
    public static final String ACTION_COMMIT = PolicyPayload.ACTION_COMMIT;
    public static final String ACTION_REVERT = PolicyPayload.ACTION_REVERT;
    public static final String ACTION_MERGE = PolicyPayload.ACTION_MERGE;
    public static final String ACTION_READ = PolicyPayload.ACTION_READ;
    public static final String ACTION_APPROVE = PolicyPayload.ACTION_APPROVE;
    public static final String ACTION_DELETE = PolicyPayload.ACTION_DELETE;
    public static final String ACTION_CREATE_BRANCH = PolicyPayload.ACTION_CREATE_BRANCH;

    // Role-based permission mapping
    private static final Set<String> ADMIN_ACTIONS = Set.of(
        ACTION_COMMIT, ACTION_REVERT, ACTION_MERGE, ACTION_READ, 
        ACTION_APPROVE, ACTION_DELETE, ACTION_CREATE_BRANCH
    );
    private static final Set<String> EDITOR_ACTIONS = Set.of(
        ACTION_COMMIT, ACTION_REVERT, ACTION_MERGE, ACTION_READ
    );
    private static final Set<String> VIEWER_ACTIONS = Set.of(
        ACTION_READ
    );
    private static final Set<String> APPROVER_ACTIONS = Set.of(
        ACTION_READ, ACTION_APPROVE
    );

    /**
     * Get the current user's identity.
     * 
     * <p>Placeholder implementation until actual authentication is integrated.
     * Currently returns a simulated admin user for development.
     *
     * @return the current user's username
     */
    public Mono<String> getCurrentUser() {
        // TODO: Integrate with actual authentication (e.g., Spring Security)
        // For now, return a simulated user or extract from SecurityContext
        return Mono.just("system");
    }

    /**
     * Check if a user is permitted to perform an action on a resource.
     *
     * <p>Permission evaluation order:
     * <ol>
     *   <li>If user not found and no users exist -> ALLOW (bootstrap mode)</li>
     *   <li>Check role-based permissions (ADMIN, EDITOR, VIEWER, APPROVER)</li>
     *   <li>Evaluate policy rules (DENY takes precedence)</li>
     * </ol>
     *
     * @param userId    the user's identifier (username)
     * @param action    the action to perform (COMMIT, REVERT, MERGE, etc.)
     * @param uriString the UBOS URI of the target resource
     * @return true if permitted, false otherwise
     */
    public Mono<Boolean> isPermitted(String userId, String action, String uriString) {
        log.debug("🔐 Checking permission: user={}, action={}, uri={}", userId, action, uriString);

        // Parse URI to extract details
        String entityType;
        String branch;
        try {
            var uriDetails = UbosUriUtil.parse(uriString);
            entityType = uriDetails.type();
            branch = uriDetails.branch();
        } catch (Exception e) {
            // If URI parsing fails, use defaults
            entityType = "*";
            branch = "master";
        }

        final String finalEntityType = entityType;
        final String finalBranch = branch;

        return userService.getUser(userId)
            .flatMap(user -> evaluateUserPermission(user, action, uriString, finalEntityType, finalBranch))
            .switchIfEmpty(Mono.defer(() -> {
                // User not found - check if we're in bootstrap mode (no users exist)
                return userService.getAllUsers()
                    .count()
                    .map(count -> {
                        if (count == 0) {
                            log.info("🔓 Bootstrap mode: No users exist, allowing all operations");
                            return true;
                        }
                        log.warn("🔒 User '{}' not found, denying access", userId);
                        return false;
                    });
            }))
            .doOnNext(permitted -> log.debug("🔐 Permission result: user={}, action={}, permitted={}", 
                userId, action, permitted));
    }

    /**
     * Evaluate permission for a specific user.
     */
    private Mono<Boolean> evaluateUserPermission(UserPayload user, String action, 
                                                   String uriString, String entityType, String branch) {
        if (user.enabled() != null && !user.enabled()) {
            log.warn("🔒 User '{}' is disabled", user.username());
            return Mono.just(false);
        }

        // Get all groups and their roles/policies
        return userService.getGroupsForUser(user.username())
            .collectList()
            .flatMap(groups -> {
                // First, check role-based permissions
                boolean rolePermitted = evaluateRoleBasedPermission(groups, action);
                
                if (!rolePermitted) {
                    return Mono.just(false);
                }

                // Then, evaluate detailed policies
                return evaluatePolicies(groups, action, uriString, entityType, branch);
            });
    }

    /**
     * Evaluate permission based on group roles.
     */
    private boolean evaluateRoleBasedPermission(List<GroupPayload> groups, String action) {
        for (GroupPayload group : groups) {
            if (group.roles() == null) continue;

            for (String role : group.roles()) {
                Set<String> allowedActions = switch (role.toUpperCase()) {
                    case "ADMIN" -> ADMIN_ACTIONS;
                    case "EDITOR" -> EDITOR_ACTIONS;
                    case "VIEWER" -> VIEWER_ACTIONS;
                    case "APPROVER" -> APPROVER_ACTIONS;
                    default -> Set.of();
                };

                if (allowedActions.contains(action)) {
                    log.debug("🔓 Role '{}' permits action '{}'", role, action);
                    return true;
                }
            }
        }
        
        log.debug("🔒 No role permits action '{}'", action);
        return false;
    }

    /**
     * Evaluate detailed policy rules.
     */
    private Mono<Boolean> evaluatePolicies(List<GroupPayload> groups, String action, 
                                            String uriString, String entityType, String branch) {
        // Collect all policy names from all groups
        return Flux.fromIterable(groups)
            .flatMap(group -> Flux.fromIterable(group.policies() != null ? group.policies() : List.of()))
            .distinct()
            .flatMap(userService::getPolicy)
            .filter(policy -> policy.enabled() != null && policy.enabled())
            .sort(Comparator.comparing(PolicyPayload::priority).reversed()) // Higher priority first
            .collectList()
            .map(policies -> {
                if (policies.isEmpty()) {
                    // No policies defined - rely on role-based permissions only
                    return true;
                }

                // Evaluate policies - DENY takes precedence
                Boolean result = null;
                for (PolicyPayload policy : policies) {
                    for (PolicyPayload.PolicyRule rule : policy.rules()) {
                        if (!rule.matchesAction(action)) continue;
                        if (!rule.matchesResource(uriString)) continue;
                        
                        // Check conditions
                        if (rule.conditions() != null) {
                            if (!rule.conditions().matchesBranch(branch)) continue;
                            if (!rule.conditions().matchesEntityType(entityType)) continue;
                        }

                        // Rule matches
                        if (!rule.isAllow()) {
                            log.debug("🔒 Policy '{}' DENIES action '{}' on '{}'", 
                                policy.policyName(), action, uriString);
                            return false; // Explicit DENY - immediate rejection
                        } else {
                            result = true; // ALLOW found, but continue checking for DENYs
                        }
                    }
                }

                return result != null ? result : true;
            });
    }

    /**
     * Check if a user has a specific role (directly or through groups).
     *
     * @param userId the user's identifier
     * @param role   the role to check
     * @return true if user has the role
     */
    public Mono<Boolean> hasRole(String userId, String role) {
        return userService.getUser(userId)
            .flatMapMany(user -> userService.getGroupsForUser(user.username()))
            .any(group -> group.hasRole(role))
            .defaultIfEmpty(false);
    }

    /**
     * Check if a user is an admin.
     *
     * @param userId the user's identifier
     * @return true if user is admin
     */
    public Mono<Boolean> isAdmin(String userId) {
        return hasRole(userId, GroupPayload.ROLE_ADMIN);
    }

    /**
     * Build a UBOS URI for permission checking.
     *
     * @param entityType the entity type
     * @param slug       the entity slug
     * @param branch     the branch name
     * @return the constructed URI string
     */
    public static String buildUri(String entityType, String slug, String branch) {
        return String.format("ubos://%s/%s?branch=%s", 
            entityType.toLowerCase(), slug, branch != null ? branch : "master");
    }
}
