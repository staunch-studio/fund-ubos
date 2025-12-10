package org.logrum.ubos.web.console.dto;

import java.util.Map;

/**
 * Request body for URI-based commit operations.
 *
 * @param uri      the UBOS URI (e.g., "ubos://logic/tax-calc?branch=master")
 * @param content  the JSON content to commit
 * @param author   optional author identifier
 * @param message  optional commit message
 * @param processId optional process ID for batch operations
 */
public record UriCommitRequest(
    String uri,
    Map<String, Object> content,
    String author,
    String message,
    String processId
) {
    public String resolvedAuthor() {
        return (author == null || author.isBlank()) ? "system" : author;
    }

    public String resolvedMessage() {
        return (message == null || message.isBlank()) ? "Committed via API" : message;
    }
}
