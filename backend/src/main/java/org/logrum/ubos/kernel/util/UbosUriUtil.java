package org.logrum.ubos.kernel.util;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Utility class for parsing and building canonical UBOS URIs.
 * <p>
 * The UBOS URI format follows the pattern: {@code ubos://type/slug?branch=name&cid=commit_id}
 * <p>
 * Components:
 * <ul>
 *   <li><b>Scheme:</b> Always {@code ubos}</li>
 *   <li><b>Type:</b> The entity type (e.g., "logic", "type", "data")</li>
 *   <li><b>Slug:</b> The unique identifier for the entity</li>
 *   <li><b>Branch:</b> Optional query parameter, defaults to "master"</li>
 *   <li><b>Commit ID (cid):</b> Optional query parameter for time-travel queries</li>
 * </ul>
 * <p>
 * Examples:
 * <ul>
 *   <li>{@code ubos://logic/tax-calc?branch=master}</li>
 *   <li>{@code ubos://type/user-profile?branch=development&cid=12345}</li>
 *   <li>{@code ubos://data/order-001}</li>
 * </ul>
 *
 * @author UBOS Kernel Team
 * @since 1.0
 */
public final class UbosUriUtil {

    /** The required URI scheme for UBOS resources. */
    private static final String UBOS_SCHEME = "ubos";

    /** The default branch name when not specified. */
    private static final String DEFAULT_BRANCH = "master";

    /** Query parameter key for branch. */
    private static final String PARAM_BRANCH = "branch";

    /** Query parameter key for commit ID (time travel). */
    private static final String PARAM_CID = "cid";

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
     * @param type     the entity type (e.g., "logic", "type", "data"), never null or blank
     * @param slug     the entity slug identifier, never null or blank
     * @param branch   the branch name, defaults to "master" if null or blank
     * @param commitId the optional commit ID for time-travel queries, may be null
     */
    public record UbosUriDetails(
        String type,
        String slug,
        String branch,
        Long commitId
    ) {
        /**
         * Compact constructor with validation and default value assignment.
         *
         * @throws IllegalArgumentException if type or slug is null or blank
         */
        public UbosUriDetails {
            if (type == null || type.isBlank()) {
                throw new IllegalArgumentException("Type cannot be null or blank");
            }
            if (slug == null || slug.isBlank()) {
                throw new IllegalArgumentException("Slug cannot be null or blank");
            }
            if (branch == null || branch.isBlank()) {
                branch = DEFAULT_BRANCH;
            }
            // commitId can be null (optional for time travel)
        }

        /**
         * Convenience constructor without commit ID.
         *
         * @param type   the entity type
         * @param slug   the entity slug identifier
         * @param branch the branch name
         */
        public UbosUriDetails(String type, String slug, String branch) {
            this(type, slug, branch, null);
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
         * Builds the URI string representation of this details object.
         *
         * @return the canonical UBOS URI string
         */
        public String toUriString() {
            return commitId != null
                ? UbosUriUtil.build(type, slug, branch, commitId)
                : UbosUriUtil.build(type, slug, branch);
        }
    }

    /**
     * Parses a UBOS URI string into its component parts.
     * <p>
     * The URI must follow the format: {@code ubos://type/slug?branch=name&cid=commit_id}
     * <p>
     * Parsing rules:
     * <ul>
     *   <li>Scheme must be exactly "ubos" (case-insensitive)</li>
     *   <li>Path must contain at least two segments: type and slug</li>
     *   <li>Branch defaults to "master" if not provided</li>
     *   <li>Commit ID (cid) is optional</li>
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

        URI uri;
        try {
            uri = new URI(uriString);
        } catch (URISyntaxException e) {
            throw new UbosUriParseException("Invalid URI syntax: " + uriString, e);
        }

        // Validate scheme - must be exactly "ubos"
        var scheme = uri.getScheme();
        if (scheme == null || !UBOS_SCHEME.equalsIgnoreCase(scheme)) {
            throw new UbosUriParseException(
                "Invalid scheme: expected 'ubos' but got '" + scheme + "' in URI: " + uriString
            );
        }

        // Extract and validate path segments (type and slug)
        var path = uri.getPath();
        if (path == null || path.isBlank()) {
            // If path is empty, check if host contains the path info (ubos://type/slug format)
            var host = uri.getHost();
            path = uri.getPath();
            if (host != null && path != null) {
                path = "/" + host + path;
            } else {
                throw new UbosUriParseException("Missing path in URI: " + uriString);
            }
        }

        // Handle the authority part for ubos://type/slug format
        var fullPath = path;
        if (uri.getHost() != null) {
            fullPath = "/" + uri.getHost() + path;
        }

        // Remove leading slash and split path into segments
        var cleanPath = fullPath.startsWith("/") ? fullPath.substring(1) : fullPath;
        var segments = cleanPath.split("/");

        if (segments.length < 2) {
            throw new UbosUriParseException(
                "Path must contain type and slug (e.g., /logic/tax-calc), got: " + fullPath
            );
        }

        var type = URLDecoder.decode(segments[0], StandardCharsets.UTF_8);
        var slug = URLDecoder.decode(segments[1], StandardCharsets.UTF_8);

        if (type.isBlank()) {
            throw new UbosUriParseException("Type cannot be blank in URI: " + uriString);
        }
        if (slug.isBlank()) {
            throw new UbosUriParseException("Slug cannot be blank in URI: " + uriString);
        }

        // Parse query parameters
        var queryParams = parseQueryParams(uri.getRawQuery());

        // Extract branch with default fallback
        var branch = queryParams.getOrDefault(PARAM_BRANCH, DEFAULT_BRANCH);
        if (branch.isBlank()) {
            branch = DEFAULT_BRANCH;
        }

        // Extract optional commit ID
        Long commitId = null;
        var cidStr = queryParams.get(PARAM_CID);
        if (cidStr != null && !cidStr.isBlank()) {
            try {
                commitId = Long.parseLong(cidStr);
            } catch (NumberFormatException e) {
                throw new UbosUriParseException(
                    "Invalid commit ID format: expected a number but got '" + cidStr + "' in URI: " + uriString,
                    e
                );
            }
        }

        return new UbosUriDetails(type.toLowerCase(), slug, branch, commitId);
    }

    /**
     * Builds a UBOS URI string from the given components.
     * <p>
     * Constructs a URI in the format: {@code ubos://type/slug?branch=name}
     *
     * @param type   the entity type (e.g., "logic", "type")
     * @param slug   the entity slug identifier
     * @param branch the branch name (defaults to "master" if null or blank)
     * @return the constructed canonical URI string
     * @throws IllegalArgumentException if type or slug is null or blank
     */
    public static String build(String type, String slug, String branch) {
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("Type cannot be null or blank");
        }
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("Slug cannot be null or blank");
        }
        if (branch == null || branch.isBlank()) {
            branch = DEFAULT_BRANCH;
        }

        var encodedType = URLEncoder.encode(type.toLowerCase(), StandardCharsets.UTF_8);
        var encodedSlug = URLEncoder.encode(slug, StandardCharsets.UTF_8)
            .replace("+", "%20"); // Spaces should be %20, not +
        var encodedBranch = URLEncoder.encode(branch, StandardCharsets.UTF_8);

        return String.format("%s://%s/%s?%s=%s",
            UBOS_SCHEME,
            encodedType,
            encodedSlug,
            PARAM_BRANCH,
            encodedBranch
        );
    }

    /**
     * Builds a UBOS URI string including a specific commit ID for time travel.
     * <p>
     * Constructs a URI in the format: {@code ubos://type/slug?branch=name&cid=commit_id}
     *
     * @param type     the entity type
     * @param slug     the entity slug identifier
     * @param branch   the branch name
     * @param commitId the specific commit ID (if null, omitted from URI)
     * @return the constructed canonical URI string with optional commit ID
     * @throws IllegalArgumentException if type or slug is null or blank
     */
    public static String build(String type, String slug, String branch, Long commitId) {
        var baseUri = build(type, slug, branch);
        if (commitId != null) {
            return baseUri + "&" + PARAM_CID + "=" + commitId;
        }
        return baseUri;
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
        var params = new HashMap<String, String>();
        if (query == null || query.isBlank()) {
            return params;
        }

        for (var pair : query.split("&")) {
            var idx = pair.indexOf('=');
            if (idx > 0) {
                var key = URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8);
                var value = idx < pair.length() - 1
                    ? URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8)
                    : "";
                params.put(key, value);
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
