package org.logrum.ubos.web.console.dto;

/**
 * Request body for 3-way merge conflict detection.
 *
 * <p>Each field may be either:
 * <ul>
 *   <li>Raw JSON string</li>
 *   <li>ubos:// URI (resolved internally; no HTTP/HTTPS network calls)</li>
 * </ul>
 */
public record MergeConflictDetectRequest(
    String base,
    String ours,
    String theirs
) {}
