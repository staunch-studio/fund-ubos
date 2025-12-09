package org.logrum.ubos.engine.service;

import org.logrum.ubos.engine.executor.LcmLogicExecutor;
import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class UbosRuntimeService {

    private final LcmKernelService kernelService;
    private final LcmLogicExecutor logicExecutor;

    public Mono<Object> runLogic(String logicSlug, String branch, Long commitId, Map<String, Object> context) {
        Mono<String> sourceMono;

        if (commitId != null) {
            
            sourceMono = kernelService.getSnapshotByCommit(commitId)
                .switchIfEmpty(Mono.error(new RuntimeException("Commit not found: " + commitId)));
        } else {
            
            sourceMono = kernelService.getResourceSnapshot("LOGIC", logicSlug, branch)
                .switchIfEmpty(Mono.error(new RuntimeException("Logic not found: " + logicSlug + " @ " + branch)));
        }

        return sourceMono
            .flatMap(jsonSnapshot -> logicExecutor.execute(jsonSnapshot, context));
    }
}