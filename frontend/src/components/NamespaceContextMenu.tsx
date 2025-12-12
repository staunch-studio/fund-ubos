import { useState } from 'react'
import { Modal, Input, Form, message } from 'antd'
import { useBatchCommitMutation, useGetEntitiesQuery } from '../store/ubosApi'

interface NamespaceContextMenuProps {
  namespace: string
  currentBranch: string
  entityTypeFilter?: string
  onRenameSuccess?: () => void
}

export function useNamespaceContextMenu({ namespace, currentBranch, entityTypeFilter, onRenameSuccess }: NamespaceContextMenuProps) {
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameForm] = Form.useForm()
  const [batchCommit, { isLoading: isRenaming }] = useBatchCommitMutation()
  
  // Fetch all entities in the namespace
  const { data: allEntities = [] } = useGetEntitiesQuery({
    branch: currentBranch,
    type: entityTypeFilter,
  })

  const handleRename = async () => {
    try {
      const values = await renameForm.validateFields()
      const newPrefix = values.newPrefix
      
      // Find all entities under this namespace
      const namespacePrefix = `${namespace}.`
      const entitiesInNamespace = allEntities.filter((e) => e.slug.startsWith(namespacePrefix))
      
      if (entitiesInNamespace.length === 0) {
        message.warning('No entities found in this namespace')
        return
      }

      // Build JSON Patch operations to rename all entities
      const patches = entitiesInNamespace.map((entity) => {
        const oldSlug = entity.slug
        const relativePath = oldSlug.substring(namespacePrefix.length)
        const newSlug = `${newPrefix}.${relativePath}`
        
        return {
          op: 'replace' as const,
          path: '/slug',
          value: newSlug,
        }
      })

      // Use batch commit to rename all entities
      // Note: This is a simplified approach. In a real implementation,
      // you might want a dedicated endpoint for bulk namespace renaming
      await batchCommit({
        slugs: entitiesInNamespace.map((e) => e.slug),
        branch: currentBranch,
        jsonPatch: JSON.stringify(patches),
        message: `Rename namespace from ${namespace} to ${newPrefix}`,
        type: entityTypeFilter,
      }).unwrap()

      message.success(`Namespace renamed from ${namespace} to ${newPrefix} (${entitiesInNamespace.length} entities)`)
      setRenameModalOpen(false)
      renameForm.resetFields()
      onRenameSuccess?.()
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to rename namespace'
      if (err?.status === 403 || err?.data?.status === 403) {
        message.error(`Permission Denied: ${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
    }
  }

  const showRenameModal = () => {
    // Extract the last part of the namespace as the default new prefix
    const parts = namespace.split('.')
    const defaultPrefix = parts.length > 1 ? parts.slice(0, -1).join('.') : namespace
    renameForm.setFieldsValue({ newPrefix: defaultPrefix })
    setRenameModalOpen(true)
  }

  const RenameModal = (
    <Modal
      title="Rename Namespace"
      open={renameModalOpen}
      onCancel={() => {
        setRenameModalOpen(false)
        renameForm.resetFields()
      }}
      onOk={handleRename}
      confirmLoading={isRenaming}
      okText="Rename"
      width={500}
    >
      <Form form={renameForm} layout="vertical">
        <Form.Item
          label="Current Namespace"
          name="currentNamespace"
          initialValue={namespace}
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          label="New Namespace Prefix"
          name="newPrefix"
          rules={[
            { required: true, message: 'Please enter a new namespace prefix' },
            { pattern: /^[a-zA-Z0-9._-]+$/, message: 'Namespace can only contain letters, numbers, dots, underscores, and hyphens' },
          ]}
          help="All entities under this namespace will be renamed with the new prefix"
        >
          <Input placeholder="Enter new namespace prefix" />
        </Form.Item>
      </Form>
    </Modal>
  )

  return {
    showRenameModal,
    RenameModal,
  }
}



