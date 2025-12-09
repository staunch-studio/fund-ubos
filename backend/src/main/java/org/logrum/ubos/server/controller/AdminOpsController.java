package org.logrum.ubos.server.controller;

import org.logrum.ubos.server.bootstrap.SystemBootstrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/admin/ops")
@RequiredArgsConstructor
public class AdminOpsController {

    private final SystemBootstrapper bootstrapper;

    @PostMapping("/reset-world")
    public Mono<String> resetWorld(@RequestHeader("X-Admin-Key") String key) {
        
        if (!"MY_SECRET_KEY".equals(key)) {
            return Mono.error(new RuntimeException("Forbidden"));
        }

        
        
        return bootstrapper.forceReset()
            .thenReturn("World has been reset.");
    }
}