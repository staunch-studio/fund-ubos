package org.logrum.ubos.web.console.dto;

import java.time.LocalDateTime;
import java.util.List;

public record HistoryEvent(
    String commitHash,
    String author,
    LocalDateTime timestamp,
    String commitMessage,
    List<String> changedFields
) {}
