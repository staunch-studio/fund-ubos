package org.logrum.ubos.web.console.dto;

import java.util.Map;

/**
 * Request body for creating an approval request.
 *
 * @param targetUri     the UBOS URI of the resource to modify
 * @param content       the JSON content to commit (as Map for flexibility)
 * @param author        the requester identifier
 * @param message       the commit message to use when approved
 */
public record ApprovalCreateRequest(
    String targetUri,
    Map<String, Object> content,
    String author,
    String message
) {
    public String resolvedAuthor() {
        return (author == null || author.isBlank()) ? "system" : author;
    }

    public String resolvedMessage() {
        return (message == null || message.isBlank()) ? "Pending approval" : message;
    }
}
