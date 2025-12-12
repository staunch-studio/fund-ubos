/**
 * UBOS URI Utility Functions
 * 
 * Supports multiple UBOS URI modes:
 * 1. Standard: ubos://type/slug?branch=name&cid=commitId
 * 2. Context (Ctx): ubos://ctx/logic_tax_calc
 * 3. Commit: ubos://commit:8f2a.../contract_101
 * 4. Tag: ubos://tag:v1.0/app_quiz
 * 5. Self: ubos://self
 * 6. Alias: ubos://alias:home_banner
 * 7. Remote: ubos://@192.168.1.5/user_101
 */

/**
 * UBOS URI mode types
 */
export type UbosUriMode = 'standard' | 'ctx' | 'commit' | 'tag' | 'self' | 'alias' | 'remote'

/**
 * Interface for UBOS URI details
 */
export interface UbosUriDetails {
  mode: UbosUriMode
  // Standard mode fields
  type?: string
  slug?: string
  branch?: string
  commitId?: number
  // Context mode
  ctxSlug?: string
  // Commit mode
  commitHash?: string
  commitSlug?: string
  // Tag mode
  tagName?: string
  tagSlug?: string
  // Alias mode
  aliasName?: string
  // Remote mode
  remoteHost?: string
  remoteSlug?: string
}

/**
 * Builds a UBOS URI from components (Standard mode)
 * 
 * @param type - The entity type
 * @param slug - The entity slug
 * @param branch - The branch name
 * @param cid - Optional commit ID
 * @returns The full UBOS URI string (e.g., ubos://logic/tax-calc?branch=master&cid=123)
 */
export function buildUbosUri(
  type: string,
  slug: string,
  branch: string,
  cid?: number
): string {
  // Validate inputs
  if (!type || !slug || !branch) {
    throw new Error('Type, slug, and branch are required')
  }

  // Build the URI path
  const path = `${type}/${slug}`
  
  // Build query parameters
  const params = new URLSearchParams()
  params.append('branch', branch)
  
  if (cid !== undefined && cid !== null) {
    params.append('cid', cid.toString())
  }

  // Construct the full URI
  return `ubos://${path}?${params.toString()}`
}

/**
 * Builds a UBOS URI for different modes
 * 
 * @param details - UbosUriDetails object with mode and corresponding fields
 * @returns The full UBOS URI string
 */
export function buildUbosUriFromDetails(details: UbosUriDetails): string {
  switch (details.mode) {
    case 'standard':
      if (!details.type || !details.slug || !details.branch) {
        throw new Error('Standard mode requires type, slug, and branch')
      }
      return buildUbosUri(details.type, details.slug, details.branch, details.commitId)
    
    case 'ctx':
      if (!details.ctxSlug) {
        throw new Error('Ctx mode requires ctxSlug')
      }
      return `ubos://ctx/${details.ctxSlug}`
    
    case 'commit':
      if (!details.commitHash || !details.commitSlug) {
        throw new Error('Commit mode requires commitHash and commitSlug')
      }
      return `ubos://commit:${details.commitHash}/${details.commitSlug}`
    
    case 'tag':
      if (!details.tagName || !details.tagSlug) {
        throw new Error('Tag mode requires tagName and tagSlug')
      }
      return `ubos://tag:${details.tagName}/${details.tagSlug}`
    
    case 'self':
      return 'ubos://self'
    
    case 'alias':
      if (!details.aliasName) {
        throw new Error('Alias mode requires aliasName')
      }
      return `ubos://alias:${details.aliasName}`
    
    case 'remote':
      if (!details.remoteHost || !details.remoteSlug) {
        throw new Error('Remote mode requires remoteHost and remoteSlug')
      }
      return `ubos://@${details.remoteHost}/${details.remoteSlug}`
    
    default:
      throw new Error(`Unsupported URI mode: ${(details as any).mode}`)
  }
}

/**
 * Parses a UBOS URI string and returns the details
 * Supports multiple URI modes: standard, ctx, commit, tag, self, alias, remote
 * 
 * @param uri - The UBOS URI string to parse
 * @returns UbosUriDetails object with parsed components
 * @throws Error if the URI format is invalid
 */
export function parseUbosUri(uri: string): UbosUriDetails {
  if (!uri || typeof uri !== 'string') {
    throw new Error('URI must be a non-empty string')
  }

  // Remove any whitespace
  uri = uri.trim()

  // Check if it starts with ubos://
  if (!uri.startsWith('ubos://')) {
    throw new Error('Invalid UBOS URI: must start with ubos://')
  }

  // Remove the ubos:// prefix
  const withoutScheme = uri.substring(7)

  // Mode 5: Self - ubos://self
  if (withoutScheme === 'self') {
    return { mode: 'self' }
  }

  // Mode 7: Remote - ubos://@192.168.1.5/user_101
  if (withoutScheme.startsWith('@')) {
    const match = withoutScheme.match(/^@([^/]+)\/(.+)$/)
    if (!match) {
      throw new Error('Invalid remote UBOS URI format: ubos://@host/slug')
    }
    return {
      mode: 'remote',
      remoteHost: match[1],
      remoteSlug: match[2],
    }
  }

  // Split path and query
  const [pathPart, queryPart] = withoutScheme.split('?')

  if (!pathPart) {
    throw new Error('Invalid UBOS URI: missing path')
  }

  // Mode 1: Context (Ctx) - ubos://ctx/logic_tax_calc
  if (pathPart.startsWith('ctx/')) {
    const ctxSlug = pathPart.substring(4)
    if (!ctxSlug) {
      throw new Error('Invalid ctx UBOS URI: missing slug after ctx/')
    }
    return {
      mode: 'ctx',
      ctxSlug,
    }
  }

  // Mode 2: Commit - ubos://commit:8f2a.../contract_101
  if (pathPart.startsWith('commit:')) {
    const commitMatch = pathPart.match(/^commit:([^/]+)\/(.+)$/)
    if (!commitMatch) {
      throw new Error('Invalid commit UBOS URI format: ubos://commit:hash/slug')
    }
    return {
      mode: 'commit',
      commitHash: commitMatch[1],
      commitSlug: commitMatch[2],
    }
  }

  // Mode 3: Tag - ubos://tag:v1.0/app_quiz
  if (pathPart.startsWith('tag:')) {
    const tagMatch = pathPart.match(/^tag:([^/]+)\/(.+)$/)
    if (!tagMatch) {
      throw new Error('Invalid tag UBOS URI format: ubos://tag:name/slug')
    }
    return {
      mode: 'tag',
      tagName: tagMatch[1],
      tagSlug: tagMatch[2],
    }
  }

  // Mode 6: Alias - ubos://alias:home_banner
  if (pathPart.startsWith('alias:')) {
    const aliasName = pathPart.substring(6)
    if (!aliasName) {
      throw new Error('Invalid alias UBOS URI: missing alias name after alias:')
    }
    return {
      mode: 'alias',
      aliasName,
    }
  }

  // Mode 0: Standard - ubos://type/slug?branch=name&cid=commitId
  const pathSegments = pathPart.split('/')
  
  if (pathSegments.length < 2) {
    throw new Error('Invalid UBOS URI: path must contain type and slug')
  }

  const type = pathSegments[0]
  const slug = pathSegments.slice(1).join('/') // Handle slugs that might contain slashes

  if (!type || !slug) {
    throw new Error('Invalid UBOS URI: type and slug are required')
  }

  // Parse query parameters
  const params = new URLSearchParams(queryPart || '')
  const branch = params.get('branch')
  const cidParam = params.get('cid')

  // For standard mode, branch is required
  if (!branch) {
    throw new Error('Invalid UBOS URI: branch parameter is required for standard mode')
  }

  // Parse commit ID if present
  let commitId: number | undefined
  if (cidParam) {
    const parsedCid = parseInt(cidParam, 10)
    if (isNaN(parsedCid)) {
      throw new Error('Invalid UBOS URI: cid must be a valid number')
    }
    commitId = parsedCid
  }

  return {
    mode: 'standard',
    type,
    slug,
    branch,
    commitId,
  }
}

/**
 * Validates if a string is a valid UBOS URI format
 * 
 * @param uri - The URI string to validate
 * @returns true if the URI format is valid, false otherwise
 */
export function isValidUbosUri(uri: string): boolean {
  try {
    parseUbosUri(uri)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a URI is in standard mode (type/slug format)
 * 
 * @param uri - The URI string to check
 * @returns true if the URI is in standard mode, false otherwise
 */
export function isStandardUbosUri(uri: string): boolean {
  try {
    const details = parseUbosUri(uri)
    return details.mode === 'standard'
  } catch {
    return false
  }
}

/**
 * Gets the URI mode from a UBOS URI string
 * 
 * @param uri - The URI string
 * @returns The URI mode, or null if invalid
 */
export function getUbosUriMode(uri: string): UbosUriMode | null {
  try {
    const details = parseUbosUri(uri)
    return details.mode
  } catch {
    return null
  }
}


