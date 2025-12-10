import type { EntityInstance } from '../types/ubos'
import { buildUbosUri as buildUbosUriCore } from './useUbosUri'

/**
 * Builds a UBOS URI for an entity instance
 * Format: ubos://type/slug?branch=name
 * 
 * @param instance - The entity instance
 * @param branch - The current branch name
 * @param commitId - Optional commit ID
 * @returns The full UBOS URI string
 */
export function buildUbosUri(
  instance: EntityInstance,
  branch: string,
  commitId?: number
): string {
  const { entityType, slug } = instance
  return buildUbosUriCore(entityType, slug, branch, commitId)
}

// Re-export types and functions from useUbosUri for convenience
export type { UbosUriDetails } from './useUbosUri'
export { parseUbosUri, isValidUbosUri } from './useUbosUri'

