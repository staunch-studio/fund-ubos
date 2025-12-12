
package org.logrum.ubos.kernel.util;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Utility class for parsing and building canonical UBOS URIs.
 * <p>
 * The UBOS URI format follows the pattern: 
 * {@code ubos://{scope}/{entity_type}/{entity_id}?{modifiers}}
 * <p>
 * Components:
 * <ul>
 *   <li><b>Scheme:</b> Always {@code ubos}</li>
 *   <li><b>Scope:</b> The Tenant ID or App ID (e.g., "default", "tenant_01", "app_core")</li>
 *   <li><b>Type:</b> The entity type (e.g., "logic", "user", "config")</li>
 *   <li><b>Slug:</b> The unique identifier for the entity (entity_id)</li>
 *   <li><b>Branch:</b> Optional query parameter, defaults to "master"</li>
 *   <li><b>Commit:</b> Optional query parameter for time-travel queries (commit hash/id)</li>
 *   <li><b>Tag:</b> Optional query parameter for release tag</li>
 *   <li><b>Key:</b> Optional query parameter to extract specific property path</li>
 * </ul>
 * <p>
 * Examples:
 * <ul>
 *   <li>{@code ubos://default/logic/tax-calc?branch=master}</li>
 *   <li>{@code ubos://tenant_01/user/user-001?branch=development&commit=12345}</li>
 *   <li>{@code ubos://app_core/config/global_settings?branch=dev&key=feature_flags.ai_enabled}</li>
 * </ul>
 * <p>
 * IMPORTANT: This class does NOT use java.net.URI as ubos:// is a custom protocol.
 *
 * @author UBOS Kernel Team
 * @since 2.0
 */
public final class UbosUriUtil {

    /** The required URI scheme for UBOS resources. */
    public static final String UBOS_SCHEME = "ubos";

    /** The scheme prefix including "://" */
    private static final String SCHEME_PREFIX = UBOS_SCHEME + "://";

    /** The default scope when not specified. */
    public static final String DEFAULT_SCOPE = "default";

    /** The default branch name when not specified. */
    public static final String DEFAULT_BRANCH = "master";

    /** Query parameter key for branch. */
    public static final String PARAM_BRANCH = "branch";

    /** Query parameter key for commit ID (time travel). */
    public static final String PARAM_COMMIT = "commit";

    /** Query parameter key for release tag. */
    public static final String PARAM_TAG = "tag";

    /** Query parameter key for property path extraction. */
    public static final String PARAM_KEY = "key";

    /**
     * Private constructor to prevent instantiation of this utility class.
     */
    private UbosUriUtil() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    /**
     * Data transfer object holding the parsed components of a UBOS URI.
     * <p>
     * This record provides immutable storage for all URI components with built-in
     * validation in the compact constructor.
     *
     * @param scope    the scope/tenant ID (e.g., "default", "tenant_01"), never null or blank
     * @param type     the entity type (e.g., "logic", "user", "config"), never null or blank
     * @param slug     the entity slug/id identifier, never null or blank
     * @param branch   the branch name, defaults to "master" if null or blank
     * @param commitId the optional commit ID for time-travel queries, may be null
     * @param tag      the optional release tag, may be null
     * @param key      the optional property path to extract, may be null
     */
    public record UbosUriDetails(
        String scope,
        String type,
        String slug,
        String branch,
        Long commitId,
        String tag,
        String key
    ) {
        /**
         * Compact constructor with validation and default value assignment.
         *
         * @throws IllegalArgumentException if scope, type, or slug is null or blank
         */
        public UbosUriDetails {
            if (scope == null || scope.isBlank()) {
                scope = DEFAULT_SCOPE;
            }
            if (type == null || type.isBlank()) {
                throw new IllegalArgumentException("Type cannot be null or blank");
            }
            if (slug == null || slug.isBlank()) {
                throw new IllegalArgumentException("Slug cannot be null or blank");
            }
            if (branch == null || branch.isBlank()) {
                branch = DEFAULT_BRANCH;
            }
            // commitId, tag, key can be null (optional)
        }

        /**
         * Convenience constructor with minimal required fields.
         *
         * @param type   the entity type
         * @param slug   the entity slug identifier
         * @param branch the branch name
         */
        public UbosUriDetails(String type, String slug, String branch) {
            this(DEFAULT_SCOPE, type, slug, branch, null, null, null);
        }

        /**
         * Convenience constructor with scope, type, slug, and branch.
         *
         * @param scope  the scope/tenant ID
         * @param type   the entity type
         * @param slug   the entity slug identifier
         * @param branch the branch name
         */
        public UbosUriDetails(String scope, String type, String slug, String branch) {
            this(scope, type, slug, branch, null, null, null);
        }

        /**
         * Checks if this URI details has a specific commit ID for time travel.
         *
         * @return true if a commit ID is present, false otherwise
         */
        public boolean hasCommitId() {
            return commitId != null;
        }

        /**
         * Checks if this URI details has a tag.
         *
         * @return true if a tag is present, false otherwise
         */
        public boolean hasTag() {
            return tag != null && !tag.isBlank();
        }

        /**
         * Checks if this URI details has a key path for property extraction.
         *
         * @return true if a key is present, false otherwise
         */
        public boolean hasKey() {
            return key != null && !key.isBlank();
        }

        /**
         * Builds the URI string representation of this details object.
         *
         * @return the canonical UBOS URI string
         */
        public String toUriString() {
            return UbosUriUtil.build(this);
        }
    }

    /**
     * Parses a UBOS URI string into its component parts using pure string parsing.
     * <p>
     * The URI must follow the format: 
     * {@code ubos://scope/type/slug?branch=name&commit=id&tag=v1&key=path}
     * <p>
     * Parsing rules:
     * <ul>
     *   <li>Scheme must be exactly "ubos" (case-insensitive)</li>
     *   <li>Path must contain at least two segments: type and slug</li>
     *   <li>If three segments: scope/type/slug</li>
     *   <li>If two segments: type/slug (scope defaults to "default")</li>
     *   <li>Branch defaults to "master" if not provided</li>
     *   <li>Commit, tag, and key are optional</li>
     * </ul>
     *
     * @param uriString the full UBOS URI string to parse
     * @return a {@link UbosUriDetails} record containing the parsed components
     * @throws UbosUriParseException if the URI is null, blank, malformed, or has an invalid scheme
     */
    public static UbosUriDetails parse(String uriString) {
        if (uriString == null || uriString.isBlank()) {
            throw new UbosUriParseException("URI cannot be null or blank");
        }

        String trimmed = uriString.trim();

        // Validate and extract scheme
        int schemeEnd = trimmed.indexOf("://");
        if (schemeEnd < 0) {
            throw new UbosUriParseException("Invalid URI format: missing '://' in URI: " + uriString);
        }

        String scheme = trimmed.substring(0, schemeEnd);
        if (!UBOS_SCHEME.equalsIgnoreCase(scheme)) {
            throw new UbosUriParseException(
                "Invalid scheme: expected 'ubos' but got '" + scheme + "' in URI: " + uriString
            );
        }

        // Extract the rest after "ubos://"
        String rest = trimmed.substring(schemeEnd + 3);
        if (rest.isBlank()) {
            throw new UbosUriParseException("Missing path after scheme in URI: " + uriString);
        }

        // Split path and query
        String pathPart;
        String queryPart = null;
        int queryStart = rest.indexOf('?');
        if (queryStart >= 0) {
            pathPart = rest.substring(0, queryStart);
            if (queryStart + 1 < rest.length()) {
                queryPart = rest.substring(queryStart + 1);
            }
        } else {
            pathPart = rest;
        }

        if (pathPart.isBlank()) {
            throw new UbosUriParseException("Missing path in URI: " + uriString);
        }

        // Split path into segments (handle leading slash if present)
        String cleanPath = pathPart.startsWith("/") ? pathPart.substring(1) : pathPart;
        String[] segments = cleanPath.split("/");

        // Filter out empty segments
        segments = filterEmptySegments(segments);

        if (segments.length < 2) {
            throw new UbosUriParseException(
                "Path must contain at least type and slug (e.g., ubos://default/logic/tax-calc), got: " + pathPart
            );
        }

        // Parse segments based on count
        String scope;
        String type;
        String slug;

        if (segments.length >= 3) {
            // Full format: scope/type/slug
            scope = urlDecode(segments[0]);
            type = urlDecode(segments[1]);
            slug = urlDecode(segments[2]);
        } else {
            // Short format: type/slug (scope defaults to "default")
            scope = DEFAULT_SCOPE;
            type = urlDecode(segments[0]);
            slug = urlDecode(segments[1]);
        }

        // Validate extracted values
        if (type.isBlank()) {
            throw new UbosUriParseException("Type cannot be blank in URI: " + uriString);
        }
        if (slug.isBlank()) {
            throw new UbosUriParseException("Slug cannot be blank in URI: " + uriString);
        }

        // Parse query parameters
        Map<String, String> queryParams = parseQueryParams(queryPart);

        // Extract parameters with defaults
        String branch = queryParams.getOrDefault(PARAM_BRANCH, DEFAULT_BRANCH);
        if (branch.isBlank()) {
            branch = DEFAULT_BRANCH;
        }

        // Extract optional commit ID
        Long commitId = null;
        String commitStr = queryParams.get(PARAM_COMMIT);
        if (commitStr != null && !commitStr.isBlank()) {
            try {
                commitId = Long.parseLong(commitStr);
            } catch (NumberFormatException e) {
                throw new UbosUriParseException(
                    "Invalid commit ID format: expected a number but got '" + commitStr + "' in URI: " + uriString,
                    e
                );
            }
        }

        // Extract optional tag
        String tag = queryParams.get(PARAM_TAG);
        if (tag != null && tag.isBlank()) {
            tag = null;
        }

        // Extract optional key
        String key = queryParams.get(PARAM_KEY);
        if (key != null && key.isBlank()) {
            key = null;
        }

        return new UbosUriDetails(scope, type.toLowerCase(), slug, branch, commitId, tag, key);
    }

    /**
     * Builds a UBOS URI string from the given UbosUriDetails.
     *
     * @param details the URI details to build from
     * @return the constructed canonical URI string
     * @throws IllegalArgumentException if details is null
     */
    public static String build(UbosUriDetails details) {
        if (details == null) {
            throw new IllegalArgumentException("Details cannot be null");
        }
        return build(
            details.scope(),
            details.type(),
            details.slug(),
            details.branch(),
            details.commitId(),
            details.tag(),
            details.key()
        );
    }

    /**
     * Builds a UBOS URI string from the given components (minimal version).
     * <p>
     * Constructs a URI in the format: {@code ubos://scope/type/slug?branch=name}
     *
     * @param type   the entity type (e.g., "logic", "user")
     * @param slug   the entity slug identifier
     * @param branch the branch name (defaults to "master" if null or blank)
     * @return the constructed canonical URI string
     * @throws IllegalArgumentException if type or slug is null or blank
     */
    public static String build(String type, String slug, String branch) {
        return build(DEFAULT_SCOPE, type, slug, branch, null, null, null);
    }

    /**
     * Builds a UBOS URI string with scope, type, slug, and branch.
     *
     * @param scope  the scope/tenant ID
     * @param type   the entity type
     * @param slug   the entity slug identifier
     * @param branch the branch name
     * @return the constructed canonical URI string
     */
    public static String build(String scope, String type, String slug, String branch) {
        return build(scope, type, slug, branch, null, null, null);
    }

    /**
     * Builds a UBOS URI string including a specific commit ID for time travel.
     *
     * @param type     the entity type
     * @param slug     the entity slug identifier
     * @param branch   the branch name
     * @param commitId the specific commit ID (if null, omitted from URI)
     * @return the constructed canonical URI string with optional commit ID
     */
    public static String build(String type, String slug, String branch, Long commitId) {
        return build(DEFAULT_SCOPE, type, slug, branch, commitId, null, null);
    }

    /**
     * Builds a full UBOS URI string with all optional parameters.
     *
     * @param scope    the scope/tenant ID (defaults to "default" if null/blank)
     * @param type     the entity type
     * @param slug     the entity slug identifier
     * @param branch   the branch name (defaults to "master" if null/blank)
     * @param commitId the specific commit ID (optional)
     * @param tag      the release tag (optional)
     * @param key      the property path to extract (optional)
     * @return the constructed canonical URI string
     * @throws IllegalArgumentException if type or slug is null or blank
     */
    public static String build(String scope, String type, String slug, String branch,
                               Long commitId, String tag, String key) {
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("Type cannot be null or blank");
        }
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("Slug cannot be null or blank");
        }

        String resolvedScope = (scope == null || scope.isBlank()) ? DEFAULT_SCOPE : scope;
        String resolvedBranch = (branch == null || branch.isBlank()) ? DEFAULT_BRANCH : branch;

        StringBuilder sb = new StringBuilder();
        sb.append(SCHEME_PREFIX);
        sb.append(urlEncode(resolvedScope));
        sb.append("/");
        sb.append(urlEncode(type.toLowerCase()));
        sb.append("/");
        sb.append(urlEncode(slug));

        // Build query string
        StringBuilder query = new StringBuilder();
        query.append(PARAM_BRANCH).append("=").append(urlEncode(resolvedBranch));

        if (commitId != null) {
            query.append("&").append(PARAM_COMMIT).append("=").append(commitId);
        }
        if (tag != null && !tag.isBlank()) {
            query.append("&").append(PARAM_TAG).append("=").append(urlEncode(tag));
        }
        if (key != null && !key.isBlank()) {
            query.append("&").append(PARAM_KEY).append("=").append(urlEncode(key));
        }

        sb.append("?").append(query);
        return sb.toString();
    }

    /**
     * Filters out empty strings from an array.
     */
    private static String[] filterEmptySegments(String[] segments) {
        return java.util.Arrays.stream(segments)
            .filter(s -> s != null && !s.isBlank())
            .toArray(String[]::new);
    }

    /**
     * URL-decode a string safely.
     */
    private static String urlDecode(String value) {
        if (value == null) {
            return null;
        }
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    /**
     * URL-encode a string for use in URI, replacing spaces with %20.
     */
    private static String urlEncode(String value) {
        if (value == null) {
            return null;
        }
        return URLEncoder.encode(value, StandardCharsets.UTF_8)
            .replace("+", "%20"); // Spaces should be %20, not +
    }

    /**
     * Parses a raw query string into a map of key-value pairs.
     * <p>
     * Handles URL-encoded values and properly splits on '&amp;' delimiters.
     *
     * @param query the raw query string (may be null)
     * @return a map of parameter names to values, empty if query is null or blank
     */
    private static Map<String, String> parseQueryParams(String query) {
        Map<String, String> params = new HashMap<>();
        if (query == null || query.isBlank()) {
            return params;
        }

        for (String pair : query.split("&")) {
            int idx = pair.indexOf('=');
            if (idx > 0) {
                String paramKey = urlDecode(pair.substring(0, idx));
                String paramValue = idx < pair.length() - 1
                    ? urlDecode(pair.substring(idx + 1))
                    : "";
                params.put(paramKey, paramValue);
            } else if (!pair.isBlank()) {
                // Handle flags without values (e.g., "?flag")
                params.put(urlDecode(pair), "");
            }
        }
        return params;
    }

    /**
     * Custom runtime exception thrown when a UBOS URI cannot be parsed.
     * <p>
     * This exception indicates that the provided URI string does not conform
     * to the expected UBOS URI format.
     */
    public static class UbosUriParseException extends RuntimeException {

        /**
         * Constructs a new parse exception with the specified detail message.
         *
         * @param message the detail message explaining the parse failure
         */
        public UbosUriParseException(String message) {
            super(message);
        }

        /**
         * Constructs a new parse exception with the specified detail message and cause.
         *
         * @param message the detail message explaining the parse failure
         * @param cause   the underlying cause of the parse failure
         */
        public UbosUriParseException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
