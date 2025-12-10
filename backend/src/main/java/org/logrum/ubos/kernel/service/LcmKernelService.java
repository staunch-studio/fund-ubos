package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import org.logrum.ubos.kernel.model.LcmEntityInstance;
import org.logrum.ubos.kernel.model.LcmEntitySearchIndex;
import org.logrum.ubos.kernel.model.LcmEntityVersionChain;
import org.logrum.ubos.kernel.repository.LcmEntityRepository;
import org.logrum.ubos.kernel.repository.LcmSearchIndexRepository;
import org.logrum.ubos.kernel.repository.LcmVersionRepository;
import org.logrum.ubos.kernel.util.JsonSchemaValidator;
import org.logrum.ubos.kernel.util.ReactiveRetry;
import org.logrum.ubos.web.console.dto.BranchInfo;
import org.logrum.ubos.web.console.dto.MergeRequest;
import org.logrum.ubos.web.console.dto.MergeResult;
import org.logrum.ubos.web.console.dto.RevertRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.util.UbosUriUtil;
import org.logrum.ubos.kernel.util.UbosUriUtil.UbosUriDetails;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class LcmKernelService {

    private final LcmEntityRepository entityRepo;
    private final LcmVersionRepository versionRepo;
    private final LcmSearchIndexRepository indexRepo;
    private final DatabaseClient dbClient;
    private final ObjectMapper objectMapper;
    private final JsonSchemaValidator schemaValidator;
    private final ApiKeyService apiKeyService;
    private final WebhookService webhookService;

    private final Retry retryPolicy = ReactiveRetry.databaseTransientErrors();

    /**
     * Initialize dependent services after construction.
     */
    @PostConstruct
    public void init() {
        schemaValidator.setSchemaFetcher(this::getResourceSnapshot);
        apiKeyService.setKernelService(this);
        webhookService.setKernelService(this);
        log.info("📋 Kernel service initialized with schema validator, API key service, and webhook service");
    }

    /**
     * Get resource snapshot using a parsed UBOS URI.
     *
     * @param uriDetails the parsed URI details containing type, slug, branch, and optional commitId
     * @return the JSON snapshot content
     */
    public Mono<String> getResourceSnapshot(UbosUriUtil.UbosUriDetails uriDetails) {
        // If a specific commitId is provided, retrieve that exact version
        if (uriDetails.hasCommitId()) {
            return getSnapshotByCommit(uriDetails.commitId());
        }
        // Otherwise, get the latest snapshot for the branch
        return getResourceSnapshot(uriDetails.type(), uriDetails.slug(), uriDetails.branch());
    }

    public Mono<String> getResourceSnapshot(String type, String slug, String branch) {
        return findInBranchRecursive(type, slug, branch);
    }

    public Mono<String> getSnapshotByCommit(Long commitId) {
        return versionRepo.findById(commitId)
            .map(LcmEntityVersionChain::getSnapshotData)
            .retryWhen(retryPolicy); 
    }

    
    private Mono<String> findInBranchRecursive(String type, String slug, String currentBranch) {
        
        return entityRepo.findByEntityTypeAndSlug(type, slug)
            .flatMap(entity -> versionRepo.findHeadSnapshot(entity.getId(), currentBranch))
            .map(LcmEntityVersionChain::getSnapshotData)

            
            .retryWhen(retryPolicy)

            
            .switchIfEmpty(Mono.defer(() -> {
                return getParentBranchName(currentBranch)
                    .defaultIfEmpty(!"master".equalsIgnoreCase(currentBranch) ? "master" : "")
                    .filter(p -> !p.isBlank())
                    .flatMap(parentBranch -> {
                        log.info("🔍 Resource [{}::{}] missing in [{}], fallback to parent [{}]",
                            type, slug, currentBranch, parentBranch);
                        
                        return findInBranchRecursive(type, slug, parentBranch);
                    });
            }));
    }

    
    private Mono<String> getParentBranchName(String branch) {
        String sql = "SELECT parent_branch FROM sys_branch_config WHERE branch_name = :branch";
        return dbClient.sql(sql)
            .bind("branch", branch)
            .map((row, meta) -> {
                String val = row.get("parent_branch", String.class);
                return val != null ? val : "";
            })
            .one()
            .retryWhen(retryPolicy) 
            .filter(s -> !s.isEmpty());
    }

    public Flux<Map<String, Object>> search(String type, String branch, Map<String, Object> filters) {
        

        if (filters.isEmpty()) {
            String sql = """
                SELECT COALESCE(v.snapshot_data, '{}') as snapshot_data_safe 
                FROM lcm_entity_instance i
                JOIN lcm_entity_branch_head h ON i.id = h.entity_id
                JOIN lcm_entity_version_chain v ON h.head_commit_id = v.commit_id
                WHERE i.entity_type = :type AND h.branch_name = :branch
            """;

            return dbClient.sql(sql)
                .bind("type", type)
                .bind("branch", branch)
                .map((row, meta) -> parseJsonToMap(row.get("snapshot_data_safe", String.class)))
                .all()
                .retryWhen(retryPolicy); 
        } else {
            String sql = """
                SELECT COALESCE(v.snapshot_data, '{}') as snapshot_data_safe
                -- ... (rest of joins) ...
                WHERE i.entity_type = :type AND h.branch_name = :branch AND idx.prop_name = :propName AND idx.val_text = :valText
            """;

            
            return dbClient.sql(sql)
                .bind("type", type)
                .bind("branch", branch)
                .bind("propName", filters.keySet().iterator().next())
                .bind("valText", filters.values().iterator().next().toString())
                .map((row, meta) -> parseJsonToMap(row.get("snapshot_data_safe", String.class)))
                .all()
                .retryWhen(retryPolicy); 
        }
    }

    /**
     * Perform full-text search across entity snapshots using the search index.
     * 
     * <p>This method searches the lcm_entity_search_index table for matches
     * and returns entity information along with matched field details.
     *
     * @param query  the search query string (will be matched with LIKE)
     * @param branch the branch to search in (optional, defaults to all branches if null)
     * @param type   the entity type to filter by (optional, searches all types if null)
     * @param limit  maximum number of results to return
     * @return Flux of search result maps
     */
    public Flux<Map<String, Object>> searchFullText(String query, String branch, String type, int limit) {
        log.debug("🔍 Full-text search: query='{}', branch='{}', type='{}', limit={}", 
                 query, branch, type, limit);

        // Build dynamic SQL based on provided filters
        StringBuilder sqlBuilder = new StringBuilder("""
            SELECT DISTINCT 
                i.id as entity_id,
                i.entity_type,
                i.slug,
                h.branch_name,
                h.head_commit_id as commit_id,
                idx.prop_name as matched_field,
                idx.val_text as matched_value,
                v.snapshot_data
            FROM lcm_entity_search_index idx
            JOIN lcm_entity_version_chain v ON idx.commit_id = v.commit_id
            JOIN lcm_entity_instance i ON v.entity_id = i.id
            JOIN lcm_entity_branch_head h ON i.id = h.entity_id AND h.head_commit_id = v.commit_id
            WHERE idx.val_text ILIKE :queryPattern
        """);

        if (branch != null && !branch.isBlank()) {
            sqlBuilder.append(" AND h.branch_name = :branch");
        }
        if (type != null && !type.isBlank()) {
            sqlBuilder.append(" AND i.entity_type = :type");
        }

        sqlBuilder.append(" ORDER BY i.slug LIMIT :limit");

        String sql = sqlBuilder.toString();
        String queryPattern = "%" + query + "%";

        var spec = dbClient.sql(sql)
            .bind("queryPattern", queryPattern)
            .bind("limit", limit);

        if (branch != null && !branch.isBlank()) {
            spec = spec.bind("branch", branch);
        }
        if (type != null && !type.isBlank()) {
            spec = spec.bind("type", type.toUpperCase());
        }

        return spec
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("entityId", row.get("entity_id", String.class));
                result.put("entityType", row.get("entity_type", String.class));
                result.put("slug", row.get("slug", String.class));
                result.put("branchName", row.get("branch_name", String.class));
                result.put("commitId", row.get("commit_id", Long.class));
                result.put("matchedField", row.get("matched_field", String.class));
                result.put("matchedValue", row.get("matched_value", String.class));
                result.put("snapshotData", row.get("snapshot_data", String.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Search entities by slug pattern using LIKE matching.
     * 
     * @param slugPattern the slug pattern to search for
     * @param branch      the branch to search in (optional)
     * @param limit       maximum number of results
     * @return Flux of matching entity snapshots
     */
    public Flux<Map<String, Object>> searchBySlug(String slugPattern, String branch, int limit) {
        log.debug("🔍 Slug search: pattern='{}', branch='{}', limit={}", slugPattern, branch, limit);

        StringBuilder sqlBuilder = new StringBuilder("""
            SELECT 
                i.id as entity_id,
                i.entity_type,
                i.slug,
                h.branch_name,
                h.head_commit_id as commit_id,
                v.snapshot_data
            FROM lcm_entity_instance i
            JOIN lcm_entity_branch_head h ON i.id = h.entity_id
            JOIN lcm_entity_version_chain v ON h.head_commit_id = v.commit_id
            WHERE i.slug ILIKE :slugPattern
        """);

        if (branch != null && !branch.isBlank()) {
            sqlBuilder.append(" AND h.branch_name = :branch");
        }

        sqlBuilder.append(" ORDER BY i.slug LIMIT :limit");

        String sql = sqlBuilder.toString();
        String pattern = "%" + slugPattern + "%";

        var spec = dbClient.sql(sql)
            .bind("slugPattern", pattern)
            .bind("limit", limit);

        if (branch != null && !branch.isBlank()) {
            spec = spec.bind("branch", branch);
        }

        return spec
            .map((row, meta) -> {
                Map<String, Object> result = new HashMap<>();
                result.put("entityId", row.get("entity_id", String.class));
                result.put("entityType", row.get("entity_type", String.class));
                result.put("slug", row.get("slug", String.class));
                result.put("branchName", row.get("branch_name", String.class));
                result.put("commitId", row.get("commit_id", Long.class));
                result.put("snapshotData", row.get("snapshot_data", String.class));
                return result;
            })
            .all()
            .retryWhen(retryPolicy);
    }

    
    
    

    
    public Mono<Long> commit(String type, String slug, String branch, String jsonContent, String author, String msg) {
        return commit(type, slug, branch, jsonContent, author, msg, null);
    }

    @Transactional
    public Mono<Long> commit(String type, String slug, String branch, String jsonContent, String author, String msg, String processId) {
        // Step 0: Validate JSON against schema (skip for SCHEMA type)
        return schemaValidator.validate(type, slug, jsonContent)
            .then(entityRepo.findByEntityTypeAndSlug(type, slug))
            .switchIfEmpty(createEntity(type, slug))
            .flatMap(entity -> {
                return versionRepo.findHeadSnapshot(entity.getId(), branch)
                    .map(LcmEntityVersionChain::getCommitId)
                    .defaultIfEmpty(0L)
                    .flatMap(parentId -> {
                        Long actualParentId = (parentId == 0L) ? null : parentId;

                        LcmEntityVersionChain newCommit = LcmEntityVersionChain.builder()
                            .entityId(entity.getId())
                            .branchName(branch)
                            .parentCommitId(actualParentId)
                            .snapshotData(jsonContent)
                            .authorId(author)
                            .message(msg)
                            .committedAt(LocalDateTime.now())
                            .build();

                        
                        return versionRepo.save(newCommit)
                            .retryWhen(retryPolicy); 
                    })
                    .flatMap(savedCommit ->
                        
                        createIndex(savedCommit.getCommitId(), jsonContent)
                            
                            .then(updateBranchHead(entity.getId(), branch, savedCommit.getCommitId()))
                            
                            .then(linkProcess(processId, savedCommit.getCommitId()))
                            .thenReturn(savedCommit.getCommitId())
                    )
                    .doOnSuccess(commitId -> {
                        // Clear schema cache if we just updated a SCHEMA entity
                        if ("SCHEMA".equalsIgnoreCase(type)) {
                            schemaValidator.clearCache(slug);
                            log.info("📋 Schema cache cleared for {} after commit", slug);
                        }
                    });
            });
    }

    
    

    
    public Mono<String> startProcess(String processName, String operator) {
        String processId = UUID.randomUUID().toString();
        String sql = "INSERT INTO lcm_process_commit_log (process_id, process_name, operator_id, started_at) VALUES (:pid, :name, :op, NOW())";
        return dbClient.sql(sql)
            .bind("pid", processId)
            .bind("name", processName)
            .bind("op", operator)
            .then()
            .thenReturn(processId)
            .retryWhen(retryPolicy); 
    }

    
    private Mono<Void> linkProcess(String processId, Long commitId) {
        if (processId == null || processId.isBlank()) return Mono.empty();

        String sql = "INSERT INTO lcm_process_entity_map (process_id, commit_id) VALUES (:pid, :cid)";
        return dbClient.sql(sql)
            .bind("pid", processId)
            .bind("cid", commitId)
            .then()
            .retryWhen(retryPolicy); 
    }

    
    

    
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonToMap(String json) {
        if (json == null || json.isBlank()) {
            log.warn("Attempted to parse NULL or Blank JSON snapshot.");
            return Collections.emptyMap();
        }
        try {
            return (Map<String, Object>) objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            log.error("Failed to parse snapshot JSON: " + json, e);
            return Collections.emptyMap();
        }
    }

    
    private Mono<LcmEntityInstance> createEntity(String type, String slug) {
        LcmEntityInstance entity = new LcmEntityInstance();
        entity.setId(UUID.randomUUID().toString());
        entity.setEntityType(type);
        entity.setSlug(slug);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setNewEntity(true);
        return entityRepo.save(entity)
            .retryWhen(retryPolicy); 
    }

    
    private Mono<Void> updateBranchHead(String entityId, String branch, Long newCommitId) {
        String sql = """
            INSERT INTO lcm_entity_branch_head (entity_id, branch_name, head_commit_id, updated_at)
            VALUES (:eid, :branch, :cid, NOW())
            ON CONFLICT (entity_id, branch_name) 
            DO UPDATE SET head_commit_id = :cid, updated_at = NOW()
        """;
        return dbClient.sql(sql)
            .bind("eid", entityId)
            .bind("branch", branch)
            .bind("cid", newCommitId)
            .then()
            .retryWhen(retryPolicy); 
    }

    private Mono<Void> createIndex(Long commitId, String jsonContent) {
        
        
        return indexRepo.saveAll(Collections.emptyList())
            .then()
            .retryWhen(retryPolicy); 
    }

    public Mono<Boolean> exists(String slug) {
        String sql = "SELECT COUNT(1) FROM lcm_entity_instance WHERE slug = :slug";
        return dbClient.sql(sql)
            .bind("slug", slug)
            .map((row, metadata) -> {
                Long count = row.get(0, Long.class);
                return count != null && count > 0;
            })
            .one()
            .defaultIfEmpty(false);
    }

    // ==================== Branch Management Methods ====================

    /**
     * Revert an entity's branch HEAD to a specified historical commit.
     * This effectively "undoes" later changes by moving the HEAD pointer.
     *
     * @param request the revert request containing slug, type, branch, targetCommitId, and message
     * @return Mono<Long> the target commit ID if successful
     */
    @Transactional
    public Mono<Long> revertToCommit(RevertRequest request) {
        String type = request.resolvedType();
        String branch = request.resolvedBranch();
        Long targetCommitId = request.targetCommitId();
        
        log.info("🔄 Reverting {}/{}@{} to commit {}", type, request.slug(), branch, targetCommitId);
        
        return entityRepo.findByEntityTypeAndSlug(type, request.slug())
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                String.format("Entity not found: %s/%s", type, request.slug()))))
            .flatMap(entity -> 
                // Verify the target commit exists and belongs to this entity
                versionRepo.findById(targetCommitId)
                    .filter(commit -> commit.getEntityId().equals(entity.getId()))
                    .switchIfEmpty(Mono.error(new IllegalArgumentException(
                        String.format("Commit %d not found or does not belong to entity %s/%s", 
                                     targetCommitId, type, request.slug()))))
                    .flatMap(commit -> {
                        // Update the branch HEAD to point to the target commit
                        String sql = """
                            UPDATE lcm_entity_branch_head 
                            SET head_commit_id = :commitId, updated_at = NOW()
                            WHERE entity_id = :entityId AND branch_name = :branch
                        """;
                        return dbClient.sql(sql)
                            .bind("commitId", targetCommitId)
                            .bind("entityId", entity.getId())
                            .bind("branch", branch)
                            .fetch()
                            .rowsUpdated()
                            .flatMap(rowsUpdated -> {
                                if (rowsUpdated == 0) {
                                    return Mono.error(new IllegalArgumentException(
                                        String.format("No HEAD found for entity %s/%s on branch %s", 
                                                     type, request.slug(), branch)));
                                }
                                log.info("✅ Reverted {}/{}@{} to commit {}", type, request.slug(), branch, targetCommitId);
                                return Mono.just(targetCommitId);
                            });
                    })
            )
            .retryWhen(retryPolicy);
    }

    /**
     * Create a new branch with its HEAD pointing to a specific commit.
     *
     * @param newBranchName    the name of the new branch
     * @param baseCommitId     the commit ID to base the new branch on
     * @param parentBranchName the parent branch for inheritance (nullable, defaults behavior)
     * @param description      optional description for the branch
     * @return Mono<String> the new branch name if successful
     */
    @Transactional
    public Mono<String> createBranch(String newBranchName, Long baseCommitId,
                                      String parentBranchName, String description) {
        log.info("🌿 Creating branch '{}' based on commit {}, parent: {}",
                newBranchName, baseCommitId, parentBranchName);

        String resolvedParent = (parentBranchName == null || parentBranchName.isBlank())
                               ? "master" : parentBranchName;
        String resolvedDescription = (description == null || description.isBlank())
                                    ? "Branch created from commit " + baseCommitId : description;

        // First, verify the base commit exists
        return versionRepo.findById(baseCommitId)
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                "Base commit not found: " + baseCommitId)))
            .flatMap(baseCommit -> {
                // Insert the new branch into sys_branch_config
                String insertBranchSql = """
                    INSERT INTO sys_branch_config (branch_name, parent_branch, description)
                    VALUES (:branchName, :parentBranch, :description)
                """;
                return dbClient.sql(insertBranchSql)
                    .bind("branchName", newBranchName)
                    .bind("parentBranch", resolvedParent)
                    .bind("description", resolvedDescription)
                    .then()
                    .then(Mono.defer(() -> {
                        // Create a HEAD entry for the entity of the base commit
                        String insertHeadSql = """
                            INSERT INTO lcm_entity_branch_head (entity_id, branch_name, head_commit_id, updated_at)
                            VALUES (:entityId, :branchName, :commitId, NOW())
                            ON CONFLICT (entity_id, branch_name) DO NOTHING
                        """;
                        return dbClient.sql(insertHeadSql)
                            .bind("entityId", baseCommit.getEntityId())
                            .bind("branchName", newBranchName)
                            .bind("commitId", baseCommitId)
                            .then();
                    }))
                    .thenReturn(newBranchName);
            })
            .doOnSuccess(name -> log.info("✅ Branch '{}' created successfully", name))
            .retryWhen(retryPolicy);
    }

    /**
     * Get all available branches from sys_branch_config.
     *
     * @return Flux<BranchInfo> stream of branch information
     */
    public Flux<BranchInfo> getAvailableBranches() {
        String sql = "SELECT branch_name, parent_branch, description FROM sys_branch_config ORDER BY branch_name";
        return dbClient.sql(sql)
            .map((row, meta) -> new BranchInfo(
                row.get("branch_name", String.class),
                row.get("parent_branch", String.class),
                row.get("description", String.class)
            ))
            .all()
            .retryWhen(retryPolicy);
    }

    /**
     * Merge a single entity from source branch into target branch.
     * Uses a simplified "Source Wins" strategy for content merging.
     *
     * <p>Logic:
     * <ol>
     *   <li>Get Target HEAD snapshot (base for merge)</li>
     *   <li>Get Source HEAD snapshot (changes to merge in)</li>
     *   <li>Perform content merge (source fields override target fields)</li>
     *   <li>Create new merge commit on target branch</li>
     * </ol>
     *
     * @param sourceBranch the branch to merge from
     * @param targetBranch the branch to merge into
     * @param type         the entity type
     * @param slug         the entity slug
     * @param author       the author performing the merge
     * @param message      the merge commit message
     * @return Mono<Long> the new merge commit ID
     */
    @Transactional
    public Mono<Long> mergeBranch(String sourceBranch, String targetBranch,
                                   String type, String slug,
                                   String author, String message) {
        log.info("🔀 Merging {}/{}@{} -> {}", type, slug, sourceBranch, targetBranch);

        return entityRepo.findByEntityTypeAndSlug(type, slug)
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                String.format("Entity not found: %s/%s", type, slug))))
            .flatMap(entity -> {
                Mono<String> targetSnapshotMono = versionRepo.findHeadSnapshot(entity.getId(), targetBranch)
                    .map(LcmEntityVersionChain::getSnapshotData)
                    .defaultIfEmpty("{}");

                Mono<String> sourceSnapshotMono = versionRepo.findHeadSnapshot(entity.getId(), sourceBranch)
                    .map(LcmEntityVersionChain::getSnapshotData)
                    .switchIfEmpty(Mono.error(new IllegalArgumentException(
                        String.format("No HEAD found for %s/%s on source branch '%s'", type, slug, sourceBranch))));

                return Mono.zip(targetSnapshotMono, sourceSnapshotMono)
                    .flatMap(tuple -> {
                        String targetJson = tuple.getT1();
                        String sourceJson = tuple.getT2();

                        try {
                            String mergedJson = mergeJsonContent(targetJson, sourceJson);

                            if (mergedJson.equals(targetJson)) {
                                log.info("⏭️ No changes to merge for {}/{}@{} -> {}",
                                    type, slug, sourceBranch, targetBranch);
                                return Mono.empty();
                            }

                            String mergeMessage = (message == null || message.isBlank())
                                ? String.format("Merge '%s' into '%s' for %s/%s",
                                    sourceBranch, targetBranch, type, slug)
                                : message;

                            // Validate merged content against schema before commit
                            return schemaValidator.validate(type, slug, mergedJson)
                                .then(commit(type, slug, targetBranch, mergedJson, author, mergeMessage));

                        } catch (JsonProcessingException e) {
                            return Mono.error(new IllegalArgumentException(
                                "Failed to merge JSON content: " + e.getMessage()));
                        }
                    });
            })
            .retryWhen(retryPolicy);
    }

    /**
     * Merge JSON content using a "Source Wins" strategy.
     *
     * <p>This performs a shallow merge where:
     * <ul>
     *   <li>All top-level fields from source are applied to target</li>
     *   <li>Source values override target values for conflicting keys</li>
     *   <li>Target-only fields are preserved</li>
     * </ul>
     *
     * @param targetJson the target branch JSON (base)
     * @param sourceJson the source branch JSON (changes)
     * @return merged JSON string
     * @throws JsonProcessingException if JSON parsing fails
     */
    private String mergeJsonContent(String targetJson, String sourceJson) throws JsonProcessingException
    {
        JsonNode targetNode = objectMapper.readTree(targetJson);
        JsonNode sourceNode = objectMapper.readTree(sourceJson);

        // If target is empty, just use source
        if (targetNode.isEmpty() || targetNode.isNull()) {
            return sourceJson;
        }

        // If source is empty, keep target
        if (sourceNode.isEmpty() || sourceNode.isNull()) {
            return targetJson;
        }

        // Perform merge: source wins for conflicts
        ObjectNode mergedNode = deepMerge(
            (ObjectNode) targetNode.deepCopy(),
            (ObjectNode) sourceNode
        );

        return objectMapper.writeValueAsString(mergedNode);
    }

    /**
     * Deep merge two ObjectNodes with "source wins" conflict resolution.
     *
     * @param target the target node (will be modified)
     * @param source the source node
     * @return merged ObjectNode
     */
    private ObjectNode deepMerge(ObjectNode target, ObjectNode source) {
        Iterator<String> fieldNames = source.fieldNames();
        while (fieldNames.hasNext()) {
            String fieldName = fieldNames.next();
            JsonNode sourceValue = source.get(fieldName);
            JsonNode targetValue = target.get(fieldName);

            if (targetValue != null && targetValue.isObject() && sourceValue.isObject()) {
                // Recursively merge nested objects
                deepMerge((ObjectNode) targetValue, (ObjectNode) sourceValue);
            } else {
                // Source wins: replace target value with source value
                target.set(fieldName, sourceValue.deepCopy());
            }
        }
        return target;
    }

    /**
     * Merge multiple entities from source branch into target branch.
     *
     * @param request the merge request containing source/target branches and slugs
     * @return Flux<MergeResult> stream of merge results for each entity
     */
    public Flux<MergeResult> mergeBranches(MergeRequest request) {
        String sourceBranch = request.sourceBranch();
        String targetBranch = request.resolvedTargetBranch();
        String type = request.resolvedType();
        String author = request.resolvedAuthor();
        String message = request.resolvedMessage();

        log.info("🔀 Batch merge started: {} -> {}, type={}, slugs={}",
            sourceBranch, targetBranch, type, request.slugs());

        return Flux.fromIterable(request.slugs())
            .flatMap(slug ->
                mergeBranch(sourceBranch, targetBranch, type, slug, author, message)
                    .map(commitId -> MergeResult.singleSuccess(slug, commitId))
                    .switchIfEmpty(Mono.just(MergeResult.skipped(slug,
                        String.format("No changes to merge for '%s'", slug))))
                    .onErrorResume(e -> {
                        log.error("❌ Failed to merge {}/{}: {}", type, slug, e.getMessage());
                        return Mono.just(MergeResult.failure(slug, e.getMessage()));
                    })
            );
    }


}