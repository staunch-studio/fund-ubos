package org.logrum.ubos.web.console;

import lombok.RequiredArgsConstructor;
import org.logrum.ubos.kernel.service.LcmStashService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/stash")
@RequiredArgsConstructor
public class LcmStashController {

    private final LcmStashService stashService;

    @PostMapping(
        value = "/{entityId}",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public Mono<Map<String, Object>> saveDraft(
        @PathVariable String entityId,
        @RequestParam(name = "branch", defaultValue = "main") String branch,
        @RequestBody String payload,
        ServerWebExchange exchange
    ) {
        String userId = requireUserId(exchange);
        return stashService.saveDraft(userId, entityId, branch, payload)
            .map(commitId -> Map.of(
                "status", "OK",
                "entityId", entityId,
                "branch", branch,
                "draftCommitId", commitId
            ));
    }

    @GetMapping(
        value = "/{entityId}",
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public Mono<Map<String, Object>> getDraft(
        @PathVariable String entityId,
        @RequestParam(name = "branch", defaultValue = "main") String branch,
        ServerWebExchange exchange
    ) {
        String userId = requireUserId(exchange);
        return stashService.getDraftPayload(userId, entityId, branch)
            .map(payload -> Map.of(
                "entityId", entityId,
                "branch", branch,
                "payload", payload
            ));
    }

    private String requireUserId(ServerWebExchange exchange) {
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("X-User-Id header is required");
        }
        return userId.trim();
    }
}
