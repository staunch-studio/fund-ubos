package org.logrum.ubos.server.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final LcmKernelService kernelService;
    private final ObjectMapper objectMapper;

    public Mono<Map<String, Object>> login(String email, String password) {
        
        
        
        
        

        String targetSlug = "user_admin";

        return kernelService.getResourceSnapshot("USER", targetSlug, "master")
            .flatMap(json -> {
                try {
                    
                    Map<String, Object> userData = objectMapper.readValue(json, new TypeReference<>() {});

                    
                    String storedEmail = (String) userData.get("email");
                    String storedPass = (String) userData.get("password");

                    
                    if (email.equals(storedEmail) && password.equals(storedPass)) {
                        
                        String token = UUID.randomUUID().toString();

                        log.info("✅ Login success: {}", email);

                        
                        return Mono.just(Map.of(
                            "token", token,
                            "user", Map.of(
                                "id", targetSlug,
                                "name", userData.get("name"),
                                "role", userData.get("role"),
                                "avatar", userData.get("avatar")
                            )
                        ));
                    } else {
                        log.warn("❌ Login failed (password mismatch): {}", email);
                        return Mono.error(new RuntimeException("Invalid Credentials"));
                    }
                } catch (Exception e) {
                    log.error("❌ Login error", e);
                    return Mono.error(new RuntimeException("Data Error"));
                }
            })
            
            .switchIfEmpty(Mono.error(new RuntimeException("Admin User Not Found")));
    }
}