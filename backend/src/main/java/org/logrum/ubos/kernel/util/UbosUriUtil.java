package org.logrum.ubos.kernel.util;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Utility class for parsing and building UBOS URIs.
 * <p>
 * UBOS URI Format: {@code ubos://<type>/<slug>?branch=<branch>&commitId=<commitId>}
 * <p>
 * Examples:
 * <ul>
 *   <li>{@code ubos://logic/tax-calc?branch=master}</li>
 *   <li>{@code ubos://type/user-profile?branch=development&commitId=12345}</li>
 * </ul>
 */
public final class UbosUriUtil {

    private static final String UBOS_SCHEME = "ubos";
    private static final String DEFAULT_BRANCH = "master";
    private static final String PARAM_BRANCH = "branch";
    private static final String PARAM_COMMIT_ID = "commitId";

    private UbosUriUtil() {
        // Utility class - prevent instantiation
    }

    /**
     * Holds the parsed components of a UBOS URI.
     *
     * @param type     the entity type (e.g., "logic", "type", "data")
     * @param slug     the entity slug identifier
     * @param branch   the branch name (defaults to "master" if not specified)
     * @param commitId the optional commit ID for retrieving a specific version
     */
    public record UbosUriDetails(
            String type,
            String slug,
            String branch,
            Optional<Long> commitId
    ) {
        /**
         * Compact constructor with validation.
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
            if (commitId == null) {
                commitId = Optional.empty();
            }
        }

        /**
         * Convenience constructor without commitId.
         */
        public UbosUriDetails(String type, String slug, String branch) {
            this(type, slug, branch, Optional.empty());
        }
    }

    /**
     * Parses a UBOS URI string into its component parts.
     *
     * @param uriString the full UBOS URI (e.g., "ubos://logic/tax-calc?branch=master")
     * @return a {@link UbosUriDetails} record containing the parsed components
     * @throws UbosUriParseException if the URI format is invalid or scheme is not "ubos://"
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

        // Validate scheme
        var scheme = uri.getScheme();
        if (scheme == null || !UBOS_SCHEME.equalsIgnoreCase(scheme)) {
            throw new UbosUriParseException(
                    "Invalid scheme: expected 'ubos://' but got '" + scheme + "://' in URI: " + uriString
            );
        }

        // Extract type from host
        var type = uri.getHost();
        if (type == null || type.isBlank()) {
            throw new UbosUriParseException("Missing entity type in URI: " + uriString);
        }

        // Extract slug from path
        var path = uri.getPath();
        if (path == null || path.isBlank() || "/".equals(path)) {
            throw new UbosUriParseException("Missing slug in URI path: " + uriString);
        }
        // Remove leading slash
        var slug = path.startsWith("/") ? path.substring(1) : path;
        if (slug.isBlank()) {
            throw new UbosUriParseException("Slug cannot be blank in URI: " + uriString);
        }
        // URL decode the slug
        slug = URLDecoder.decode(slug, StandardCharsets.UTF_8);

        // Parse query parameters
        var queryParams = parseQueryParams(uri.getRawQuery());

        var branch = queryParams.getOrDefault(PARAM_BRANCH, DEFAULT_BRANCH);
        if (branch.isBlank()) {
            branch = DEFAULT_BRANCH;
        }

        Optional<Long> commitId = Optional.empty();
        var commitIdStr = queryParams.get(PARAM_COMMIT_ID);
        if (commitIdStr != null && !commitIdStr.isBlank()) {
            try {
                commitId = Optional.of(Long.parseLong(commitIdStr));
            } catch (NumberFormatException e) {
                throw new UbosUriParseException(
                        "Invalid commitId format: expected a number but got '" + commitIdStr + "' in URI: " + uriString,
                        e
                );
            }
        }

        return new UbosUriDetails(type.toUpperCase(), slug, branch, commitId);
    }

    /**
     * Builds a UBOS URI string from the given components.
     *
     * @param type   the entity type (e.g., "logic", "type")
     * @param slug   the entity slug identifier
     * @param branch the branch name
     * @return the constructed URI string (e.g., "ubos://logic/tax-calc?branch=master")
     * @throws IllegalArgumentException if type, slug, or branch is null or blank
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

        var encodedSlug = URLEncoder.encode(slug, StandardCharsets.UTF_8)
                .replace("+", "%20"); // Spaces should be %20, not +

        return String.format("%s://%s/%s?%s=%s",
                UBOS_SCHEME,
                type.toLowerCase(),
                encodedSlug,
                PARAM_BRANCH,
                URLEncoder.encode(branch, StandardCharsets.UTF_8)
        );
    }

    /**
     * Builds a UBOS URI string including a specific commit ID.
     *
     * @param type     the entity type
     * @param slug     the entity slug identifier
     * @param branch   the branch name
     * @param commitId the specific commit ID
     * @return the constructed URI string with commitId parameter
     */
    public static String build(String type, String slug, String branch, Long commitId) {
        var baseUri = build(type, slug, branch);
        if (commitId != null) {
            return baseUri + "&" + PARAM_COMMIT_ID + "=" + commitId;
        }
        return baseUri;
    }

    /**
     * Parses a query string into a map of key-value pairs.
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
}
