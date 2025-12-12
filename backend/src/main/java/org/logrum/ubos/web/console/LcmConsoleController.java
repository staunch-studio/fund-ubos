package org.logrum.ubos.web.console;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.model.LcmEntityInstance;
import org.logrum.ubos.kernel.model.LcmEntityVersionChain;
import org.logrum.ubos.kernel.repository.LcmEntityRepository;
import org.logrum.ubos.kernel.repository.LcmVersionRepository;
import org.logrum.ubos.kernel.service.LcmApprovalService;
import org.logrum.ubos.kernel.service.LcmAuditService;
import org.logrum.ubos.kernel.service.LcmAuthzService;
import org.logrum.ubos.kernel.service.LcmEnvironmentService;
import org.logrum.ubos.kernel.service.LcmKernelService;
import org.logrum.ubos.kernel.util.JsonSchemaValidator;
import org.logrum.ubos.kernel.util.SchemaValidationException;
import org.logrum.ubos.kernel.util.UbosUriUtil;
import org.logrum.ubos.web.console.dto.ApprovalActionRequest;
import org.logrum.ubos.web.console.dto.ApprovalCreateRequest;
import org.logrum.ubos.web.console.dto.ApprovalRequestPayload;
import org.logrum.ubos.web.console.dto.BatchCommitRequest;
import org.logrum.ubos.web.console.dto.BranchCreateRequest;
import org.logrum.ubos.web.console.dto.BranchInfo;
import org.logrum.ubos.web.console.dto.CommitHistoryItem;
import org.logrum.ubos.web.console.dto.CopyRequest;
import org.logrum.ubos.web.console.dto.EnvironmentConfigDto;
import org.logrum.ubos.web.console.dto.MergeRequest;
import org.logrum.ubos.web.console.dto.MergeResult;
import org.logrum.ubos.web.console.dto.ProcessDetailItem;
import org.logrum.ubos.web.console.dto.ProcessLogItem;
import org.logrum.ubos.web.console.dto.RenameRequest;
import org.logrum.ubos.web.console.dto.ResourceContextRequest;
import org.logrum.ubos.web.console.dto.RevertRequest;
import org.logrum.ubos.web.console.dto.SchemaCommitRequest;
import org.logrum.ubos.web.console.dto.SearchResult;
import org.logrum.ubos.kernel.service.LcmMetricsService;
import org.logrum.ubos.web.console.dto.SystemHealthDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@Slf4j
@RestController
@RequestMapping("/api/console")
@RequiredArgsConstructor
public class LcmConsoleController
{

    private final LcmKernelService kernelService;
    private final LcmAuditService auditService;
    private final LcmEnvironmentService environmentService;
    private final LcmApprovalService approvalService;
    private final LcmEntityRepository entityRepo;
    private final LcmVersionRepository versionRepo;
    private final JsonSchemaValidator schemaValidator;
    private final ObjectMapper objectMapper;
    private final LcmAuthzService authzService;
    private final LcmMetricsService metricsService;

    /**
     * 1. 获取实体列表 前端 RTK Query: useGetEntitiesQuery
     *
     * Future-proofed with optional tenantId/groupId parameter for data isolation.
     */
    @GetMapping("/entities")
    public Flux<LcmEntityInstance> getEntities(
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String tenantId,
        @RequestParam(required = false) String groupId)
    {
        // TODO: When multi-tenancy is implemented, filter by tenantId/groupId
        // For now, these parameters are accepted but not used

        Flux<LcmEntityInstance> all = entityRepo.findAll();
        if (type != null && !type.isBlank())
        {
            return all.filter(e -> e.getEntityType().equals(type));
        }
        return all;
    }

    /**
     * 2. 获取快照详情 (用于 Monaco Editor 显示) 前端 RTK Query: useGetSnapshotQuery
     * <p>
     * Accepts ResourceContextRequest via query parameters. Supports two modes: - URI mode: GET
     * /snapshot?uri=ubos://logic/tax-calc?branch=master - Standard mode: GET
     * /snapshot?type=LOGIC&slug=tax-calc&branch=master
     */
    @GetMapping("/snapshot")
    public Mono<LcmEntityVersionChain> getSnapshot(
        @RequestParam(required = false) String uri,
        @RequestParam(required = false) String slug,
        @RequestParam(required = false, defaultValue = "LOGIC") String type,
        @RequestParam(required = false, defaultValue = "master") String branch)
    {
        final String resolvedType;
        final String resolvedSlug;
        final String resolvedBranch;

        // URI mode takes priority
        if (uri != null && !uri.isBlank())
        {
            try
            {
                var uriDetails = UbosUriUtil.parse(uri);
                resolvedType = uriDetails.type().toUpperCase();
                resolvedSlug = uriDetails.slug();
                resolvedBranch = uriDetails.branch();

                log.debug("Parsed URI - type: {}, slug: {}, branch: {}",
                    resolvedType, resolvedSlug, resolvedBranch);
            }
            catch (UbosUriUtil.UbosUriParseException e)
            {
                log.warn("Invalid UBOS URI: {}", uri, e);
                return Mono.error(new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid UBOS URI format: " + e.getMessage()
                ));
            }
        }
        else if (slug != null && !slug.isBlank())
        {
            resolvedSlug = slug;
            resolvedType = type.toUpperCase();
            resolvedBranch = branch;
        }
        else
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Either 'uri' or 'slug' parameter is required"
            ));
        }

        // Use kernelService to leverage branch inheritance (fallback to parent branch)
        return kernelService.getResourceSnapshot(resolvedType, resolvedSlug, resolvedBranch)
            .flatMap(snapshotData -> 
                // We need to return LcmEntityVersionChain, so fetch the full entity
                entityRepo.findByEntityTypeAndSlug(resolvedType, resolvedSlug)
                    .flatMap(entity -> findHeadWithFallback(entity.getId(), resolvedBranch))
            )
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                String.format("Snapshot not found for %s/%s on branch '%s'",
                    resolvedType, resolvedSlug, resolvedBranch)
            )));
    }

    /**
     * Find HEAD snapshot with branch inheritance fallback.
     * If not found in current branch, tries parent branch recursively.
     */
    private Mono<LcmEntityVersionChain> findHeadWithFallback(String entityId, String branchName) {
        return versionRepo.findHeadSnapshot(entityId, branchName)
            .switchIfEmpty(Mono.defer(() -> 
                getParentBranch(branchName)
                    .flatMap(parentBranch -> findHeadWithFallback(entityId, parentBranch))
            ));
    }

    /**
     * Get parent branch name from sys_branch_config.
     */
    private Mono<String> getParentBranch(String branchName) {
        if ("master".equalsIgnoreCase(branchName)) {
            return Mono.empty(); // master has no parent
        }
        // Query parent branch from config
        return kernelService.getAvailableBranches()
            .filter(b -> branchName.equals(b.branchName()))
            .next()
            .mapNotNull(BranchInfo::parentBranch)
            .filter(p -> !p.isBlank());
    }
    /**
     * 3. 获取历史提交记录列表 (用于 History Tab) 前端 RTK Query: useGetHistoryQuery
     * <p>
     * Accepts ResourceContextRequest via query parameters.
     *
     * @param request the resource context containing slug, type, and optional branch
     * @return Flux of commit history items
     */
    @GetMapping("/history")
    public Flux<CommitHistoryItem> getHistory(ResourceContextRequest request)
    {
        if (!request.hasSlug())
        {
            return Flux.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "slug parameter is required"
            ));
        }

        String type = request.resolvedType();
        String slug = request.slug();
        String branch = request.branch(); // Can be null for all branches

        log.debug("Fetching history for type={}, slug={}, branch={}", type, slug, branch);

        if (branch != null && !branch.isBlank())
        {
            return auditService.getEntityHistoryByBranch(type, slug, branch)
                .map(CommitHistoryItem::fromMap);
        }
        return auditService.getEntityHistory(type, slug)
            .map(CommitHistoryItem::fromMap);
    }

    /**
     * 4. 获取指定 commitId 的快照数据 (用于 Diff 比较) 前端 RTK Query: useGetSnapshotByCommitQuery
     * <p>
     * Retrieves the raw JSON content for a specific historical commit.
     *
     * @param commitId the commit ID to retrieve
     * @return the raw JSON snapshot data as a string
     */
    @GetMapping("/snapshot/{commitId}")
    public Mono<String> getSnapshotByCommit(@PathVariable Long commitId)
    {
        log.debug("Fetching snapshot for commitId={}", commitId);

        return kernelService.getSnapshotByCommit(commitId)
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Snapshot not found for commit ID: " + commitId
            )));
    }

    /**
     * 5. 批量提交 (Batch Commit) 前端 RTK Query: useBatchCommitMutation
     */
    @PostMapping("/batch-commit")
    public Mono<String> batchCommit(@RequestBody BatchCommitRequest req)
    {
        String entityType = (req.entityType() == null) ? "LOGIC" : req.entityType();
        String branch = (req.branch() == null) ? "master" : req.branch();
        String author = "AdminConsole"; // TODO: Get from authentication

        log.info("Batch commit started: {} items, branch={}", req.slugs().size(), branch);

        // Authorization check for each slug
        return authzService.getCurrentUser()
            .flatMap(userId ->
                Flux.fromIterable(req.slugs())
                    .flatMap(slug -> {
                        String uri = LcmAuthzService.buildUri(entityType, slug, branch);
                        return authzService.isPermitted(userId, LcmAuthzService.ACTION_COMMIT, uri)
                            .flatMap(permitted -> {
                                if (!permitted) {
                                    return Mono.error(new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        String.format("Not permitted to commit %s/%s on branch %s", entityType, slug, branch)
                                    ));
                                }
                                return Mono.just(slug);
                            });
                    })
                    .collectList()
            )
            .flatMap(authorizedSlugs ->
                kernelService.startProcess("Console Batch Update", author)
                    .flatMap(processId ->
                        Flux.fromIterable(authorizedSlugs)
                            .flatMap(slug ->
                                kernelService.commit(
                                    entityType,
                                    slug,
                                    branch,
                                    req.jsonPatch(),
                                    author,
                                    req.message(),
                                    processId
                                )
                            )
                            .collectList()
                            .map(commitIds -> "✅ Processed " + commitIds.size() + " entities. (ProcessID: " + processId + ")")
                    )
            );
    }


    // ==================== Branch Management Endpoints ====================

    /**
     * 6. Revert to a specific commit Purpose: Move the Branch HEAD pointer to a specified historical commit.
     */
    @PostMapping("/revert")
    public Mono<Map<String, Object>> revertToCommit(@RequestBody RevertRequest request)
    {
        if (request.slug() == null || request.slug().isBlank())
        {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug is required"));
        }
        if (request.targetCommitId() == null)
        {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetCommitId is required"));
        }

        log.info("🔄 Revert request: {}/{}@{} -> commit {}",
            request.resolvedType(), request.slug(), request.resolvedBranch(), request.targetCommitId());

        String uri = LcmAuthzService.buildUri(request.resolvedType(), request.slug(), request.resolvedBranch());

        // Authorization check
        return authzService.getCurrentUser()
            .flatMap(userId -> authzService.isPermitted(userId, LcmAuthzService.ACTION_REVERT, uri))
            .flatMap(permitted -> {
                if (!permitted) {
                    return Mono.error(new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        String.format("Not permitted to revert %s/%s on branch %s",
                            request.resolvedType(), request.slug(), request.resolvedBranch())
                    ));
                }
                return kernelService.revertToCommit(request);
            })
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
     * 7. Create a new branch Purpose: Create a new branch, pointing its HEAD to an existing commit.
     * <p>
     * Request Body: {"newBranchName": "feature-v2", "baseCommitId": 102, "parentBranchName": "master"}
     */
    @PostMapping("/branch/create")
    public Mono<Map<String, Object>> createBranch(@RequestBody BranchCreateRequest req)
    {
        if (req.newBranchName() == null || req.newBranchName().isBlank())
        {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "newBranchName is required"));
        }
        if (req.baseCommitId() == null)
        {
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
     * 8. Get all available branches Purpose: Get a list of all defined branches from sys_branch_config.
     */
    @GetMapping("/branches")
    public Flux<BranchInfo> getAvailableBranches()
    {
        log.debug("Fetching available branches");
        return kernelService.getAvailableBranches();
    }

    // ==================== Merge Endpoints ====================

    /**
     * 9. Merge branches Purpose: Merge entities from source branch into target branch using content-level merge.
     */
    @PostMapping("/merge")
    public Mono<Map<String, Object>> mergeBranches(@RequestBody MergeRequest request)
    {
        // Validation
        if (request.sourceBranch() == null || request.sourceBranch().isBlank())
        {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceBranch is required"));
        }
        if (!request.hasSlugs())
        {
            return Mono.error(
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "slugs list is required and cannot be empty"));
        }

        log.info("🔀 Merge request: {} -> {}, slugs: {}",
            request.sourceBranch(), request.resolvedTargetBranch(), request.slugs());

        // Authorization check for merge on target branch
        return authzService.getCurrentUser()
            .flatMap(userId ->
                Flux.fromIterable(request.slugs())
                    .flatMap(slug -> {
                        String uri = LcmAuthzService.buildUri(request.resolvedType(), slug, request.resolvedTargetBranch());
                        return authzService.isPermitted(userId, LcmAuthzService.ACTION_MERGE, uri)
                            .flatMap(permitted -> {
                                if (!permitted) {
                                    return Mono.error(new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        String.format("Not permitted to merge into %s/%s on branch %s",
                                            request.resolvedType(), slug, request.resolvedTargetBranch())
                                    ));
                                }
                                return Mono.just(slug);
                            });
                    })
                    .collectList()
            )
            .flatMap(authorizedSlugs -> kernelService.mergeBranches(request).collectList())
            .map(results ->
            {
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
                if (!failures.isEmpty())
                {
                    response.put("failures", failures);
                }

                return response;
            })
            .onErrorResume(IllegalArgumentException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())));
    }


    // ==================== Search Endpoints ====================

    /**
     * 10. Global Search Purpose: Perform full-text search across entity snapshots using the search index.
     *
     * Future-proofed with optional tenantId/groupId parameter for data isolation.
     */
    @GetMapping("/search")
    public Flux<SearchResult> search(
        @RequestParam String query,
        @RequestParam(required = false) String branch,
        @RequestParam(required = false) String type,
        @RequestParam(defaultValue = "fulltext") String mode,
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(required = false) String tenantId,
        @RequestParam(required = false) String groupId)
    {
        // TODO: When multi-tenancy is implemented, filter results by tenantId/groupId

        if (query == null || query.isBlank())
        {
            return Flux.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "query parameter is required"));
        }

        // Clamp limit to reasonable bounds
        int effectiveLimit = Math.min(Math.max(limit, 1), 200);

        log.debug("🔍 Search request: query='{}', branch='{}', type='{}', mode='{}', limit={}",
            query, branch, type, mode, effectiveLimit);

        if ("slug".equalsIgnoreCase(mode))
        {
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
     * 11. Get Recent Processes Purpose: Get a list of the 50 most recent batch operations.
     */
    @GetMapping("/process/recent")
    public Flux<ProcessLogItem> getRecentProcesses()
    {
        log.debug("Fetching recent processes");
        return auditService.getRecentProcesses()
            .map(ProcessLogItem::fromMap);
    }

    /**
     * 12. Get Process Details Purpose: Get the details and all associated commits for a specific batch process.
     *
     * @param processId the process ID to retrieve details for
     */
    @GetMapping("/process/{processId}")
    public Mono<Map<String, Object>> getProcessDetails(@PathVariable String processId)
    {
        if (processId == null || processId.isBlank())
        {
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
            .map(tuple ->
            {
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

    /**
     * 13. Get All Environments Purpose: Get a list of all defined environment configurations from the Version Chain.
     * Environments are stored as entities with entityType = 'ENVIRONMENT'
     */
    @GetMapping("/environments")
    public Flux<Map<String, Object>> getEnvironments(
        @RequestParam(defaultValue = "master") String branch)
    {

        log.debug("Fetching all environments from version chain");

        return entityRepo.findAll()
            .filter(e -> "ENVIRONMENT".equalsIgnoreCase(e.getEntityType()))
            .flatMap(entity ->
                versionRepo.findHeadSnapshot(entity.getId(), branch)
                    .map(version ->
                    {
                        Map<String, Object> result = new LinkedHashMap<>();
                        result.put("slug", entity.getSlug());
                        result.put("entityType", entity.getEntityType());
                        result.put("commitId", version.getCommitId());
                        result.put("branchName", version.getBranchName());
                        result.put("snapshotData", version.getSnapshotData());
                        result.put("author", version.getAuthorId());
                        result.put("message", version.getMessage());
                        result.put("committedAt", version.getCommittedAt());
                        return result;
                    })
            );
    }

    /**
     * 14. Get Environment by Name Purpose: Get a specific environment configuration from the version chain.
     *
     * @param envName the environment name (slug)
     * @param branch  the branch to read from (defaults to master)
     */
    @GetMapping("/environment/{envName}")
    public Mono<Map<String, Object>> getEnvironment(
        @PathVariable String envName,
        @RequestParam(defaultValue = "master") String branch)
    {

        log.debug("Fetching environment from version chain: {}", envName);

        return kernelService.getResourceSnapshot("ENVIRONMENT", envName, branch)
            .map(snapshotData ->
            {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("envName", envName);
                response.put("branch", branch);
                response.put("snapshotData", snapshotData);
                return response;
            })
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Environment not found: " + envName)));
    }

    /**
     * 15. Save Environment Configuration Purpose: Create or update an environment as a version-controlled entity. This
     * commits the environment configuration to the 'ENVIRONMENT' entity type.
     * <p>
     * Request Body: { "envName": "UAT", "mappedBranch": "release-v2", "mappedCommitId": null, "description": "UAT
     * environment for v2 testing" }
     */
    @PostMapping("/environment/save")
    public Mono<Map<String, Object>> saveEnvironment(
        @RequestBody EnvironmentConfigDto dto,
        @RequestParam(defaultValue = "master") String branch,
        @RequestParam(defaultValue = "system") String author)
    {

        if (dto.envName() == null || dto.envName().isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "envName is required"));
        }

        log.info("💾 Save environment request via version chain: {}", dto.envName());

        try
        {
            // Convert DTO to JSON for version chain storage
            String jsonContent = new ObjectMapper()
                .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
                .writeValueAsString(dto);

            return kernelService.commit(
                    "ENVIRONMENT",           // entityType
                    dto.envName(),           // slug (environment name)
                    branch,                  // branch
                    jsonContent,             // JSON content
                    author,                  // author
                    "Environment configuration: " + dto.envName()  // commit message
                )
                .map(commitId ->
                {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("success", true);
                    response.put("message", String.format("Environment '%s' committed successfully", dto.envName()));
                    response.put("commitId", commitId);
                    response.put("entityType", "ENVIRONMENT");
                    response.put("slug", dto.envName());
                    response.put("branch", branch);
                    return response;
                })
                .onErrorResume(Exception.class, e ->
                    Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())));
        }
        catch (JsonProcessingException e)
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Failed to serialize environment: " + e.getMessage()));
        }
    }

    /**
     * 16. Delete Environment Configuration Purpose: Delete an environment configuration.
     *
     * @param envName the environment name to delete
     */
    @DeleteMapping("/environment/{envName}")
    public Mono<Map<String, Object>> deleteEnvironment(@PathVariable String envName)
    {
        log.info("🗑️ Delete environment request: {}", envName);

        return environmentService.findByName(envName)
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Environment not found: " + envName)))
            .flatMap(existing -> environmentService.delete(envName)
                .thenReturn(Map.<String, Object>of(
                    "success", true,
                    "message", String.format("Environment '%s' deleted successfully", envName)
                )));
    }

    /**
     * 17. Resolve Active Commit for Environment Purpose: (Crucial for external apps) Resolve the active commit ID for a
     * given environment.
     * <p>
     * Returns: - If environment is pinned: the pinned commit ID - If using branch HEAD: null (client should query
     * branch HEAD)
     *
     * @param envName the environment name
     */
    @GetMapping("/environment/resolve")
    public Mono<Map<String, Object>> resolveEnvironment(@RequestParam String envName)
    {
        if (envName == null || envName.isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "envName parameter is required"));
        }

        log.debug("🔍 Resolving environment: {}", envName);

        return environmentService.resolveActiveCommit(envName)
            .onErrorResume(IllegalArgumentException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage())));
    }

    /**
     * 18. Pin Environment to Commit Purpose: Pin an environment to a specific commit for stable testing.
     *
     * @param envName  the environment name
     * @param commitId the commit ID to pin to
     */
    @PostMapping("/environment/{envName}/pin")
    public Mono<Map<String, Object>> pinEnvironment(
        @PathVariable String envName,
        @RequestParam Long commitId)
    {

        log.info("📌 Pin environment request: {} -> commit {}", envName, commitId);

        return environmentService.pinToCommit(envName, commitId)
            .map(config ->
            {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("success", true);
                response.put("message", String.format("Environment '%s' pinned to commit %d", envName, commitId));
                response.put("environment", EnvironmentConfigDto.fromEntity(config));
                return response;
            })
            .onErrorResume(IllegalArgumentException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage())));
    }

    /**
     * 19. Unpin Environment Purpose: Unpin an environment to use branch HEAD instead.
     *
     * @param envName the environment name
     */
    @PostMapping("/environment/{envName}/unpin")
    public Mono<Map<String, Object>> unpinEnvironment(@PathVariable String envName)
    {
        log.info("📌 Unpin environment request: {}", envName);

        return environmentService.unpinFromCommit(envName)
            .map(config ->
            {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("success", true);
                response.put("message", String.format("Environment '%s' unpinned (now uses branch HEAD)", envName));
                response.put("environment", EnvironmentConfigDto.fromEntity(config));
                return response;
            })
            .onErrorResume(IllegalArgumentException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage())));
    }

    // ==================== Schema Management Endpoints ====================

    /**
     * 20. Commit Schema Definition Purpose: Commit a new version of a JSON Schema definition.
     *
     * <p>Schema entities are stored with:
     * <ul>
     *   <li>entityType = 'SCHEMA'</li>
     *   <li>slug = the target entity type (e.g., 'LOGIC')</li>
     * </ul>
     * <p>
     * Request Body: {
     *   "targetType": "LOGIC",
     *   "jsonSchemaContent": "{\"type\": \"object\", \"properties\": {...}}",
     *   "author": "admin",
     *   "message": "Added required fields validation"
     * }
     */
    @PostMapping("/schema/commit")
    public Mono<Map<String, Object>> commitSchema(@RequestBody SchemaCommitRequest request)
    {
        if (request.targetType() == null || request.targetType().isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "targetType is required"));
        }
        if (request.jsonSchemaContent() == null || request.jsonSchemaContent().isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "jsonSchemaContent is required"));
        }

        // Validate that the schema content is valid JSON Schema
        try
        {
            com.networknt.schema.JsonSchemaFactory factory =
                com.networknt.schema.JsonSchemaFactory.getInstance(
                    com.networknt.schema.SpecVersion.VersionFlag.V7);
            factory.getSchema(request.jsonSchemaContent());
        }
        catch (Exception e)
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Invalid JSON Schema: " + e.getMessage()));
        }

        log.info("📋 Schema commit request for type: {}", request.targetType());

        return kernelService.commit(
                "SCHEMA",
                request.schemaSlug(),
                request.resolvedBranch(),
                request.jsonSchemaContent(),
                request.resolvedAuthor(),
                request.resolvedMessage()
            )
            .map(commitId ->
            {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("success", true);
                response.put("message", String.format("Schema for '%s' committed successfully", request.targetType()));
                response.put("commitId", commitId);
                response.put("targetType", request.targetType());
                response.put("branch", request.resolvedBranch());
                return response;
            })
            .onErrorResume(SchemaValidationException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())));
    }

    /**
     * 21. Get Schema Definition Purpose: Get the current JSON Schema definition for an entity type.
     *
     * @param targetType the entity type to get schema for (e.g., "LOGIC")
     * @param branch     optional branch (defaults to "master")
     */
    @GetMapping("/schema/{targetType}")
    public Mono<Map<String, Object>> getSchema(
        @PathVariable String targetType,
        @RequestParam(defaultValue = "master") String branch)
    {

        log.debug("📋 Fetching schema for type: {} on branch: {}", targetType, branch);

        return kernelService.getResourceSnapshot("SCHEMA", targetType.toUpperCase(), branch)
            .map(schemaContent ->
            {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("targetType", targetType.toUpperCase());
                response.put("branch", branch);
                response.put("schemaContent", schemaContent);
                return response;
            })
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                String.format("No schema defined for entity type '%s' on branch '%s'", targetType, branch)
            )));
    }

    /**
     * 22. List All Schemas Purpose: Get a list of all defined schema entity types.
     */
    @GetMapping("/schemas")
    public Flux<Map<String, Object>> listSchemas()
    {
        log.debug("📋 Listing all schemas");

        return entityRepo.findAll()
            .filter(entity -> "SCHEMA".equalsIgnoreCase(entity.getEntityType()))
            .flatMap(entity ->
                versionRepo.findHeadSnapshot(entity.getId(), "master")
                    .map(version ->
                    {
                        Map<String, Object> result = new LinkedHashMap<>();
                        result.put("targetType", entity.getSlug());
                        result.put("commitId", version.getCommitId());
                        result.put("author", version.getAuthorId());
                        result.put("message", version.getMessage());
                        result.put("committedAt", version.getCommittedAt());
                        return result;
                    })
            );
    }

    /**
     * 23. Clear Schema Cache Purpose: Clear the schema validation cache (useful after schema updates).
     *
     * @param targetType optional - if provided, only clear cache for this type
     */
    @PostMapping("/schema/cache/clear")
    public Mono<Map<String, Object>> clearSchemaCache(
        @RequestParam(required = false) String targetType)
    {

        if (targetType != null && !targetType.isBlank())
        {
            schemaValidator.clearCache(targetType);
            log.info("🗑️ Schema cache cleared for type: {}", targetType);
            return Mono.just(Map.of(
                "success", true,
                "message", String.format("Schema cache cleared for '%s'", targetType)
            ));
        }
        else
        {
            schemaValidator.clearCache();
            log.info("🗑️ All schema caches cleared");
            return Mono.just(Map.of(
                "success", true,
                "message", "All schema caches cleared"
            ));
        }
    }

    /**
     * 24. Get Schema Cache Stats Purpose: Get statistics about the schema validation cache.
     */
    @GetMapping("/schema/cache/stats")
    public Mono<Map<String, Object>> getSchemaCacheStats()
    {
        return Mono.just(schemaValidator.getCacheStats());
    }

    // ==================== Approval Workflow Endpoints ====================

    /**
     * 25. Create Approval Request
     * Purpose: Initiate a commit approval request. The change is staged but not committed until approved.
     *
     * <p>Request Body: {
     *   "targetUri": "ubos://logic/tax-calc?branch=master",
     *   "content": {"name": "Tax Calculator", "version": "2.0"},
     *   "author": "developer",
     *   "message": "Update tax calculation formula"
     * }
     *
     * @param request the approval creation request
     * @return the generated request ID
     */
    @PostMapping("/approval/request")
    public Mono<Map<String, Object>> createApprovalRequest(@RequestBody ApprovalCreateRequest request)
    {
        if (request.targetUri() == null || request.targetUri().isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "targetUri is required"));
        }
        if (request.content() == null || request.content().isEmpty())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "content is required"));
        }

        log.info("📋 Approval request creation: uri={}, author={}",
            request.targetUri(), request.resolvedAuthor());

        try
        {
            // Convert content Map to JSON string
            String jsonContent = objectMapper.writeValueAsString(request.content());

            return approvalService.requestCommit(
                    request.targetUri(),
                    jsonContent,
                    request.resolvedAuthor(),
                    request.resolvedMessage()
                )
                .map(requestId -> {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("success", true);
                    response.put("message", "Approval request created successfully");
                    response.put("requestId", requestId);
                    response.put("targetUri", request.targetUri());
                    response.put("status", ApprovalRequestPayload.STATUS_PENDING);
                    return response;
                })
                .onErrorResume(IllegalArgumentException.class, e ->
                    Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())));
        }
        catch (JsonProcessingException e)
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Failed to serialize content: " + e.getMessage()));
        }
    }

    /**
     * 26. Approve or Reject Request
     * Purpose: Process an approval request - either approve (execute the commit) or reject.
     *
     * <p>Request Body for Approve: {
     *   "requestId": "REQ-ABC12345",
     *   "approver": "admin",
     *   "action": "approve"
     * }
     *
     * <p>Request Body for Reject: {
     *   "requestId": "REQ-ABC12345",
     *   "approver": "admin",
     *   "action": "reject",
     *   "reason": "Changes need revision"
     * }
     *
     * @param request the approval action request
     * @return result of the approval/rejection
     */
    @PostMapping("/approval/approve")
    public Mono<Map<String, Object>> processApprovalRequest(@RequestBody ApprovalActionRequest request)
    {
        if (request.requestId() == null || request.requestId().isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "requestId is required"));
        }
        if (request.action() == null || request.action().isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "action is required (approve or reject)"));
        }

        String approver = request.resolvedApprover();

        if (request.isApprove())
        {
            log.info("✅ Approving request: {} by {}", request.requestId(), approver);

            return approvalService.approveRequest(request.requestId(), approver)
                .map(targetCommitId -> {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("success", true);
                    response.put("message", "Request approved and committed successfully");
                    response.put("requestId", request.requestId());
                    response.put("status", ApprovalRequestPayload.STATUS_APPROVED);
                    response.put("targetCommitId", targetCommitId);
                    response.put("approver", approver);
                    return response;
                })
                .onErrorResume(IllegalArgumentException.class, e ->
                    Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage())))
                .onErrorResume(IllegalStateException.class, e ->
                    Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage())));
        }
        else if (request.isReject())
        {
            if (request.reason() == null || request.reason().isBlank())
            {
                return Mono.error(new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "reason is required for rejection"));
            }

            log.info("❌ Rejecting request: {} by {} - reason: {}",
                request.requestId(), approver, request.reason());

            return approvalService.rejectRequest(request.requestId(), approver, request.reason())
                .map(requestId -> {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("success", true);
                    response.put("message", "Request rejected");
                    response.put("requestId", requestId);
                    response.put("status", ApprovalRequestPayload.STATUS_REJECTED);
                    response.put("approver", approver);
                    response.put("reason", request.reason());
                    return response;
                })
                .onErrorResume(IllegalArgumentException.class, e ->
                    Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage())))
                .onErrorResume(IllegalStateException.class, e ->
                    Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage())));
        }
        else
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Invalid action. Must be 'approve' or 'reject'"));
        }
    }

    /**
     * 27. Get Pending Approval Requests
     * Purpose: Fetch all approval requests with PENDING status (or filtered by status).
     *
     * @param status optional status filter (PENDING, APPROVED, REJECTED, CANCELLED)
     * @return stream of approval requests
     */
    @GetMapping("/approval/pending")
    public Flux<ApprovalRequestPayload> getPendingApprovals(
        @RequestParam(required = false) String status)
    {
        log.debug("📋 Fetching approval requests, status filter: {}", status);

        if (status == null || status.isBlank() || "PENDING".equalsIgnoreCase(status))
        {
            return approvalService.findPending();
        }
        return approvalService.findAll(status);
    }

    /**
     * 28. Get Approval Request Details
     * Purpose: Get detailed information about a specific approval request.
     *
     * @param requestId the approval request ID
     * @return the approval request details
     */
    @GetMapping("/approval/{requestId}")
    public Mono<Map<String, Object>> getApprovalRequest(@PathVariable String requestId)
    {
        if (requestId == null || requestId.isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "requestId is required"));
        }

        log.debug("📋 Fetching approval request: {}", requestId);

        return approvalService.getRequest(requestId)
            .map(payload -> {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("requestId", payload.requestId());
                response.put("targetUri", payload.targetUri());
                response.put("status", payload.status());
                response.put("requestedBy", payload.requestedBy());
                response.put("approver", payload.approver());
                response.put("commitMessage", payload.commitMessage());
                response.put("targetCommitId", payload.targetCommitId());
                response.put("requestedAt", payload.requestedAt());
                response.put("resolvedAt", payload.resolvedAt());
                response.put("rejectionReason", payload.rejectionReason());
                response.put("originalPayload", payload.originalPayload());
                return response;
            })
            .switchIfEmpty(Mono.error(new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Approval request not found: " + requestId)));
    }

    /**
     * 29. Cancel Approval Request
     * Purpose: Cancel a pending approval request (by the original requester).
     *
     * @param requestId the approval request ID
     * @param author the original requester (for verification)
     * @return cancellation result
     */
    @PostMapping("/approval/{requestId}/cancel")
    public Mono<Map<String, Object>> cancelApprovalRequest(
        @PathVariable String requestId,
        @RequestParam String author)
    {
        if (requestId == null || requestId.isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "requestId is required"));
        }
        if (author == null || author.isBlank())
        {
            return Mono.error(new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "author is required"));
        }

        log.info("🚫 Cancel approval request: {} by {}", requestId, author);

        return approvalService.cancelRequest(requestId, author)
            .map(id -> {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("success", true);
                response.put("message", "Approval request cancelled");
                response.put("requestId", id);
                response.put("status", ApprovalRequestPayload.STATUS_CANCELLED);
                return response;
            })
            .onErrorResume(IllegalArgumentException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage())))
            .onErrorResume(IllegalStateException.class, e ->
                Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage())));
    }
    /**
     * Navigate entities by namespace (dot-separated slug prefix).
     *
     * <p>Example:
     * GET /api/console/entities/navigate?pathPrefix=finance.taxes&type=LOGIC
     *
     * <p>Returns:
     * - namespaces: immediate child "folders" under the prefix
     * - entities: immediate child entities (leaf slugs) under the prefix
     *
     * Future-proofed with optional tenantId/groupId parameter for data isolation.
     */
    @GetMapping("/entities/navigate")
    public Mono<Map<String, Object>> navigateEntities(
        @RequestParam(defaultValue = "") String pathPrefix,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String tenantId,
        @RequestParam(required = false) String groupId)
    {
        // TODO: When multi-tenancy is implemented, filter by tenantId/groupId

        String normalizedPrefix = normalizePathPrefix(pathPrefix);
        String prefixWithDot = normalizedPrefix.isBlank() ? "" : (normalizedPrefix + ".");

        return kernelService.findBySlugPrefix(normalizedPrefix, type)
            .collectList()
            .map(allMatches -> {
                Set<String> namespaces = new TreeSet<>();
                List<LcmEntityInstance> entities = new java.util.ArrayList<>();

                for (LcmEntityInstance e : allMatches) {
                    String slug = e.getSlug();
                    if (slug == null) continue;
                    if (!prefixWithDot.isEmpty() && !slug.startsWith(prefixWithDot)) {
                        continue;
                    }

                    String remainder = prefixWithDot.isEmpty() ? slug : slug.substring(prefixWithDot.length());
                    if (remainder.isBlank()) {
                        continue;
                    }

                    int nextDot = remainder.indexOf('.');
                    if (nextDot >= 0) {
                        namespaces.add(remainder.substring(0, nextDot));
                    } else {
                        entities.add(e);
                    }
                }

                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("pathPrefix", normalizedPrefix);
                resp.put("type", type);
                resp.put("tenantId", tenantId);
                resp.put("groupId", groupId);
                resp.put("namespaces", namespaces);
                resp.put("entities", entities);
                resp.put("totalMatches", allMatches.size());
                return resp;
            });
    }

    private String normalizePathPrefix(String prefix) {
        if (prefix == null) return "";
        String p = prefix.trim();
        while (p.startsWith(".")) p = p.substring(1);
        while (p.endsWith(".")) p = p.substring(0, p.length() - 1);
        return p;
    }
    /**
     * Rename (move) an entity by changing its slug (dot-separated path).
     */
    @PostMapping("/entity/rename")
    public Mono<Map<String, Object>> renameEntity(@RequestBody RenameRequest request) {
        if (request == null || request.uriString() == null || request.uriString().isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "uriString is required"));
        }
        if (request.newSlug() == null || request.newSlug().isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "newSlug is required"));
        }

        // AuthZ: treat rename as COMMIT against the *current* uri
        return authzService.getCurrentUser()
            .flatMap(userId -> authzService.isPermitted(userId, LcmAuthzService.ACTION_COMMIT, request.uriString()))
            .flatMap(permitted -> {
                if (!permitted) {
                    return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "Not permitted to rename entity"));
                }
                return kernelService.renameEntity(
                    request.uriString(),
                    request.newSlug(),
                    request.resolvedAuthor(),
                    request.resolvedMessage()
                );
            })
            .map(commitId -> {
                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("success", true);
                resp.put("message", "Rename completed");
                resp.put("commitId", commitId);
                resp.put("uri", request.uriString());
                resp.put("newSlug", request.newSlug());
                return resp;
            });
    }

    /**
     * Copy an entity snapshot to a new slug and branch.
     */
    @PostMapping("/entity/copy")
    public Mono<Map<String, Object>> copyEntity(@RequestBody CopyRequest request) {
        if (request == null || request.sourceUriString() == null || request.sourceUriString().isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceUriString is required"));
        }
        if (request.targetSlug() == null || request.targetSlug().isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetSlug is required"));
        }

        // AuthZ: treat copy as COMMIT against the *target* uri
        UbosUriUtil.UbosUriDetails src = UbosUriUtil.parse(request.sourceUriString());
        String targetUri = UbosUriUtil.build(src.type(), request.targetSlug(), request.resolvedTargetBranch());

        return authzService.getCurrentUser()
            .flatMap(userId -> authzService.isPermitted(userId, LcmAuthzService.ACTION_COMMIT, targetUri))
            .flatMap(permitted -> {
                if (!permitted) {
                    return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "Not permitted to copy entity"));
                }
                return kernelService.copyEntity(
                    request.sourceUriString(),
                    request.targetSlug(),
                    request.resolvedTargetBranch(),
                    request.resolvedAuthor(),
                    request.resolvedMessage()
                );
            })
            .map(commitId -> {
                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("success", true);
                resp.put("message", "Copy completed");
                resp.put("commitId", commitId);
                resp.put("sourceUri", request.sourceUriString());
                resp.put("targetSlug", request.targetSlug());
                resp.put("targetBranch", request.resolvedTargetBranch());
                return resp;
            });
    }

    /**
     * Get branch difference (NEW/DELETED/MODIFIED) between two branches.
     */
    @GetMapping("/status/diff")
    public Flux<Map<String, Object>> branchDiff(
        @RequestParam String currentBranch,
        @RequestParam String baseBranch
    ) {
        if (currentBranch == null || currentBranch.isBlank()) {
            return Flux.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "currentBranch is required"));
        }
        if (baseBranch == null || baseBranch.isBlank()) {
            return Flux.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "baseBranch is required"));
        }
        return kernelService.getBranchDifference(currentBranch, baseBranch);
    }

}