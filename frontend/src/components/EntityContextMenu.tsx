import { useState } from 'react'
import { Modal, Input, Form, message, Select } from 'antd'
import { useRenameEntityMutation, useCopyEntityMutation, useGetBranchesQuery } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'
import { buildUbosUri } from '../utils/useUbosUri'

interface EntityContextMenuProps {
  entity: EntityInstance
  currentBranch: string
  onRenameSuccess?: () => void
  onCopySuccess?: () => void
}

export function useEntityContextMenu({ entity, currentBranch, onRenameSuccess, onCopySuccess }: EntityContextMenuProps) {
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [renameForm] = Form.useForm()
  const [copyForm] = Form.useForm()

  const [renameEntity, { isLoading: isRenaming }] = useRenameEntityMutation()
  const [copyEntity, { isLoading: isCopying }] = useCopyEntityMutation()
  const { data: branches = [] } = useGetBranchesQuery()

  const handleRename = async () => {
    try {
      const values = await renameForm.validateFields()
      await renameEntity({
        slug: entity.slug,
        newSlug: values.newSlug,
        branch: currentBranch,
        type: entity.entityType,
      }).unwrap()

      message.success(`Entity renamed to ${values.newSlug}`)
      setRenameModalOpen(false)
      renameForm.resetFields()
      onRenameSuccess?.()
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to rename entity'
      if (err?.status === 403 || err?.data?.status === 403) {
        message.error(`Permission Denied: ${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
    }
  }

  const handleCopy = async () => {
    try {
      const values = await copyForm.validateFields()
      await copyEntity({
        slug: entity.slug,
        targetSlug: values.targetSlug,
        sourceBranch: currentBranch,
        targetBranch: values.targetBranch,
        type: entity.entityType,
      }).unwrap()

      message.success(`Entity copied to ${values.targetSlug} on ${values.targetBranch}`)
      setCopyModalOpen(false)
      copyForm.resetFields()
      onCopySuccess?.()
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to copy entity'
      if (err?.status === 403 || err?.data?.status === 403) {
        message.error(`Permission Denied: ${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
    }
  }

  const showRenameModal = () => {
    renameForm.setFieldsValue({ newSlug: entity.slug })
    setRenameModalOpen(true)
  }

  const showCopyModal = () => {
    copyForm.setFieldsValue({ targetSlug: `${entity.slug}_copy`, targetBranch: currentBranch })
    setCopyModalOpen(true)
  }

  const RenameModal = (
    <Modal
      title="Rename Entity"
      open={renameModalOpen}
      onCancel={() => {
        setRenameModalOpen(false)
        renameForm.resetFields()
      }}
      onOk={handleRename}
      confirmLoading={isRenaming}
      okText="Rename"
    >
      <Form form={renameForm} layout="vertical">
        <Form.Item
          label="Current Slug"
          name="currentSlug"
          initialValue={entity.slug}
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          label="New Slug"
          name="newSlug"
          rules={[
            { required: true, message: 'Please enter a new slug' },
            { pattern: /^[a-zA-Z0-9._-]+$/, message: 'Slug can only contain letters, numbers, dots, underscores, and hyphens' },
          ]}
        >
          <Input placeholder="Enter new slug" />
        </Form.Item>
      </Form>
    </Modal>
  )

  const CopyModal = (
    <Modal
      title="Copy Entity"
      open={copyModalOpen}
      onCancel={() => {
        setCopyModalOpen(false)
        copyForm.resetFields()
      }}
      onOk={handleCopy}
      confirmLoading={isCopying}
      okText="Copy"
    >
      <Form form={copyForm} layout="vertical">
        <Form.Item
          label="Source"
          name="source"
          initialValue={`${entity.slug} (${currentBranch})`}
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          label="Target Slug"
          name="targetSlug"
          rules={[
            { required: true, message: 'Please enter a target slug' },
            { pattern: /^[a-zA-Z0-9._-]+$/, message: 'Slug can only contain letters, numbers, dots, underscores, and hyphens' },
          ]}
        >
          <Input placeholder="Enter target slug" />
        </Form.Item>
        <Form.Item
          label="Target Branch"
          name="targetBranch"
          rules={[{ required: true, message: 'Please select a target branch' }]}
        >
          <Select
            placeholder="Select target branch"
            options={branches.map((b) => ({
              label: b.branchName,
              value: b.branchName,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )

  return {
    showRenameModal,
    showCopyModal,
    RenameModal,
    CopyModal,
  }
}


