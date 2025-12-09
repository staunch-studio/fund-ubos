package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.logrum.ubos.kernel.model.LcmEntityInstance;
import org.logrum.ubos.kernel.model.LcmEntitySearchIndex;
import org.logrum.ubos.kernel.model.LcmEntityVersionChain;
import org.logrum.ubos.kernel.repository.LcmEntityRepository;
import org.logrum.ubos.kernel.repository.LcmSearchIndexRepository;
import org.logrum.ubos.kernel.repository.LcmVersionRepository;
import org.logrum.ubos.kernel.util.ReactiveRetry; 
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    
    private final Retry retryPolicy = ReactiveRetry.databaseTransientErrors();

    
    
    

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

    
    
    

    
    public Mono<Long> commit(String type, String slug, String branch, String jsonContent, String author, String msg) {
        return commit(type, slug, branch, jsonContent, author, msg, null);
    }

    @Transactional
    public Mono<Long> commit(String type, String slug, String branch, String jsonContent, String author, String msg, String processId) {
        return entityRepo.findByEntityTypeAndSlug(type, slug)
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
                    );
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
}