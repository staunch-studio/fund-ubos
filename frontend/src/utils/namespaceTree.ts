/**
 * Utility functions for parsing dot-separated slugs into tree structure
 */

import type { EntityInstance } from '../types/ubos'

export interface TreeNode {
  key: string
  title: string
  isLeaf: boolean // true for entities, false for folders
  children?: TreeNode[]
  entity?: EntityInstance // Only present for leaf nodes
  path: string // Full path like "finance.taxes"
}

/**
 * Parse a flat list of entities with dot-separated slugs into a tree structure
 * Example: ["finance.taxes.calc_rate", "finance.taxes.calc_debt"] 
 * becomes:
 * {
 *   finance: {
 *     taxes: {
 *       calc_rate: EntityInstance,
 *       calc_debt: EntityInstance
 *     }
 *   }
 * }
 */
export function parseSlugsToTree(entities: EntityInstance[]): TreeNode[] {
  const treeMap = new Map<string, TreeNode>()
  const rootNodes: TreeNode[] = []

  // Process each entity
  for (const entity of entities) {
    const parts = entity.slug.split('.')
    let currentPath = ''
    let parentNode: TreeNode | null = null

    // Build path for each part
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      currentPath = currentPath ? `${currentPath}.${part}` : part

      // Check if node already exists
      if (!treeMap.has(currentPath)) {
        const node: TreeNode = {
          key: currentPath,
          title: part,
          isLeaf: isLast,
          path: currentPath,
          children: isLast ? undefined : [],
        }

        // If it's the last part, attach the entity
        if (isLast) {
          node.entity = entity
        }

        treeMap.set(currentPath, node)

        // Add to parent's children or root
        if (parentNode) {
          if (!parentNode.children) {
            parentNode.children = []
          }
          parentNode.children.push(node)
        } else {
          rootNodes.push(node)
        }
      }

      // Update parent for next iteration
      parentNode = treeMap.get(currentPath) || null
    }
  }

  // Sort nodes: folders first, then files, both alphabetically
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .map((node) => {
        if (node.children) {
          node.children = sortNodes(node.children)
        }
        return node
      })
      .sort((a, b) => {
        // Folders come before files
        if (a.isLeaf !== b.isLeaf) {
          return a.isLeaf ? 1 : -1
        }
        // Then alphabetically
        return a.title.localeCompare(b.title)
      })
  }

  return sortNodes(rootNodes)
}

/**
 * Find all entities under a given path (namespace)
 */
export function getEntitiesInNamespace(
  entities: EntityInstance[],
  namespacePath: string
): EntityInstance[] {
  if (!namespacePath) {
    // Return root-level entities (those without dots)
    return entities.filter((e) => !e.slug.includes('.'))
  }

  // Return entities that start with the namespace path
  const prefix = `${namespacePath}.`
  return entities.filter((e) => e.slug.startsWith(prefix))
}

/**
 * Get the parent path of a given path
 * Example: "finance.taxes" -> "finance"
 * Example: "finance" -> ""
 */
export function getParentPath(path: string): string {
  const lastDotIndex = path.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return ''
  }
  return path.substring(0, lastDotIndex)
}

/**
 * Get breadcrumb items from a path
 * Example: "finance.taxes" -> ["finance", "taxes"]
 */
export function getBreadcrumbItems(path: string): string[] {
  if (!path) {
    return []
  }
  return path.split('.')
}

