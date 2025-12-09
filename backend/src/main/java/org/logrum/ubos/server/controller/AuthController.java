package org.logrum.ubos.server.controller;

import org.logrum.ubos.server.service.AuthService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public Mono<ResponseEntity<Map<String, Object>>> login(@RequestBody LoginRequest req) {
        return authService.login(req.getEmail(), req.getPassword())
            .map(ResponseEntity::ok)
            .onErrorResume(e -> {
                
                return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Login failed: " + e.getMessage())));
            });
    }

    @Data
    static class LoginRequest {
        private String email;
        private String password;
    }
}