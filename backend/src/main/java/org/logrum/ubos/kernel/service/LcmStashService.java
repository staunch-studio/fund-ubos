package org.logrum.ubos.kernel.service;

import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class LcmStashService {

    private final DatabaseClient dbClient;
    private final LcmKernelService kernelService;

    public Mono<Long> saveDraft(String userId, String entityId, String baseBranch, String payload) {
        if (userId == null || userId.isBlank()) {
            return Mono.error(new IllegalArgumentException("userId is required"));
        }
        if (entityId == null || entityId.isBlank()) {
            return Mono.error(new IllegalArgumentException("entityId is required"));
        }
        String resolvedBaseBranch = (baseBranch == null || baseBranch.isBlank()) ? "main" : baseBranch;
        if (payload == null) {
            return Mono.error(new IllegalArgumentException("payload is required"));
        }

        String draftBranch = draftBranchName(userId, resolvedBaseBranch);

        return ensureBranchExists(draftBranch, resolvedBaseBranch,
                "User draft branch (stash) for " + userId + " based on " + resolvedBaseBranch)
            .then(loadEntityTypeAndSlug(entityId))
            .flatMap(meta ->
                kernelService.commitWithoutValidation(
                    meta.type(),
                    meta.slug(),
                    draftBranch,
                    payload,
                    userId,
                    "DRAFT/STASH update for entityId=" + entityId + " baseBranch=" + resolvedBaseBranch
                )
            );
    }

    public Mono<String> getDraftPayload(String userId, String entityId, String baseBranch) {
        if (userId == null || userId.isBlank()) {
            return Mono.error(new IllegalArgumentException("userId is required"));
        }
        if (entityId == null || entityId.isBlank()) {
            return Mono.error(new IllegalArgumentException("entityId is required"));
        }
        String resolvedBaseBranch = (baseBranch == null || baseBranch.isBlank()) ? "main" : baseBranch;
        String draftBranch = draftBranchName(userId, resolvedBaseBranch);

        return loadEntityTypeAndSlug(entityId)
            .flatMap(meta ->
                // IMPORTANT: read by type/slug/branch (branch = draft branch)
                kernelService.getResourceSnapshot(meta.type(), meta.slug(), draftBranch)
            );
    }

    private Mono<Void> ensureBranchExists(String branchName, String parentBranch, String description) {
        String sql = """
            INSERT INTO sys_branch_config (branch_name, parent_branch, description)
            VALUES (:branchName, :parentBranch, :description)
            ON CONFLICT (branch_name) DO NOTHING
        """;
        return dbClient.sql(sql)
            .bind("branchName", branchName)
            .bind("parentBranch", parentBranch)
            .bind("description", description)
            .then();
    }

    private Mono<EntityMeta> loadEntityTypeAndSlug(String entityId) {
        String sql = """
            SELECT entity_type, slug
            FROM lcm_entity_instance
            WHERE id = :entityId
            LIMIT 1
        """;
        return dbClient.sql(sql)
            .bind("entityId", entityId)
            .map((row, meta) -> new EntityMeta(
                row.get("entity_type", String.class),
                row.get("slug", String.class)
            ))
            .one()
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Entity not found: " + entityId)));
    }

    private String draftBranchName(String userId, String baseBranch) {
        // keep it deterministic and readable; avoid spaces
        String safeUser = userId.trim().replaceAll("\\s+", "_");
        String safeBase = baseBranch.trim().replaceAll("\\s+", "_");
        return "draft/" + safeUser + "/" + safeBase;
    }

    private record EntityMeta(String type, String slug) {}
}
