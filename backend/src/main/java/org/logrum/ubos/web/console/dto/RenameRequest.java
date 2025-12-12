package org.logrum.ubos.web.console.dto;

/**
 * Request body for renaming/moving an entity by changing its slug (dot-separated path).
 *
 * @param uriString the source UBOS URI (e.g. ubos://logic/finance.taxes.calc_rate?branch=master)
 * @param newSlug   the new slug/path (e.g. finance.taxes.v2.calc_rate)
 * @param author    optional author id
 * @param message   optional commit message
 */
public record RenameRequest(
    String uriString,
    String newSlug,
    String author,
    String message
) {
    public String resolvedAuthor() {
        return (author == null || author.isBlank()) ? "system" : author;
    }

    public String resolvedMessage() {
        return (message == null || message.isBlank()) ? "Rename entity" : message;
    }
}
