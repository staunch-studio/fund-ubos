package org.logrum.ubos.web.console;

import lombok.RequiredArgsConstructor;
import org.logrum.ubos.kernel.service.LcmHistoryService;
import org.logrum.ubos.web.console.dto.HistoryEvent;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1/history")
@RequiredArgsConstructor
public class LcmHistoryController {

    private final LcmHistoryService historyService;

    @GetMapping(value = "/{entityId}/blame", produces = MediaType.APPLICATION_NDJSON_VALUE)
    public Flux<HistoryEvent> blame(@PathVariable String entityId) {
        if (entityId == null || entityId.isBlank()) {
            return Flux.error(new IllegalArgumentException("entityId is required"));
        }
        return historyService.blame(entityId.trim());
    }
}
