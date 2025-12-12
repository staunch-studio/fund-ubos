package org.logrum.ubos.web.console.dto;

import java.time.Instant;

public record SystemHealthDto(
    Instant timestamp,
    boolean databaseUp,
    long totalEntities,
    long totalCommits,
    String status
) {}
