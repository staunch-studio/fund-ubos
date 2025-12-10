package org.logrum.ubos.web.console.dto;

/**
 * DTO for the branch creation request body.
 *
 * @param newBranchName    the name of the new branch to create
 * @param baseCommitId     the commit ID that the new branch HEAD should point to
 * @param parentBranchName optional parent branch name for inheritance (defaults to "master")
 * @param description      optional description for the new branch
 */
public record BranchCreateRequest(
    String newBranchName,
    Long baseCommitId,
    String parentBranchName,
    String description
) {}
