package org.logrum.ubos.server.controller;

import org.logrum.ubos.engine.service.UbosRuntimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/run")
@RequiredArgsConstructor
public class RunController {

    private final UbosRuntimeService runtimeService;

    @PostMapping("/{slug}")
    public Mono<Object> execute(
        @PathVariable String slug,
        @RequestParam(defaultValue = "master") String branch,
        @RequestParam(required = false) Long commitId, 
        @RequestBody Map<String, Object> context) {

        
        return runtimeService.runLogic(slug, branch, commitId, context);
    }
}