package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Payload for POLICY entity stored in the Version Chain.
 * 
 * <p>Policy entities define fine-grained access control rules:
 * <ul>
 *   <li>Entity Type: 'POLICY'</li>
 *   <li>Slug: policyName (unique identifier)</li>
 * </ul>
 * 
 * <p>Policy rules format (JSON string defining permissions):
 * <pre>
 * {
 *   "effect": "ALLOW" | "DENY",
 *   "actions": ["COMMIT", "REVERT", "MERGE", "READ", "APPROVE"],
 *   "resources": ["ubos://logic/*", "ubos://*tax-calc"],
 *   "conditions": {
 *     "branch": ["master", "develop"],
 *     "entityType": ["LOGIC", "CONFIG"]
 *   }
 * }
 * </pre>
 *
 * @param policyName  unique policy identifier (slug)
 * @param description policy description
 * @param rules       list of permission rules
 * @param priority    evaluation priority (higher = evaluated first)
 * @param enabled     whether the policy is active
 * @param createdAt   when the policy was created
 * @param metadata    additional policy metadata
 */
public record PolicyPayload(
    String policyName,
    String description,
    List<PolicyRule> rules,
    Integer priority,
    Boolean enabled,
    LocalDateTime createdAt,
    java.util.Map<String, Object> metadata
) {
    // Actions
    public static final String ACTION_COMMIT = "COMMIT";
    public static final String ACTION_REVERT = "REVERT";
    public static final String ACTION_MERGE = "MERGE";
    public static final String ACTION_READ = "READ";
    public static final String ACTION_APPROVE = "APPROVE";
    public static final String ACTION_DELETE = "DELETE";
    public static final String ACTION_CREATE_BRANCH = "CREATE_BRANCH";

    // Effects
    public static final String EFFECT_ALLOW = "ALLOW";
    public static final String EFFECT_DENY = "DENY";

    /**
     * Default constructor with reasonable defaults.
     */
    public PolicyPayload {
        if (rules == null) {
            rules = List.of();
        }
        if (priority == null) {
            priority = 0;
        }
        if (enabled == null) {
            enabled = true;
        }
    }

    /**
     * Create a simple allow-all policy.
     */
    public static PolicyPayload allowAll(String policyName) {
        return new PolicyPayload(
            policyName,
            "Allow all actions",
            List.of(new PolicyRule(EFFECT_ALLOW, List.of("*"), List.of("*"), null)),
            0,
            true,
            LocalDateTime.now(),
            null
        );
    }

    /**
     * Represents a single permission rule within a policy.
     *
     * @param effect     ALLOW or DENY
     * @param actions    list of actions (COMMIT, REVERT, etc.) or "*" for all
     * @param resources  list of resource patterns (e.g., "ubos://logic/*")
     * @param conditions optional conditions for the rule
     */
    public record PolicyRule(
        String effect,
        List<String> actions,
        List<String> resources,
        PolicyConditions conditions
    ) {
        public PolicyRule {
            if (effect == null) {
                effect = EFFECT_DENY;
            }
            if (actions == null) {
                actions = List.of();
            }
            if (resources == null) {
                resources = List.of();
            }
        }

        /**
         * Check if this rule matches the given action.
         */
        public boolean matchesAction(String action) {
            return actions.contains("*") || actions.contains(action);
        }

        /**
         * Check if this rule matches the given resource URI.
         */
        public boolean matchesResource(String resourceUri) {
            if (resources.contains("*")) {
                return true;
            }
            for (String pattern : resources) {
                if (matchesPattern(pattern, resourceUri)) {
                    return true;
                }
            }
            return false;
        }

        private boolean matchesPattern(String pattern, String uri) {
            // Simple glob-like matching: * matches any sequence
            String regex = pattern
                .replace(".", "\\.")
                .replace("*", ".*")
                .replace("?", ".");
            return uri.matches(regex);
        }

        public boolean isAllow() {
            return EFFECT_ALLOW.equalsIgnoreCase(effect);
        }
    }

    /**
     * Conditions that must be met for a rule to apply.
     *
     * @param branches    allowed branch names
     * @param entityTypes allowed entity types
     * @param timeWindow  time-based conditions (future use)
     */
    public record PolicyConditions(
        List<String> branches,
        List<String> entityTypes,
        java.util.Map<String, Object> timeWindow
    ) {
        public boolean matchesBranch(String branch) {
            return branches == null || branches.isEmpty() || branches.contains(branch);
        }

        public boolean matchesEntityType(String type) {
            return entityTypes == null || entityTypes.isEmpty() || entityTypes.contains(type);
        }
    }
}
