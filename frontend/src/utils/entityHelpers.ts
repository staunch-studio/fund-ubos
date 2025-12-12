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

