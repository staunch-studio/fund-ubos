import { useState, useMemo, useEffect } from 'react'
import { Tree, theme } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { Folder, FileCode } from 'lucide-react'
import { useGetEntitiesQuery } from '../store/ubosApi'
import { parseSlugsToTree, type TreeNode } from '../utils/namespaceTree'
import type { EntityInstance } from '../types/ubos'

const { DirectoryTree } = Tree

interface NamespaceTreeProps {
  currentBranch: string
  entityTypeFilter?: string
  selectedNamespace?: string
  onNamespaceSelect?: (namespace: string | null) => void
  onEntitySelect?: (entity: EntityInstance) => void
}

export function NamespaceTree({
  currentBranch,
  entityTypeFilter,
  selectedNamespace,
  onNamespaceSelect,
  onEntitySelect,
}: NamespaceTreeProps) {
  const {
    token: { colorText, colorTextSecondary, colorPrimary, colorBgContainer },
  } = theme.useToken()

  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  // Fetch entities for navigation
  // Use regular getEntitiesQuery since navigate endpoint may not exist yet
  const { data: entities = [], isLoading } = useGetEntitiesQuery({
    branch: currentBranch,
    type: entityTypeFilter,
  })

  // Parse entities into tree structure
  const treeData = useMemo(() => {
    const treeNodes = parseSlugsToTree(entities)
    return convertToAntDTreeData(treeNodes)
  }, [entities])

  // Convert TreeNode to AntD Tree DataNode format
  function convertToAntDTreeData(nodes: TreeNode[]): DataNode[] {
    return nodes.map((node) => {
      const dataNode: DataNode = {
        key: node.key,
        title: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 0',
            }}
          >
            {node.isLeaf ? (
              <FileCode size={14} color={colorTextSecondary} />
            ) : (
              <Folder size={14} color={colorPrimary} />
            )}
            <span style={{ color: node.isLeaf ? colorText : colorPrimary }}>
              {node.title}
            </span>
          </div>
        ),
        isLeaf: node.isLeaf,
        children: node.children ? convertToAntDTreeData(node.children) : undefined,
      }

      // Store entity data in the node for later retrieval
      if (node.entity) {
        (dataNode as any).entity = node.entity
      }

      return dataNode
    })
  }

  // Handle node selection
  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length === 0) {
      onNamespaceSelect?.(null)
      return
    }

    const selectedKey = selectedKeys[0] as string
    const node = findNodeByKey(treeData, selectedKey)

    if (node) {
      const isLeaf = (node as any).isLeaf
      const entity = (node as any).entity

      if (isLeaf && entity) {
        // It's an entity (file), select it
        onEntitySelect?.(entity)
      } else {
        // It's a folder (namespace), select the namespace
        onNamespaceSelect?.(selectedKey)
      }
    }
  }

  // Find node by key in tree data
  function findNodeByKey(nodes: DataNode[], key: string): DataNode | null {
    for (const node of nodes) {
      if (node.key === key) {
        return node
      }
      if (node.children) {
        const found = findNodeByKey(node.children, key)
        if (found) return found
      }
    }
    return null
  }

  // Auto-expand selected namespace path
  useMemo(() => {
    if (selectedNamespace) {
      const parts = selectedNamespace.split('.')
      const paths: string[] = []
      for (let i = 0; i < parts.length; i++) {
        paths.push(parts.slice(0, i + 1).join('.'))
      }
      setExpandedKeys(paths)
    }
  }, [selectedNamespace])

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: colorBgContainer,
        padding: '8px',
      }}
    >
      <DirectoryTree
        multiple={false}
        defaultExpandAll={false}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        selectedKeys={selectedNamespace ? [selectedNamespace] : []}
        onSelect={handleSelect}
        treeData={treeData}
        loading={isLoading}
        showIcon={false}
        style={{
          background: 'transparent',
          color: colorText,
        }}
      />
    </div>
  )
}

