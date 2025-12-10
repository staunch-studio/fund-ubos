package org.logrum.ubos.web.console;

import org.logrum.ubos.kernel.model.LcmEntityInstance;
import org.logrum.ubos.kernel.model.LcmEntityVersionChain;
import org.logrum.ubos.kernel.repository.LcmEntityRepository;
import org.logrum.ubos.kernel.repository.LcmVersionRepository;
import org.logrum.ubos.kernel.service.LcmKernelService;
import org.logrum.ubos.web.console.dto.BatchCommitRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping("/api/console")
@RequiredArgsConstructor
public class LcmConsoleController {

    // 注入您现有的 Service 和 Repository
    private final LcmKernelService kernelService;
    private final LcmEntityRepository entityRepo;
    private final LcmVersionRepository versionRepo;

    /**
     * 1. 获取实体列表
     * 前端 RTK Query: useGetEntitiesQuery
     */
    @GetMapping("/entities")
    public Flux<LcmEntityInstance> getEntities(
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String search) {

        // 如果没有传 type，默认查所有；实际建议加上 findByEntityType
        // 这里暂时用 findAll + filter 适配现有 Repository
        Flux<LcmEntityInstance> all = entityRepo.findAll();

        if (type != null && !type.isBlank()) {
            return all.filter(e -> e.getEntityType().equals(type));
        }
        return all;
    }

    /**
     * 2. 获取快照详情 (用于 Monaco Editor 显示)
     * 前端 RTK Query: useGetSnapshotQuery
     * 利用 LcmVersionRepository.findHeadSnapshot
     */
    @GetMapping("/snapshot")
    public Mono<LcmEntityVersionChain> getSnapshot(
        @RequestParam String slug,
        @RequestParam(defaultValue = "LOGIC") String type, // 默认类型
        @RequestParam(defaultValue = "master") String branch) {

        return entityRepo.findByEntityTypeAndSlug(type, slug)
            .flatMap(entity -> versionRepo.findHeadSnapshot(entity.getId(), branch))
            .switchIfEmpty(Mono.error(new RuntimeException("Snapshot not found for " + slug + " on " + branch)));
    }

    /**
     * 3. 批量提交 (Batch Commit)
     * 前端 RTK Query: useBatchCommitMutation
     * 亮点：会自动创建一个 Process (过程)，将这次批量操作记录在案。
     */
    @PostMapping("/batch-commit")
    public Mono<String> batchCommit(@RequestBody BatchCommitRequest req) {
        String entityType = (req.entityType() == null) ? "LOGIC" : req.entityType();
        String branch = (req.branch() == null) ? "master" : req.branch();

        log.info("Batch commit started: {} items, branch={}", req.slugs().size(), branch);

        // 1. 先创建一个 Process (过程上下文)
        return kernelService.startProcess("Console Batch Update", "AdminConsole")
            .flatMap(processId ->
                // 2. 并行处理所有 Slug
                Flux.fromIterable(req.slugs())
                    .flatMap(slug ->
                        // 调用现有的 commit 方法，传入 processId
                        kernelService.commit(
                            entityType,
                            slug,
                            branch,
                            req.jsonPatch(), // 编辑器修改后的数据
                            "AdminConsole",  // Author
                            req.message(),
                            processId        // 关联到同一个过程 ID
                        )
                    )
                    .collectList()
                    .map(commitIds -> "✅ Processed " + commitIds.size() + " entities. (ProcessID: " + processId + ")")
            );
    }
}