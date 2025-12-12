/**
 * Helper functions for parsing and formatting version-chained entities
 */

import type { EntityInstance, EntitySnapshot } from '../types/ubos'

// API Key entity structure (entityType='SECURITY_KEY')
export interface SecurityKeyData {
  keyId: string
  description?: string
  scope: string
  isActive: boolean
  createdAt: string
  lastUsedAt?: string
  // Note: The actual API key token is NOT stored in the entity
  // It's only shown once during generation
}

// Webhook entity structure (entityType='WEBHOOK')
export interface WebhookData {
  hookId: string
  hookName: string
  entityType: string
  triggerEvent: 'DEPLOY' | 'MERGE' | 'COMMIT'
  targetUrl: string
  isActive: boolean
  createdAt?: string
  lastTriggered?: string
}

/**
 * Parse SecurityKeyData from EntitySnapshot
 */
export function parseSecurityKeyFromSnapshot(snapshot: EntitySnapshot): SecurityKeyData | null {
  try {
    const data = JSON.parse(snapshot.snapshotData)
    return {
      keyId: data.keyId || snapshot.entityId,
      description: data.description,
      scope: data.scope || 'read',
      isActive: data.isActive !== false, // Default to true
      createdAt: data.createdAt || snapshot.createdAt || new Date().toISOString(),
      lastUsedAt: data.lastUsedAt,
    }
  } catch {
    return null
  }
}

/**
 * Format SecurityKeyData to JSON string for snapshotData
 */
export function formatSecurityKeyToSnapshotData(keyData: SecurityKeyData): string {
  return JSON.stringify({
    keyId: keyData.keyId,
    description: keyData.description,
    scope: keyData.scope,
    isActive: keyData.isActive,
    createdAt: keyData.createdAt,
    lastUsedAt: keyData.lastUsedAt,
  })
}

/**
 * Parse WebhookData from EntitySnapshot
 */
export function parseWebhookFromSnapshot(snapshot: EntitySnapshot): WebhookData | null {
  try {
    const data = JSON.parse(snapshot.snapshotData)
    return {
      hookId: data.hookId || snapshot.entityId,
      hookName: data.hookName,
      entityType: data.entityType,
      triggerEvent: data.triggerEvent,
      targetUrl: data.targetUrl,
      isActive: data.isActive !== false, // Default to true
      createdAt: data.createdAt || snapshot.createdAt,
      lastTriggered: data.lastTriggered,
    }
  } catch {
    return null
  }
}

/**
 * Format WebhookData to JSON string for snapshotData
 */
export function formatWebhookToSnapshotData(webhookData: WebhookData): string {
  return JSON.stringify({
    hookId: webhookData.hookId,
    hookName: webhookData.hookName,
    entityType: webhookData.entityType,
    triggerEvent: webhookData.triggerEvent,
    targetUrl: webhookData.targetUrl,
    isActive: webhookData.isActive,
    createdAt: webhookData.createdAt,
    lastTriggered: webhookData.lastTriggered,
  })
}

/**
 * Convert EntityInstance to SecurityKeyData (for table display)
 * Note: This only uses metadata, full data requires fetching snapshot
 */
export function entityToSecurityKey(entity: EntityInstance): Partial<SecurityKeyData> {
  return {
    keyId: entity.slug, // slug is the keyId
    createdAt: entity.createdAt,
  }
}

/**
 * Convert EntityInstance to WebhookData (for table display)
 * Note: This only uses metadata, full data requires fetching snapshot
 */
export function entityToWebhook(entity: EntityInstance): Partial<WebhookData> {
  return {
    hookId: entity.slug, // slug is the hookId
    createdAt: entity.createdAt,
  }
}

// Environment entity structure (entityType='ENVIRONMENT')
export interface EnvironmentData {
  envName: string // Required: the environment name (e.g., "UAT", "PROD")
  mappedBranch: string // Required: the default branch (defaults to "master")
  mappedCommitId?: number | null // Optional: pin to a specific commit for stable testing
  description?: string // Optional: description of the environment
  updatedAt?: string // Optional: ISO String - timestamp of the last update (read-only, set by server)
}

/**
 * Parse EnvironmentData from EntitySnapshot
 */
export function parseEnvironmentFromSnapshot(snapshot: EntitySnapshot): EnvironmentData | null {
  try {
    const data = JSON.parse(snapshot.snapshotData)
    return {
      envName: data.envName || snapshot.entityId,
      mappedBranch: data.mappedBranch || 'master',
      mappedCommitId: data.mappedCommitId || null,
      description: data.description,
      updatedAt: data.updatedAt || snapshot.createdAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Format EnvironmentData to JSON string for snapshotData
 */
export function formatEnvironmentToSnapshotData(envData: EnvironmentData): string {
  return JSON.stringify({
    envName: envData.envName,
    mappedBranch: envData.mappedBranch,
    mappedCommitId: envData.mappedCommitId || null,
    description: envData.description,
    updatedAt: envData.updatedAt || new Date().toISOString(),
  })
}

/**
 * Convert EntityInstance to EnvironmentData (for table display)
 * Note: This only uses metadata, full data requires fetching snapshot
 */
export function entityToEnvironment(entity: EntityInstance): Partial<EnvironmentData> {
  return {
    envName: entity.slug, // slug is the envName
    createdAt: entity.createdAt,
  }
}

// Approval Request entity structure (entityType='APPROVAL_REQUEST')
export interface ApprovalRequestData {
  requestId: string // The slug of the APPROVAL_REQUEST entity
  targetUri: string // The UBOS URI of the entity being requested for approval
  requestedBy: string // User identifier who requested the approval
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  requestedAt: string // ISO timestamp
  approvedBy?: string // User identifier who approved (if approved)
  approvedAt?: string // ISO timestamp (if approved)
  message?: string // Optional message/description
  branch: string // The branch name where the change is requested
}

/**
 * Parse ApprovalRequestData from EntitySnapshot
 */
export function parseApprovalRequestFromSnapshot(snapshot: EntitySnapshot): ApprovalRequestData | null {
  try {
    const data = JSON.parse(snapshot.snapshotData)
    return {
      requestId: data.requestId || snapshot.entityId,
      targetUri: data.targetUri || '',
      requestedBy: data.requestedBy || '',
      status: (data.status || 'PENDING') as ApprovalRequestData['status'],
      requestedAt: data.requestedAt || snapshot.createdAt || new Date().toISOString(),
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt,
      message: data.message,
      branch: data.branch || '',
    }
  } catch {
    return null
  }
}

/**
 * Format ApprovalRequestData to JSON string for snapshotData
 */
export function formatApprovalRequestToSnapshotData(requestData: ApprovalRequestData): string {
  return JSON.stringify({
    requestId: requestData.requestId,
    targetUri: requestData.targetUri,
    requestedBy: requestData.requestedBy,
    status: requestData.status,
    requestedAt: requestData.requestedAt,
    approvedBy: requestData.approvedBy,
    approvedAt: requestData.approvedAt,
    message: requestData.message,
    branch: requestData.branch,
  })
}

/**
 * Convert EntityInstance to ApprovalRequestData (for table display)
 * Note: This only uses metadata, full data requires fetching snapshot
 */
export function entityToApprovalRequest(entity: EntityInstance): Partial<ApprovalRequestData> {
  return {
    requestId: entity.slug, // slug is the requestId
    requestedAt: entity.createdAt,
  }
}

// User entity structure (entityType='USER')
export interface UserData {
  userId: string // The slug of the USER entity
  username: string // User's login name
  email?: string // User's email address
  displayName?: string // User's display name
  groups?: string[] // Array of group slugs the user belongs to
  isActive: boolean // Whether the user account is active
  createdAt?: string // ISO timestamp
  lastLoginAt?: string // ISO timestamp
}

// Group entity structure (entityType='GROUP')
export interface GroupData {
  groupId: string // The slug of the GROUP entity
  groupName: string // Group's display name
  description?: string // Group description
  roles?: string[] // Array of role/policy slugs assigned to this group
  isActive: boolean // Whether the group is active
  createdAt?: string // ISO timestamp
}

// Policy entity structure (entityType='POLICY')
export interface PolicyData {
  policyId: string // The slug of the POLICY entity
  policyName: string // Policy's display name
  description?: string // Policy description
  rules: Record<string, any> // JSON object containing policy rules
  isActive: boolean // Whether the policy is active
  createdAt?: string // ISO timestamp
}

/**
 * Parse UserData from EntitySnapshot
 */
export function parseUserFromSnapshot(snapshot: EntitySnapshot): UserData | null {
  try {
    const data = JSON.parse(snapshot.snapshotData)
    return {
      userId: data.userId || snapshot.entityId,
      username: data.username || data.userId || snapshot.entityId,
      email: data.email,
      displayName: data.displayName,
      groups: data.groups || [],
      isActive: data.isActive !== false, // Default to true
      createdAt: data.createdAt || snapshot.createdAt,
      lastLoginAt: data.lastLoginAt,
    }
  } catch {
    return null
  }
}

/**
 * Format UserData to JSON string for snapshotData
 */
export function formatUserToSnapshotData(userData: UserData): string {
  return JSON.stringify({
    userId: userData.userId,
    username: userData.username,
    email: userData.email,
    displayName: userData.displayName,
    groups: userData.groups || [],
    isActive: userData.isActive,
    createdAt: userData.createdAt,
    lastLoginAt: userData.lastLoginAt,
  })
}

/**
 * Parse GroupData from EntitySnapshot
 */
export function parseGroupFromSnapshot(snapshot: EntitySnapshot): GroupData | null {
  try {
    const data = JSON.parse(snapshot.snapshotData)
    return {
      groupId: data.groupId || snapshot.entityId,
      groupName: data.groupName || data.groupId || snapshot.entityId,
      description: data.description,
      roles: data.roles || [],
      isActive: data.isActive !== false, // Default to true
      createdAt: data.createdAt || snapshot.createdAt,
    }
  } catch {
    return null
  }
}

/**
 * Format GroupData to JSON string for snapshotData
 */
export function formatGroupToSnapshotData(groupData: GroupData): string {
  return JSON.stringify({
    groupId: groupData.groupId,
    groupName: groupData.groupName,
    description: groupData.description,
    roles: groupData.roles || [],
    isActive: groupData.isActive,
    createdAt: groupData.createdAt,
  })
}

/**
 * Parse PolicyData from EntitySnapshot
 */
export function parsePolicyFromSnapshot(snapshot: EntitySnapshot): PolicyData | null {
  try {
    const data = JSON.parse(snapshot.snapshotData)
    return {
      policyId: data.policyId || snapshot.entityId,
      policyName: data.policyName || data.policyId || snapshot.entityId,
      description: data.description,
      rules: data.rules || {},
      isActive: data.isActive !== false, // Default to true
      createdAt: data.createdAt || snapshot.createdAt,
    }
  } catch {
    return null
  }
}

/**
 * Format PolicyData to JSON string for snapshotData
 */
export function formatPolicyToSnapshotData(policyData: PolicyData): string {
  return JSON.stringify({
    policyId: policyData.policyId,
    policyName: policyData.policyName,
    description: policyData.description,
    rules: policyData.rules,
    isActive: policyData.isActive,
    createdAt: policyData.createdAt,
  })
}

/**
 * Convert EntityInstance to UserData (for table display)
 */
export function entityToUser(entity: EntityInstance): Partial<UserData> {
  return {
    userId: entity.slug, // slug is the userId
    createdAt: entity.createdAt,
  }
}

/**
 * Convert EntityInstance to GroupData (for table display)
 */
export function entityToGroup(entity: EntityInstance): Partial<GroupData> {
  return {
    groupId: entity.slug, // slug is the groupId
    createdAt: entity.createdAt,
  }
}

/**
 * Convert EntityInstance to PolicyData (for table display)
 */
export function entityToPolicy(entity: EntityInstance): Partial<PolicyData> {
  return {
    policyId: entity.slug, // slug is the policyId
    createdAt: entity.createdAt,
  }
}

