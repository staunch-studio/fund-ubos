package org.logrum.ubos.web.console;

import lombok.RequiredArgsConstructor;
import org.logrum.ubos.kernel.service.LcmMergeConflictService;
import org.logrum.ubos.web.console.dto.MergeConflictDetectRequest;
import org.logrum.ubos.web.console.dto.MergeConflictResult;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/merge")
@RequiredArgsConstructor
public class LcmMergeConflictController {

    private final LcmMergeConflictService mergeConflictService;

    @PostMapping(value = "/conflicts", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<MergeConflictResult> detectConflicts(@RequestBody MergeConflictDetectRequest request) {
        if (request == null) {
            return Mono.error(new IllegalArgumentException("request is required"));
        }
        return mergeConflictService.detectConflictsFromInputs(
            request.base(),
            request.ours(),
            request.theirs()
        );
    }
}
