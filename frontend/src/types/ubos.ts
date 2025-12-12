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

// Navigation API types
export interface NavigateEntitiesParams {
  branch: string;
  type?: string;
  namespace?: string; // Optional namespace path (e.g., "finance.taxes")
}

// Entity rename/copy types
export interface RenameEntityRequest {
  slug: string; // Current slug
  newSlug: string; // New slug
  branch: string; // Branch name
  type?: string; // Entity type (optional)
}

export interface RenameEntityResponse {
  success: boolean;
  message?: string;
  newSlug?: string;
}

export interface CopyEntityRequest {
  slug: string; // Source slug
  targetSlug: string; // Target slug
  sourceBranch: string; // Source branch
  targetBranch: string; // Target branch
  type?: string; // Entity type (optional)
}

export interface CopyEntityResponse {
  success: boolean;
  message?: string;
  targetSlug?: string;
}

// Branch status/diff types
export interface BranchStatusParams {
  baseBranch: string; // Base branch (e.g., "master")
  currentBranch: string; // Current branch to compare
  type?: string; // Optional: filter by entity type
}

export interface EntityStatus {
  slug: string;
  entityType: string;
  status: 'NEW' | 'MODIFIED' | 'DELETED';
  baseCommitId?: number; // Commit ID in base branch
  currentCommitId?: number; // Commit ID in current branch
}

export interface BranchStatusResponse {
  baseBranch: string;
  currentBranch: string;
  entities: EntityStatus[];
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
  branch?: string; // Optional, defaults to "master"
  entityType?: string; // Optional, defaults to "LOGIC"
  jsonPatch: string;
  message?: string; // Optional commit message
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
  type?: string; // Optional, defaults to "LOGIC"
  branch?: string; // Optional, defaults to "master"
  targetCommitId: number; // Required: the target commit ID to revert to
  author?: string; // Optional
  message?: string; // Optional
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

export interface MergeFailure {
  slug: string; // The slug of the entity that failed to merge
  error: string; // The error message for this failure
}

export interface MergeResponse {
  success: boolean; // Whether the merge operation was successful
  message?: string; // Overall message about the merge operation
  sourceBranch?: string; // The source branch that was merged from
  targetBranch?: string; // The target branch that was merged into
  mergedCount?: number; // Number of entities successfully merged
  skippedCount?: number; // Number of entities skipped
  failedCount?: number; // Number of entities that failed to merge
  commitId?: number; // The commit ID of the merge commit (if any)
  mergedSlugs?: string[]; // List of successfully merged entity slugs
  skippedSlugs?: string[]; // List of skipped entity slugs
  failures?: MergeFailure[]; // List of failures with error details
}

// Search types
export interface SearchRequest {
  query: string; // Required: search query string
  branch?: string; // Optional: filter by branch
  type?: string; // Optional: filter by entity type
  mode?: string; // Optional: search mode
  limit?: number; // Optional: limit number of results
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

// Environment types - matches Java EnvironmentConfigDto
export interface Environment {
  envName: string; // Required: the environment name (e.g., "UAT", "PROD")
  mappedBranch: string; // Required: the default branch for this environment (defaults to "master")
  mappedCommitId?: number | null; // Optional: pin to a specific commit for stable testing
  description?: string; // Optional: description of the environment
  updatedAt?: string; // Optional: ISO String - timestamp of the last update (read-only, set by server)
}

export interface SaveEnvironmentRequest {
  envName: string; // Required: the environment name (e.g., "UAT", "PROD")
  mappedBranch?: string; // Optional: the default branch (defaults to "master" if not provided)
  mappedCommitId?: number | null; // Optional: pin to a specific commit for stable testing
  description?: string; // Optional: description of the environment
}

export interface SaveEnvironmentResponse {
  success: boolean;
  envName: string;
  message?: string;
}

// Schema types - Schema definitions are commit-able entities
export interface SchemaCommitRequest {
  targetType: string; // Required: the target entity type (e.g., "LOGIC", "VIEW")
  jsonSchemaContent: string; // Required: JSON Schema content as string
  branch?: string; // Optional, defaults to "master"
  message?: string; // Optional commit message
  author?: string; // Optional, defaults to "system"
}

export interface SchemaCommitResponse {
  success: boolean;
  commitId: number; // The commit ID of the schema commit
  message?: string;
}

// Approval Request types - Approval requests are version-chained entities (entityType='APPROVAL_REQUEST')
export interface ApprovalRequestData {
  requestId: string; // The slug of the APPROVAL_REQUEST entity
  targetUri: string; // The UBOS URI of the entity being requested for approval
  requestedBy: string; // User identifier who requested the approval
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedAt: string; // ISO timestamp
  approvedBy?: string; // User identifier who approved (if approved)
  approvedAt?: string; // ISO timestamp (if approved)
  message?: string; // Optional message/description
  branch: string; // The branch name where the change is requested
}

export interface CreateApprovalRequest {
  targetUri: string; // The UBOS URI of the entity being requested for approval
  content: Record<string, any>; // Map<String, Object> - The content/changes to be approved (e.g., { snapshotData: "..." })
  author?: string; // Optional author identifier (defaults to "system" if not provided)
  message?: string; // Optional message/description (defaults to "Pending approval" if not provided)
}

export interface CreateApprovalRequestResponse {
  success: boolean;
  requestId: string; // The slug of the created APPROVAL_REQUEST entity
  message?: string;
}

export interface ApprovalActionRequest {
  requestId: string; // The slug of the APPROVAL_REQUEST entity
  approver: string; // The user identifier who is approving/rejecting
  action: 'approve' | 'reject'; // The action to take
  reason?: string; // Optional reason (required for reject, optional for approve)
}

export interface ApprovalActionResponse {
  success: boolean;
  requestId: string;
  status?: 'APPROVED' | 'REJECTED';
  message?: string;
  targetCommitId?: number; // Present when approved
  approver?: string;
  reason?: string; // Present when rejected
}

// Approval request detail (from GET /approval/{requestId} or GET /approval/pending)
export interface ApprovalRequestDetail {
  requestId: string;
  targetUri: string;
  originalPayload: string; // JSON string of the original content
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedBy: string;
  approver?: string | null;
  commitMessage?: string;
  targetCommitId?: number | null;
  requestedAt: string; // ISO timestamp
  resolvedAt?: string | null; // ISO timestamp
  rejectionReason?: string | null;
}

// Legacy alias for backward compatibility
export interface ApproveRequest extends ApprovalActionRequest {}
export interface ApproveRequestResponse extends ApprovalActionResponse {}

// Cache Management types
export interface CacheStatsResponse {
  snapshotCacheSize: number; // Number of cached snapshot items
  totalCacheSize?: number; // Total cache size (if available)
}

export interface EvictCacheResponse {
  success: boolean;
  message: string;
  evictedCount?: number; // Number of items evicted (if available)
}

// Metrics types for Operational Dashboard
export interface HealthMetricsResponse {
  status: 'GREEN' | 'YELLOW' | 'RED'; // System health status
  totalEntities?: number; // Total number of entities
  lastSuccessfulCommitTime?: string; // ISO timestamp of last successful commit
  databaseStatus?: 'UP' | 'DOWN'; // Database connection status
  message?: string; // Optional status message
}

export interface WorkflowMetricsResponse {
  pendingApprovals: number; // Critical: Number of pending approval requests
  pendingWebhooks: number; // Number of pending webhook deliveries
  activeWorkflows?: number; // Number of currently active workflows
  failedWorkflows?: number; // Number of failed workflows (last 24h)
}

export interface CommitsMetricsResponse {
  totalCommits?: number; // Total commits (last 24h)
  commitsByEntityType?: Record<string, number>; // Commits grouped by entity type
  commitsOverTime?: Array<{
    time: string; // ISO timestamp or hour label
    count: number; // Number of commits in this time period
  }>; // Commits over time (last 24h, hourly buckets)
  averageCommitTime?: number; // Average commit processing time in ms
}

export interface CacheMetricsResponse {
  hitRatio: number; // Cache hit ratio as a percentage (0-100)
  totalCachedItems: number; // Total number of cached items
  cacheSize?: number; // Total cache size in bytes (if available)
  evictionCount?: number; // Number of cache evictions (last 24h)
}

// Merge Conflict Resolution types
export interface ConflictField {
  path: string; // JSON path to the conflicting field (e.g., "/snapshotData/content")
  base: any; // Base value (common ancestor)
  ours: any; // Current branch value
  theirs: any; // Incoming branch value
}

export interface MergeConflictObject {
  slug: string; // Entity slug
  type: string; // Entity type
  branch: string; // Target branch
  conflicts: ConflictField[]; // Array of conflicting fields
  baseSnapshot?: string; // Base snapshot data (JSON string)
  oursSnapshot?: string; // Our snapshot data (JSON string)
  theirsSnapshot?: string; // Theirs snapshot data (JSON string)
}

export interface ResolveConflictRequest {
  slug: string;
  type: string;
  branch: string;
  resolvedData: Record<string, any>; // Final resolved JSON object
  message?: string; // Optional commit message
  author?: string; // Optional author
}

export interface ResolveConflictResponse {
  success: boolean;
  commitId?: number;
  message?: string;
}
