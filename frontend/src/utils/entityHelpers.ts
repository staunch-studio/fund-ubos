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

