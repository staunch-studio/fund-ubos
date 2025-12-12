package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.util.UbosUriUtil;
import org.logrum.ubos.web.console.dto.ApprovalRequestPayload;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

/**
 * Service for managing commit approval workflows.
 * 
 * <p>Approval requests are stored as entities in the Version Chain with:
 * <ul>
 *   <li>Entity Type: 'APPROVAL_REQUEST'</li>
 *   <li>Slug: Generated requestId (UUID-based)</li>
 * </ul>
 * 
 * <p>This allows full version history and audit trail for approval requests
 * without requiring additional database tables.
 */
@Slf4j
@Service
public class LcmApprovalService {

    private final ObjectMapper objectMapper;
    
    // Lazy reference to LcmKernelService to break circular dependency
    private LcmKernelService kernelService;

    public LcmApprovalService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Set the kernel service (called during initialization to break circular dependency).
     */
    public void setKernelService(LcmKernelService kernelService) {
        this.kernelService = kernelService;
        log.info("✅ Approval service initialized with kernel service");
    }

    /**
     * Create a new commit approval request.
     * 
     * <p>This creates a new APPROVAL_REQUEST entity in PENDING status.
     * The actual commit will only happen when the request is approved.
     *
     * @param targetUri   the UBOS URI of the resource to modify (e.g., "ubos://logic/tax-calc?branch=master")
     * @param jsonContent the raw JSON content to commit
     * @param author      the user requesting the commit
     * @param message     the commit message to use when approved
     * @return the generated requestId
     */
    public Mono<String> requestCommit(String targetUri, String jsonContent, String author, String message) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        // Validate the target URI is parseable
        try {
            UbosUriUtil.parse(targetUri);
        } catch (UbosUriUtil.UbosUriParseException e) {
            return Mono.error(new IllegalArgumentException("Invalid target URI: " + e.getMessage()));
        }

        // Generate a unique request ID
        String requestId = "REQ-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        
        log.info("📋 Creating approval request: {} for target: {}", requestId, targetUri);

        // Create the pending payload
        ApprovalRequestPayload payload = ApprovalRequestPayload.createPending(
            requestId,
            targetUri,
            jsonContent,
            author,
            message
        );

        // Serialize and commit to the Version Chain
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            
            return kernelService.commit(
                    ApprovalRequestPayload.ENTITY_TYPE,
                    requestId,
                    ApprovalRequestPayload.DEFAULT_BRANCH,
                    payloadJson,
                    author,
                    "Approval request created: " + requestId
                )
                .doOnSuccess(commitId -> 
                    log.info("✅ Approval request {} created (commitId: {})", requestId, commitId))
                .thenReturn(requestId);
                
        } catch (JsonProcessingException e) {
            return Mono.error(new RuntimeException("Failed to serialize approval request", e));
        }
    }

    /**
     * Approve a pending request and execute the actual commit.
     * 
     * <p>Steps:
     * <ol>
     *   <li>Fetch the latest APPROVAL_REQUEST entity</li>
     *   <li>Verify it's still PENDING</li>
     *   <li>Parse the targetUri and execute the actual commit</li>
     *   <li>Update the approval request status to APPROVED</li>
     * </ol>
     *
     * @param requestId the approval request ID
     * @param approver  the user approving the request
     * @return the commit ID of the actual change
     */
    public Mono<Long> approveRequest(String requestId, String approver) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        log.info("🔍 Processing approval for request: {} by {}", requestId, approver);

        // Step 1: Fetch the current approval request
        return kernelService.getResourceSnapshot(
                ApprovalRequestPayload.ENTITY_TYPE, 
                requestId, 
                ApprovalRequestPayload.DEFAULT_BRANCH
            )
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                "Approval request not found: " + requestId)))
            .flatMap(json -> {
                try {
                    ApprovalRequestPayload payload = objectMapper.readValue(json, ApprovalRequestPayload.class);
                    
                    // Step 2: Verify status is PENDING
                    if (!payload.isPending()) {
                        return Mono.error(new IllegalStateException(
                            String.format("Request %s is not pending (current status: %s)", 
                                requestId, payload.status())));
                    }
                    
                    // Step 3: Parse target URI and execute the actual commit
                    UbosUriUtil.UbosUriDetails targetUri = UbosUriUtil.parse(payload.targetUri());
                    
                    log.info("📝 Executing approved commit to: {}", payload.targetUri());
                    
                    return kernelService.commit(
                            targetUri.type().toUpperCase(),
                            targetUri.slug(),
                            targetUri.branch(),
                            payload.originalPayload(),
                            approver,
                            payload.commitMessage() + " (Approved by " + approver + ")"
                        )
                        .flatMap(targetCommitId -> {
                            // Step 4: Update approval request status to APPROVED
                            ApprovalRequestPayload approved = payload.approve(approver, targetCommitId);
                            
                            try {
                                String approvedJson = objectMapper.writeValueAsString(approved);
                                
                                return kernelService.commit(
                                        ApprovalRequestPayload.ENTITY_TYPE,
                                        requestId,
                                        ApprovalRequestPayload.DEFAULT_BRANCH,
                                        approvedJson,
                                        approver,
                                        "Approved request: " + requestId
                                    )
                                    .doOnSuccess(commitId -> 
                                        log.info("✅ Request {} approved, target commit: {}", 
                                            requestId, targetCommitId))
                                    .thenReturn(targetCommitId);
                                    
                            } catch (JsonProcessingException e) {
                                return Mono.error(new RuntimeException(
                                    "Failed to serialize approved request", e));
                            }
                        });
                        
                } catch (JsonProcessingException e) {
                    return Mono.error(new RuntimeException("Failed to parse approval request", e));
                }
            });
    }

    /**
     * Reject a pending approval request.
     *
     * @param requestId the approval request ID
     * @param approver  the user rejecting the request
     * @param reason    the rejection reason
     * @return the requestId
     */
    public Mono<String> rejectRequest(String requestId, String approver, String reason) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        log.info("❌ Rejecting request: {} by {} - reason: {}", requestId, approver, reason);

        return kernelService.getResourceSnapshot(
                ApprovalRequestPayload.ENTITY_TYPE,
                requestId,
                ApprovalRequestPayload.DEFAULT_BRANCH
            )
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                "Approval request not found: " + requestId)))
            .flatMap(json -> {
                try {
                    ApprovalRequestPayload payload = objectMapper.readValue(json, ApprovalRequestPayload.class);
                    
                    if (!payload.isPending()) {
                        return Mono.error(new IllegalStateException(
                            String.format("Request %s is not pending (current status: %s)",
                                requestId, payload.status())));
                    }
                    
                    ApprovalRequestPayload rejected = payload.reject(approver, reason);
                    String rejectedJson = objectMapper.writeValueAsString(rejected);
                    
                    return kernelService.commit(
                            ApprovalRequestPayload.ENTITY_TYPE,
                            requestId,
                            ApprovalRequestPayload.DEFAULT_BRANCH,
                            rejectedJson,
                            approver,
                            "Rejected request: " + requestId + " - " + reason
                        )
                        .doOnSuccess(commitId ->
                            log.info("❌ Request {} rejected", requestId))
                        .thenReturn(requestId);
                        
                } catch (JsonProcessingException e) {
                    return Mono.error(new RuntimeException("Failed to process rejection", e));
                }
            });
    }

    /**
     * Get a specific approval request by ID.
     *
     * @param requestId the approval request ID
     * @return the approval request payload
     */
    public Mono<ApprovalRequestPayload> getRequest(String requestId) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        return kernelService.getResourceSnapshot(
                ApprovalRequestPayload.ENTITY_TYPE,
                requestId,
                ApprovalRequestPayload.DEFAULT_BRANCH
            )
            .flatMap(json -> {
                try {
                    return Mono.just(objectMapper.readValue(json, ApprovalRequestPayload.class));
                } catch (JsonProcessingException e) {
                    log.error("Failed to parse approval request: {}", requestId, e);
                    return Mono.empty();
                }
            });
    }

    /**
     * Get all approval requests, optionally filtered by status.
     *
     * @param status optional status filter (PENDING, APPROVED, REJECTED, CANCELLED)
     * @return stream of approval request payloads
     */
    public Flux<ApprovalRequestPayload> findAll(String status) {
        if (kernelService == null) {
            return Flux.error(new IllegalStateException("Kernel service not initialized"));
        }

        return kernelService.search(
                ApprovalRequestPayload.ENTITY_TYPE,
                ApprovalRequestPayload.DEFAULT_BRANCH,
                Map.of()
            )
            .flatMap(map -> {
                Object snapshotData = map.get("snapshotData");
                if (snapshotData == null) {
                    snapshotData = map.get("snapshot_data_safe");
                }
                if (snapshotData == null) {
                    // If search returns map without snapshotData, try direct conversion
                    try {
                        return Mono.just(objectMapper.convertValue(map, ApprovalRequestPayload.class));
                    } catch (Exception e) {
                        return Mono.empty();
                    }
                }
                try {
                    return Mono.just(objectMapper.readValue(snapshotData.toString(), ApprovalRequestPayload.class));
                } catch (JsonProcessingException e) {
                    log.warn("Failed to parse approval request from search result", e);
                    return Mono.empty();
                }
            })
            .filter(payload -> status == null || status.isBlank() || status.equalsIgnoreCase(payload.status()));
    }

    /**
     * Get all pending approval requests.
     *
     * @return stream of pending approval request payloads
     */
    public Flux<ApprovalRequestPayload> findPending() {
        return findAll(ApprovalRequestPayload.STATUS_PENDING);
    }

    /**
     * Cancel a pending request (by the original requester).
     *
     * @param requestId   the approval request ID
     * @param requestedBy the original requester (for verification)
     * @return the requestId
     */
    public Mono<String> cancelRequest(String requestId, String requestedBy) {
        if (kernelService == null) {
            return Mono.error(new IllegalStateException("Kernel service not initialized"));
        }

        log.info("🚫 Cancelling request: {} by {}", requestId, requestedBy);

        return kernelService.getResourceSnapshot(
                ApprovalRequestPayload.ENTITY_TYPE,
                requestId,
                ApprovalRequestPayload.DEFAULT_BRANCH
            )
            .switchIfEmpty(Mono.error(new IllegalArgumentException(
                "Approval request not found: " + requestId)))
            .flatMap(json -> {
                try {
                    ApprovalRequestPayload payload = objectMapper.readValue(json, ApprovalRequestPayload.class);
                    
                    if (!payload.isPending()) {
                        return Mono.error(new IllegalStateException(
                            String.format("Request %s is not pending (current status: %s)",
                                requestId, payload.status())));
                    }
                    
                    // Verify requester matches
                    if (!payload.requestedBy().equals(requestedBy)) {
                        return Mono.error(new IllegalArgumentException(
                            "Only the original requester can cancel this request"));
                    }
                    
                    ApprovalRequestPayload cancelled = payload.cancel();
                    String cancelledJson = objectMapper.writeValueAsString(cancelled);
                    
                    return kernelService.commit(
                            ApprovalRequestPayload.ENTITY_TYPE,
                            requestId,
                            ApprovalRequestPayload.DEFAULT_BRANCH,
                            cancelledJson,
                            requestedBy,
                            "Cancelled request: " + requestId
                        )
                        .doOnSuccess(commitId ->
                            log.info("🚫 Request {} cancelled", requestId))
                        .thenReturn(requestId);
                        
                } catch (JsonProcessingException e) {
                    return Mono.error(new RuntimeException("Failed to process cancellation", e));
                }
            });
    }
}
