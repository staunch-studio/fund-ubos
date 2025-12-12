package org.logrum.ubos.web.console.dto;

/**
 * Request body for approving or rejecting an approval request.
 *
 * @param requestId the approval request ID (slug of the APPROVAL_REQUEST entity)
 * @param approver  the approver identifier
 * @param action    "approve" or "reject"
 * @param reason    rejection reason (required if action is "reject")
 */
public record ApprovalActionRequest(
    String requestId,
    String approver,
    String action,
    String reason
) {
    public static final String ACTION_APPROVE = "approve";
    public static final String ACTION_REJECT = "reject";

    public String resolvedApprover() {
        return (approver == null || approver.isBlank()) ? "system" : approver;
    }

    public boolean isApprove() {
        return ACTION_APPROVE.equalsIgnoreCase(action);
    }

    public boolean isReject() {
        return ACTION_REJECT.equalsIgnoreCase(action);
    }
}
