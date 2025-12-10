/**
 * TypeScript interfaces matching Java backend models (org.logrum.ubos)
 */

// Corresponds to org.logrum.ubos.core.model.EntityInstance
export interface EntityInstance {
  id: string;
  entityType: string;
  slug: string;
  createdAt: string; // ISO String
  branch?: string; // Optional, may be added for UI convenience
}

// Corresponds to org.logrum.ubos.core.model.EntityVersionChain
// All fields must use Camel Case to match backend JSON output
export interface EntitySnapshot {
  commitId: number; // ✅ Camel Case: commitId (NOT commit_id)
  entityId: string; // ✅ Camel Case: entityId (NOT entity_id)
  branchName: string; // ✅ Camel Case: branchName (NOT branch_name)
  parentCommitId: number | null; // ✅ Camel Case: parentCommitId (NOT parent_commit_id)
  snapshotData: string; // ✅ Camel Case: snapshotData (NOT snapshot_data) - RAW JSON String - do not parse
  authorId: string; // ✅ Camel Case: authorId (NOT author_id)
  message: string; // ✅ Camel Case: message
  createdAt?: string; // ✅ Camel Case: createdAt (NOT created_at) - ISO String, optional
}

// API Request/Response types
export interface GetEntitiesParams {
  branch: string;
  type?: string;
  search?: string;
}

// Resource Context Request DTO - matches Java ResourceContextRequest
// Used for operations that require slug, type, and branch context
export interface ResourceContextRequest {
  slug: string; // Required: the entity slug identifier
  type: string; // Required: the entity type (e.g., "LOGIC", "TYPE")
  branch: string; // Required: the branch name (e.g., "master")
}

// Legacy aliases for backward compatibility (deprecated, use ResourceContextRequest)
export interface GetSnapshotParams extends ResourceContextRequest {}
export interface GetHistoryParams extends ResourceContextRequest {}

export interface BatchCommitRequest {
  slugs: string[];
  branch: string;
  jsonPatch: string;
  message: string;
}

export interface BatchCommitResponse {
  success: boolean;
  commitIds: number[];
  message?: string;
}

// History and Diff types
// All fields must use Camel Case to match backend JSON output
export interface HistoryRecord {
  commitId: number; // ✅ Camel Case: commitId (NOT commit_id)
  branchName: string; // ✅ Camel Case: branchName (NOT branch_name)
  authorId: string; // ✅ Camel Case: authorId (NOT author_id)
  message: string; // ✅ Camel Case: message
  createdAt: string; // ✅ Camel Case: createdAt (NOT created_at) - ISO String
  entityId?: string; // ✅ Camel Case: entityId (NOT entity_id) - Optional
  parentCommitId?: number | null; // ✅ Camel Case: parentCommitId (NOT parent_commit_id) - Optional
}

// GetHistoryParams is now ResourceContextRequest (see above)

// Snapshot by Commit Request - extends ResourceContextRequest with commitId
export interface GetSnapshotByCommitParams extends ResourceContextRequest {
  commitId: number; // Required: the commit ID to fetch
}

// Branch management types
export interface Branch {
  branchName: string; // ✅ Camel Case: branchName (NOT name)
  createdAt?: string; // ISO String, optional
}

export interface CreateBranchRequest {
  newBranchName: string;
  baseCommitId: number; // Required: the commit ID that the new branch HEAD should point to
  parentBranchName?: string; // Optional: parent branch name for inheritance (defaults to "master")
  description?: string; // Optional: description for the new branch
}

export interface CreateBranchResponse {
  success: boolean;
  branchName: string;
  message?: string;
}

// Revert types
export interface RevertRequest {
  slug: string; // Required: the entity slug identifier
  type: string; // Required: the entity type (e.g., "LOGIC", "TYPE"), defaults to "LOGIC" if null
  branch: string; // Required: the branch name (e.g., "master")
  commitId: number; // Required: the target commit ID to revert to
  author?: string; // Optional: author of the revert operation
  message?: string; // Optional: message describing the revert
}

export interface RevertResponse {
  success: boolean;
  commitId: number;
  message?: string;
}

// Merge types
export interface MergeRequest {
  sourceBranch: string; // Required: the branch to merge FROM (e.g., "dev")
  targetBranch: string; // Required: the branch to merge TO (e.g., "master")
  slugs: string[]; // Required: array of entity slugs to merge
  message: string; // Required: commit message for the merge
  author?: string; // Optional: author of the merge operation
}

export interface MergeResponse {
  success: boolean;
  commitId: number; // The commit ID of the merge commit
  mergedSlugs: string[]; // List of successfully merged entity slugs
  message?: string;
}

// Search types
export interface SearchRequest {
  query: string; // Required: search query string
  branch?: string; // Optional: filter by branch
  type?: string; // Optional: filter by entity type
}

export interface SearchResult {
  slug: string;
  entityType: string;
  branchName: string;
  commitId?: number;
  snippet?: string; // Optional: search result snippet
}

// Process Log types
export interface ProcessRecord {
  processId: string; // Required: unique process identifier
  processName: string; // Required: name of the process
  operator: string; // Required: operator/user who initiated the process
  startTime: string; // Required: ISO String - process start time
  endTime?: string; // Optional: ISO String - process end time
  status?: string; // Optional: process status (e.g., "completed", "failed")
  commitCount?: number; // Optional: number of commits in this process
}

export interface ProcessDetail {
  processId: string;
  processName: string;
  operator: string;
  startTime: string;
  endTime?: string;
  status?: string;
  commits: ProcessCommit[]; // List of commits associated with this process
}

export interface ProcessCommit {
  commitId: number;
  slug: string;
  entityType: string;
  branchName: string;
  message: string;
  authorId: string;
  createdAt: string; // ISO String
}
