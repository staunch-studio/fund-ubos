/**
 * UBOS URI Utility Functions
 * 
 * Provides functions to build and parse UBOS URIs.
 * Format: ubos://type/slug?branch=name&cid=commitId
 */

/**
 * Interface matching the Java DTO for UBOS URI details
 */
export interface UbosUriDetails {
  type: string
  slug: string
  branch: string
  commitId?: number
}

/**
 * Builds a UBOS URI from components
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
 * Parses a UBOS URI string and returns the details
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

  // Split path and query
  const [pathPart, queryPart] = withoutScheme.split('?')

  if (!pathPart) {
    throw new Error('Invalid UBOS URI: missing path')
  }

  // Parse path segments (type/slug)
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

  if (!branch) {
    throw new Error('Invalid UBOS URI: branch parameter is required')
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


