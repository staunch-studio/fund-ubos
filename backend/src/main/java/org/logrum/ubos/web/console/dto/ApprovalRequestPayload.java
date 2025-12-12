package org.logrum.ubos.web.console.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDateTime;

/**
 * Payload representing an approval request stored in the Version Chain.
 * 
 * <p>Stored as entity type: 'APPROVAL_REQUEST'
 * <p>Slug format: Generated UUID (requestId)
 * 
 * @param requestId      unique identifier for this approval request
 * @param targetUri      the UBOS URI of the resource to be modified (e.g., "ubos://logic/tax-calc?branch=master")
 * @param originalPayload the raw JSON content of the proposed change
 * @param status         current status: PENDING, APPROVED, REJECTED, CANCELLED
 * @param requestedBy    the user who initiated the request
 * @param approver       the user who approved/rejected (null while PENDING)
 * @param commitMessage  the commit message to use when approved
 * @param targetCommitId the commit ID created when approved (null while PENDING)
 * @param requestedAt    timestamp when request was created
 * @param resolvedAt     timestamp when request was approved/rejected (null while PENDING)
 * @param rejectionReason reason for rejection (null unless REJECTED)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ApprovalRequestPayload(
    String requestId,
    String targetUri,
    String originalPayload,
    String status,
    String requestedBy,
    String approver,
    String commitMessage,
    Long targetCommitId,
    LocalDateTime requestedAt,
    LocalDateTime resolvedAt,
    String rejectionReason
) {
    /** Entity type for approval requests in the Version Chain */
    public static final String ENTITY_TYPE = "APPROVAL_REQUEST";
    
    /** Default branch for storing approval requests */
    public static final String DEFAULT_BRANCH = "master";
    
    // Status constants
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    /**
     * Creates a new pending approval request.
     */
    public static ApprovalRequestPayload createPending(
            String requestId,
            String targetUri,
            String originalPayload,
            String requestedBy,
            String commitMessage) {
        return new ApprovalRequestPayload(
            requestId,
            targetUri,
            originalPayload,
            STATUS_PENDING,
            requestedBy,
            null,           // approver
            commitMessage,
            null,           // targetCommitId
            LocalDateTime.now(),
            null,           // resolvedAt
            null            // rejectionReason
        );
    }

    /**
     * Creates an approved version of this request.
     */
    public ApprovalRequestPayload approve(String approver, Long targetCommitId) {
        return new ApprovalRequestPayload(
            this.requestId,
            this.targetUri,
            this.originalPayload,
            STATUS_APPROVED,
            this.requestedBy,
            approver,
            this.commitMessage,
            targetCommitId,
            this.requestedAt,
            LocalDateTime.now(),
            null
        );
    }

    /**
     * Creates a rejected version of this request.
     */
    public ApprovalRequestPayload reject(String approver, String reason) {
        return new ApprovalRequestPayload(
            this.requestId,
            this.targetUri,
            this.originalPayload,
            STATUS_REJECTED,
            this.requestedBy,
            approver,
            this.commitMessage,
            null,
            this.requestedAt,
            LocalDateTime.now(),
            reason
        );
    }

    /**
     * Creates a cancelled version of this request.
     */
    public ApprovalRequestPayload cancel() {
        return new ApprovalRequestPayload(
            this.requestId,
            this.targetUri,
            this.originalPayload,
            STATUS_CANCELLED,
            this.requestedBy,
            null,
            this.commitMessage,
            null,
            this.requestedAt,
            LocalDateTime.now(),
            "Cancelled by requester"
        );
    }

    /**
     * Check if this request is still pending.
     */
    public boolean isPending() {
        return STATUS_PENDING.equals(status);
    }

    /**
     * Check if this request has been approved.
     */
    public boolean isApproved() {
        return STATUS_APPROVED.equals(status);
    }
}
