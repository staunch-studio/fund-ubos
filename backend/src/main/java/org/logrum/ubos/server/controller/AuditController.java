package org.logrum.ubos.server.controller;

import org.logrum.ubos.kernel.service.LcmAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final LcmAuditService auditService;

    @GetMapping("/processes")
    public Flux<Map<String, Object>> getRecentProcesses() {
        return auditService.getRecentProcesses();
    }

    @GetMapping("/process/{processId}")
    public Flux<Map<String, Object>> getProcessDetails(@PathVariable String processId) {
        return auditService.getProcessDetails(processId);
    }

    @GetMapping("/history")
    public Flux<Map<String, Object>> getEntityHistory(@RequestParam String slug) {
        return auditService.getEntityHistory(slug);
    }
}