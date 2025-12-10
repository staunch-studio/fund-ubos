import { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, Button, Space, message, theme, Typography } from 'antd'
import { GitBranch, Plus, Hash } from 'lucide-react'
import { useGetBranchesQuery, useCreateBranchMutation } from '../store/ubosApi'

const { Text } = Typography

interface BranchManagerModalProps {
  open: boolean
  onCancel: () => void
  onSuccess?: () => void
}

export function BranchManagerModal({ open, onCancel, onSuccess }: BranchManagerModalProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder },
  } = theme.useToken()

  const [form] = Form.useForm()
  const [createBranch, { isLoading: isCreating }] = useCreateBranchMutation()

  // Fetch branches for parent branch selector
  const { data: branches = [], isLoading: isLoadingBranches } = useGetBranchesQuery(undefined, {
    skip: !open, // Only fetch when modal is open
  })

  useEffect(() => {
    if (open) {
      form.resetFields()
      // Set default parent branch to "master" or first branch if available
      if (branches.length > 0) {
        const defaultParent = branches.find(b => b.branchName === 'master')?.branchName || branches[0].branchName
        form.setFieldsValue({ parentBranchName: defaultParent })
      }
    }
  }, [open, branches, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const result = await createBranch({
        newBranchName: values.newBranchName,
        baseCommitId: values.baseCommitId,
        parentBranchName: values.parentBranchName || 'master',
        description: values.description || undefined,
      }).unwrap()

      message.success(`Branch "${result.branchName}" created successfully`)
      form.resetFields()
      onSuccess?.()
      onCancel()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to create branch')
    }
  }

  return (
    <Modal
      title={
        <Space>
          <GitBranch size={18} />
          <Text strong style={{ fontSize: '16px' }}>
            Manage Branches
          </Text>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} />}
          loading={isCreating}
          onClick={handleSubmit}
        >
          Create Branch
        </Button>,
      ]}
      width={500}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        style={{ marginTop: '16px' }}
      >
        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              New Branch Name
            </Text>
          }
          name="newBranchName"
          rules={[
            { required: true, message: 'Please enter a branch name' },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: 'Branch name can only contain letters, numbers, underscores, and hyphens',
            },
          ]}
        >
          <Input
            placeholder="e.g., feature/new-feature"
            prefix={<GitBranch size={14} style={{ color: colorTextSecondary }} />}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              Base Commit ID
            </Text>
          }
          name="baseCommitId"
          rules={[
            { required: true, message: 'Please enter a base commit ID' },
            { type: 'number', min: 1, message: 'Commit ID must be a positive number' },
          ]}
        >
          <InputNumber
            placeholder="e.g., 101"
            prefix={<Hash size={14} style={{ color: colorTextSecondary }} />}
            style={{ width: '100%' }}
            min={1}
            precision={0}
            controls
          />
        </Form.Item>

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              Parent Branch
            </Text>
          }
          name="parentBranchName"
          tooltip="Optional: Parent branch name for inheritance (defaults to 'master')"
        >
          <Select
            placeholder="Select parent branch (optional, defaults to master)"
            loading={isLoadingBranches}
            allowClear
            options={branches.map((branch) => ({
              label: (
                <Space>
                  <GitBranch size={14} />
                  <span>{branch.branchName}</span>  
                </Space>
              ),
              value: branch.branchName,
            }))}
            notFoundContent={
              isLoadingBranches ? (
                <Text style={{ color: colorTextSecondary }}>Loading branches...</Text>
              ) : (
                <Text style={{ color: colorTextSecondary }}>No branches found</Text>
              )
            }
          />
        </Form.Item>

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              Description
            </Text>
          }
          name="description"
          tooltip="Optional: Description for the new branch"
        >
          <Input.TextArea
            placeholder="e.g., Feature branch for new payment system"
            rows={3}
            maxLength={500}
            showCount
          />
        </Form.Item>

        <div
          style={{
            padding: '12px',
            background: 'rgba(74, 158, 255, 0.05)',
            borderRadius: '4px',
            border: `1px solid ${colorBorder}`,
            marginTop: '8px',
          }}
        >
          <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
            A new branch will be created pointing to the specified commit ID. 
            {branches.length > 0 && ' If a parent branch is selected, entities and history will be inherited from it.'}
          </Text>
        </div>
      </Form>
    </Modal>
  )
}

