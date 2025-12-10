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
export interface EntitySnapshot {
  commitId: number;
  entityId: string;
  branchName: string;
  snapshotData: string; // RAW JSON String - do not parse
  authorId: string;
  message: string;
  createdAt?: string; // ISO String, optional
}

// API Request/Response types
export interface GetEntitiesParams {
  branch: string;
  type?: string;
  search?: string;
}

export interface GetSnapshotParams {
  slug: string;
  entityType: string;
}

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
