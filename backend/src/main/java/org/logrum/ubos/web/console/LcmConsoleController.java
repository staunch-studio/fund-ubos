package org.logrum.ubos.web.console;

import org.logrum.ubos.kernel.model.LcmEntityInstance;
import org.logrum.ubos.kernel.model.LcmEntityVersionChain;
import org.logrum.ubos.kernel.repository.LcmEntityRepository;
import org.logrum.ubos.kernel.repository.LcmVersionRepository;
import org.logrum.ubos.kernel.service.LcmAuditService;
import org.logrum.ubos.kernel.service.LcmKernelService;
import org.logrum.ubos.kernel.util.UbosUriUtil;
import org.logrum.ubos.web.console.dto.BatchCommitRequest;
import org.logrum.ubos.web.console.dto.BranchCreateRequest;
import org.logrum.ubos.web.console.dto.BranchInfo;
import org.logrum.ubos.web.console.dto.CommitHistoryItem;
import org.logrum.ubos.web.console.dto.MergeRequest;
import org.logrum.ubos.web.console.dto.MergeResult;
import org.logrum.ubos.web.console.dto.ResourceContextRequest;
import org.logrum.ubos.web.console.dto.RevertRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import org.logrum.ubos.web.console.dto.CommitHistoryItem;
import org.logrum.ubos.web.console.dto.ProcessDetailItem;
import org.logrum.ubos.web.console.dto.ProcessLogItem;
import org.logrum.ubos.web.console.dto.SearchResult;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/console")
@RequiredArgsConstructor
public class LcmConsoleController {

    private final LcmKernelService kernelService;
    private final LcmAuditService auditService;
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

        Flux<LcmEntityInstance> all = entityRepo.findAll();
        if (type != null && !type.isBlank()) {
            return all.filter(e -> e.getEntityType().equals(type));
        }
        return all;
    }

    /**
     * 2. 获取快照详情 (用于 Monaco Editor 显示)
     * 前端 RTK Query: useGetSnapshotQuery
     * 
     * Accepts ResourceContextRequest via query parameters.
     * Supports two modes:
     * - URI mode: GET /snapshot?uri=ubos://logic/tax-calc?branch=master
     * - Standard mode: GET /snapshot?type=LOGIC&slug=tax-calc&branch=master
     */
    @GetMapping("/snapshot")
    public Mono<LcmEntityVersionChain> getSnapshot(ResourceContextRequest request) {
        final String resolvedType;
        final String resolvedSlug;
        final String resolvedBranch;

        if (request.hasUri()) {
            try {
                var uriDetails = UbosUriUtil.parse(request.uri());
                resolvedType = uriDetails.type().toUpperCase();
                resolvedSlug = uriDetails.slug();
                resolvedBranch = uriDetails.branch();
                
                log.debug("Parsed URI - type: {}, slug: {}, branch: {}", 
                         resolvedType, resolvedSlug, resolvedBranch);
            } catch (UbosUriUtil.UbosUriParseException e) {
                log.warn("Invalid UBOS URI: {}", request.uri(), e);
                return Mono.error(new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid UBOS URI format: " + e.getMessage()
                ));
            }
        } else if (request.hasSlug()) {
            resolvedSlug = request.slug();
            resolvedType = request.resolvedType();
            resolvedBranch = request.resolvedBranch();
        } else {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Either 'uri' or 'slug' parameter is required"
            ));
        }

        return entityRepo.findByEntityTypeAndSlug(resolvedType, resolvedSlug)
            .flatMap(entity -> versionRepo.findHeadSnapshot(entity.getId(), resolvedBranch))
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                String.format("Snapshot not found for %s/%s on branch '%s'", 
                             resolvedType, resolvedSlug, resolvedBranch)
            )));
    }

    /**
     * 3. 获取历史提交记录列表 (用于 History Tab)
     * 前端 RTK Query: useGetHistoryQuery
     * 
     * Accepts ResourceContextRequest via query parameters.
     *
     * @param request the resource context containing slug, type, and optional branch
     * @return Flux of commit history items
     */
    @GetMapping("/history")
    public Flux<CommitHistoryItem> getHistory(ResourceContextRequest request) {
        if (!request.hasSlug()) {
            return Flux.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "slug parameter is required"
            ));
        }

        String type = request.resolvedType();
        String slug = request.slug();
        String branch = request.branch(); // Can be null for all branches

        log.debug("Fetching history for type={}, slug={}, branch={}", type, slug, branch);

        if (branch != null && !branch.isBlank()) {
            return auditService.getEntityHistoryByBranch(type, slug, branch)
                .map(CommitHistoryItem::fromMap);
        }
        return auditService.getEntityHistory(type, slug)
            .map(CommitHistoryItem::fromMap);
    }

    /**
     * 4. 获取指定 commitId 的快照数据 (用于 Diff 比较)
     * 前端 RTK Query: useGetSnapshotByCommitQuery
     * 
     * Retrieves the raw JSON content for a specific historical commit.
     *
     * @param commitId the commit ID to retrieve
     * @return the raw JSON snapshot data as a string
     */
    @GetMapping("/snapshot/{commitId}")
    public Mono<String> getSnapshotByCommit(@PathVariable Long commitId) {
        log.debug("Fetching snapshot for commitId={}", commitId);

        return kernelService.getSnapshotByCommit(commitId)
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Snapshot not found for commit ID: " + commitId
            )));
    }

    /**
     * 5. 批量提交 (Batch Commit)
     * 前端 RTK Query: useBatchCommitMutation
     */
    @PostMapping("/batch-commit")
    public Mono<String> batchCommit(@RequestBody BatchCommitRequest req) {
        String entityType = (req.entityType() == null) ? "LOGIC" : req.entityType();
        String branch = (req.branch() == null) ? "master" : req.branch();

        log.info("Batch commit started: {} items, branch={}", req.slugs().size(), branch);

        return kernelService.startProcess("Console Batch Update", "AdminConsole")
            .flatMap(processId ->
                Flux.fromIterable(req.slugs())
                    .flatMap(slug ->
                        kernelService.commit(
                            entityType,
                            slug,
                            branch,
                            req.jsonPatch(),
                            "AdminConsole",
                            req.message(),
                            processId
                        )
                    )
                    .collectList()
                    .map(commitIds -> "✅ Processed " + commitIds.size() + " entities. (ProcessID: " + processId + ")")
            );
    }

    // ==================== Branch Management Endpoints ====================

    /**
     * 6. Revert to a specific commit
     * Purpose: Move the Branch HEAD pointer to a specified historical commit.
     * 
     * Request Body: {"slug": "tax-calc", "type": "LOGIC", "branch": "master", "targetCommitId": 99}
     */
    @PostMapping("/revert")
    public Mono<Map<String, Object>> revertToCommit(@RequestBody RevertRequest request) {
        if (request.slug() == null || request.slug().isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug is required"));
        }
        if (request.targetCommitId() == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetCommitId is required"));
        }

        log.info("🔄 Revert request: {}/{}@{} -> commit {}", 
                request.resolvedType(), request.slug(), request.resolvedBranch(), request.targetCommitId());

        return kernelService.revertToCommit(request)
            .map(commitId -> Map.<String, Object>of(
                "success", true,
                "message", String.format("Successfully reverted %s/%s@%s to commit %d", 
                                        request.resolvedType(), request.slug(), request.resolvedBranch(), commitId),
                "commitId", commitId
            ))
            .onErrorResume(IllegalArgumentException.class, e -> 
                Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())));
    }

    /**
     * 7. Create a new branch
     * Purpose: Create a new branch, pointing its HEAD to an existing commit.
     * 
     * Request Body: {"newBranchName": "feature-v2", "baseCommitId": 102, "parentBranchName": "master"}
     */
    @PostMapping("/branch/create")
    public Mono<Map<String, Object>> createBranch(@RequestBody BranchCreateRequest req) {
        if (req.newBranchName() == null || req.newBranchName().isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "newBranchName is required"));
        }
        if (req.baseCommitId() == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "baseCommitId is required"));
        }

        log.info("🌿 Branch create request: '{}' from commit {}", req.newBranchName(), req.baseCommitId());

        return kernelService.createBranch(
                req.newBranchName(), 
                req.baseCommitId(), 
                req.parentBranchName(),
                req.description()
            )
            .map(branchName -> Map.<String, Object>of(
                "success", true,
                "message", String.format("Branch '%s' created successfully", branchName),
                "branchName", branchName
            ))
            .onErrorResume(IllegalArgumentException.class, e -> 
                Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())))
            .onErrorResume(org.springframework.dao.DataIntegrityViolationException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, 
                    "Branch '" + req.newBranchName() + "' already exists")));
    }

    /**
     * 8. Get all available branches
     * Purpose: Get a list of all defined branches from sys_branch_config.
     */
    @GetMapping("/branches")
    public Flux<BranchInfo> getAvailableBranches() {
        log.debug("Fetching available branches");
        return kernelService.getAvailableBranches();
    }

    // ==================== Merge Endpoints ====================

    /**
     * 9. Merge branches
     * Purpose: Merge entities from source branch into target branch using content-level merge.
     * 
     * Request Body: {
     *   "sourceBranch": "feature-v2",
     *   "targetBranch": "master",
     *   "type": "LOGIC",
     *   "slugs": ["tax-calc", "price-calc"],
     *   "author": "admin",
     *   "message": "Merge feature-v2 into master"
     * }
     */
    @PostMapping("/merge")
    public Mono<Map<String, Object>> mergeBranches(@RequestBody MergeRequest request) {
        // Validation
        if (request.sourceBranch() == null || request.sourceBranch().isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceBranch is required"));
        }
        if (!request.hasSlugs()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "slugs list is required and cannot be empty"));
        }

        log.info("🔀 Merge request: {} -> {}, slugs: {}", 
                request.sourceBranch(), request.resolvedTargetBranch(), request.slugs());

        return kernelService.mergeBranches(request)
            .collectList()
            .map(results -> {
                int mergedCount = results.stream().mapToInt(MergeResult::mergedCount).sum();
                int skippedCount = results.stream().mapToInt(MergeResult::skippedCount).sum();
                int failedCount = results.stream().mapToInt(MergeResult::failedCount).sum();

                List<String> mergedSlugs = results.stream()
                    .flatMap(r -> r.mergedSlugs().stream())
                    .toList();
                List<String> skippedSlugs = results.stream()
                    .flatMap(r -> r.skippedSlugs().stream())
                    .toList();
                List<MergeResult.MergeFailure> failures = results.stream()
                    .flatMap(r -> r.failedSlugs().stream())
                    .toList();

                boolean success = failedCount == 0;
                String message = String.format(
                    "Merge %s: %d merged, %d skipped, %d failed",
                    success ? "completed" : "completed with errors",
                    mergedCount, skippedCount, failedCount
                );

                Map<String, Object> response = new LinkedHashMap<>();
                response.put("success", success);
                response.put("message", message);
                response.put("sourceBranch", request.sourceBranch());
                response.put("targetBranch", request.resolvedTargetBranch());
                response.put("mergedCount", mergedCount);
                response.put("skippedCount", skippedCount);
                response.put("failedCount", failedCount);
                response.put("mergedSlugs", mergedSlugs);
                response.put("skippedSlugs", skippedSlugs);
                if (!failures.isEmpty()) {
                    response.put("failures", failures);
                }

                return response;
            })
            .onErrorResume(IllegalArgumentException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())));
    }

    // ==================== Search Endpoints ====================

    /**
     * 10. Global Search
     * Purpose: Perform full-text search across entity snapshots using the search index.
     * 
     * Supports multiple search modes:
     * - Full-text search against indexed property values
     * - Slug pattern matching
     * 
     * @param query  the search query string (required)
     * @param branch optional branch filter
     * @param type   optional entity type filter
     * @param mode   search mode: "fulltext" (default) or "slug"
     * @param limit  maximum results (default 50, max 200)
     */
    @GetMapping("/search")
    public Flux<SearchResult> search(
            @RequestParam String query,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "fulltext") String mode,
            @RequestParam(defaultValue = "50") int limit) {

        if (query == null || query.isBlank()) {
            return Flux.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "query parameter is required"));
        }

        // Clamp limit to reasonable bounds
        int effectiveLimit = Math.min(Math.max(limit, 1), 200);

        log.debug("🔍 Search request: query='{}', branch='{}', type='{}', mode='{}', limit={}", 
                 query, branch, type, mode, effectiveLimit);

        if ("slug".equalsIgnoreCase(mode)) {
            return kernelService.searchBySlug(query, branch, effectiveLimit)
                .map(map -> new SearchResult(
                    (String) map.get("entityId"),
                    (String) map.get("entityType"),
                    (String) map.get("slug"),
                    (String) map.get("branchName"),
                    (Long) map.get("commitId"),
                    null, // no matched field for slug search
                    null, // no matched value for slug search
                    (String) map.get("snapshotData")
                ));
        }

        // Default: full-text search
        return kernelService.searchFullText(query, branch, type, effectiveLimit)
            .map(SearchResult::fromMap);
    }

    // ==================== Process Log Endpoints ====================

    /**
     * 11. Get Recent Processes
     * Purpose: Get a list of the 50 most recent batch operations.
     */
    @GetMapping("/process/recent")
    public Flux<ProcessLogItem> getRecentProcesses() {
        log.debug("Fetching recent processes");
        return auditService.getRecentProcesses()
            .map(ProcessLogItem::fromMap);
    }

    /**
     * 12. Get Process Details
     * Purpose: Get the details and all associated commits for a specific batch process.
     * 
     * @param processId the process ID to retrieve details for
     */
    @GetMapping("/process/{processId}")
    public Mono<Map<String, Object>> getProcessDetails(@PathVariable String processId) {
        if (processId == null || processId.isBlank()) {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "processId is required"));
        }

        log.debug("Fetching process details for processId={}", processId);

        // Get process info and commits in parallel
        Mono<ProcessLogItem> processInfoMono = auditService.getProcessInfo(processId)
            .map(ProcessLogItem::fromMap)
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Process not found: " + processId)));

        Mono<List<ProcessDetailItem>> commitsMono = auditService.getProcessDetails(processId)
            .map(ProcessDetailItem::fromMap)
            .collectList();

        return Mono.zip(processInfoMono, commitsMono)
            .map(tuple -> {
                ProcessLogItem processInfo = tuple.getT1();
                List<ProcessDetailItem> commits = tuple.getT2();

                Map<String, Object> result = new LinkedHashMap<>();
                result.put("processId", processInfo.processId());
                result.put("processName", processInfo.processName());
                result.put("operatorId", processInfo.operatorId());
                result.put("startedAt", processInfo.startedAt());
                result.put("commitCount", commits.size());
                result.put("commits", commits);

                return result;
            });
    }
}