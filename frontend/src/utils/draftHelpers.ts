/**
 * Draft management utilities
 * Handles draft branch naming and detection
 */

/**
 * Get current user ID from localStorage or default to 'system'
 * In a real app, this would come from authentication context
 */
export function getCurrentUserId(): string {
  // Try to get from localStorage
  const stored = localStorage.getItem('ubos-current-user-id')
  if (stored) {
    return stored
  }
  
  // Default to 'system' if not set
  // In production, this should come from auth context
  return 'system'
}

/**
 * Set current user ID
 */
export function setCurrentUserId(userId: string): void {
  localStorage.setItem('ubos-current-user-id', userId)
}

/**
 * Generate draft branch name
 * Pattern: stash/{userId}/{entityId}
 */
export function getDraftBranchName(entityId: string, userId?: string): string {
  const currentUserId = userId || getCurrentUserId()
  return `stash/${currentUserId}/${entityId}`
}

/**
 * Parse draft branch name to extract userId and entityId
 */
export function parseDraftBranchName(branchName: string): { userId: string; entityId: string } | null {
  const match = branchName.match(/^stash\/([^/]+)\/(.+)$/)
  if (!match) return null
  
  return {
    userId: match[1],
    entityId: match[2],
  }
}

/**
 * Check if a branch name is a draft branch
 */
export function isDraftBranch(branchName: string): boolean {
  return branchName.startsWith('stash/')
}

/**
 * Check if a draft branch belongs to current user
 */
export function isMyDraftBranch(branchName: string, userId?: string): boolean {
  if (!isDraftBranch(branchName)) return false
  
  const parsed = parseDraftBranchName(branchName)
  if (!parsed) return false
  
  const currentUserId = userId || getCurrentUserId()
  return parsed.userId === currentUserId
}

