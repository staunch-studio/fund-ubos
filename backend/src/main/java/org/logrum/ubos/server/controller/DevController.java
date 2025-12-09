package org.logrum.ubos.server.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class DevController {

    private final LcmKernelService kernelService;
    private final ObjectMapper objectMapper;

    @PostMapping("/commit")
    public Mono<Map<String, Object>> commit(@RequestBody CommitRequest req) {
        
        Map<String, Object> snapshotMap = Map.of(
            "meta", Map.of("type", "groovy"),
            "content", req.getCode()
        );

        String snapshotJson;
        try {
            snapshotJson = objectMapper.writeValueAsString(snapshotMap);
        } catch (JsonProcessingException e) {
            return Mono.error(e);
        }

        
        return kernelService.commit(
            req.getType(),
            req.getSlug(),
            req.getBranch(),
            snapshotJson,
            "admin", 
            req.getMessage(),
            req.getProcessId() 
        ).map(commitId -> Map.of(
            "status", "success",
            "commitId", commitId,
            "slug", req.getSlug()
        ));
    }

    @Data
    static class CommitRequest {
        private String type;
        private String slug;
        private String branch;
        private String code;
        private String message;
        private String processId; 
    }
}