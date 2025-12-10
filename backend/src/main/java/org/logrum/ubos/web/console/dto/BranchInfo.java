package org.logrum.ubos.web.console.dto;

/**
 * DTO representing branch information from sys_branch_config.
 *
 * @param branchName   the branch name
 * @param parentBranch the parent branch name (null for root branches)
 * @param description  the branch description
 */
public record BranchInfo(
    String branchName,
    String parentBranch,
    String description
) {}
