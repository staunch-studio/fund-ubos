import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, InputNumber, Button, Space, message, theme, Typography, Alert } from 'antd'
import { Server, GitBranch, Hash, AlertTriangle } from 'lucide-react'
import { useGetBranchesQuery, useBatchCommitMutation, useGetSnapshotByCommitQuery, useGetSnapshotQuery } from '../store/ubosApi'
import { formatEnvironmentToSnapshotData, parseEnvironmentFromSnapshot, type EnvironmentData } from '../utils/entityHelpers'

const { TextArea } = Input
const { Text } = Typography

interface EnvironmentEditModalProps {
  open: boolean
  onCancel: () => void
  onSuccess?: () => void
  environmentId?: string | null // If provided, this is an edit operation
  environmentData?: EnvironmentData | null // Existing environment data for editing
  currentBranch: string
}

export function EnvironmentEditModal({
  open,
  onCancel,
  onSuccess,
  environmentId,
  environmentData,
  currentBranch,
}: EnvironmentEditModalProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorWarning },
  } = theme.useToken()

  const [form] = Form.useForm()
  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()

  // Fetch branches for branch selector
  const { data: branches = [], isLoading: isLoadingBranches } = useGetBranchesQuery(undefined, {
    skip: !open,
  })

  const branchNames = branches.map(b => b.branchName)

  // Fetch existing environment snapshot if editing
  const {
    data: environmentSnapshot,
    isLoading: isLoadingSnapshot,
  } = useGetSnapshotQuery(
    {
      slug: environmentId || '',
      type: 'ENVIRONMENT',
      branch: currentBranch,
    },
    {
      skip: !open || !environmentId,
    }
  )

  // Parse environment data from snapshot if available
  const existingData = environmentSnapshot
    ? parseEnvironmentFromSnapshot(environmentSnapshot)
    : environmentData

  // Get form values for validation
  const mappedBranch = Form.useWatch('mappedBranch', form)
  const mappedCommitId = Form.useWatch('mappedCommitId', form)

  // Fetch commit details to validate branch match
  const {
    data: commitSnapshot,
    isLoading: isLoadingCommit,
    error: commitError,
  } = useGetSnapshotByCommitQuery(
    {
      slug: 'validation', // Dummy slug - we only need commit metadata
      type: 'LOGIC',
      branch: mappedBranch || 'master',
      commitId: mappedCommitId || 0,
    },
    {
      skip: !open || !mappedCommitId || !mappedBranch || mappedCommitId <= 0,
    }
  )

  const [branchMismatchWarning, setBranchMismatchWarning] = useState<string | null>(null)

  useEffect(() => {
    if (mappedCommitId && mappedBranch) {
      if (commitError) {
        // If there's an error, the commit might not exist on the mapped branch
        setBranchMismatchWarning(
          `Warning: Unable to verify commit ${mappedCommitId} on branch '${mappedBranch}'. Please verify the commit exists on this branch.`
        )
      } else if (commitSnapshot) {
        // If we got a snapshot, check if the branch matches
        if (commitSnapshot.branchName !== mappedBranch) {
          setBranchMismatchWarning(
            `Warning: Mapped Commit ID ${mappedCommitId} is on '${commitSnapshot.branchName}' branch, but mappedBranch is '${mappedBranch}'`
          )
        } else {
          setBranchMismatchWarning(null)
        }
      } else {
        setBranchMismatchWarning(null)
      }
    } else {
      setBranchMismatchWarning(null)
    }
  }, [commitSnapshot, commitError, mappedCommitId, mappedBranch])

  useEffect(() => {
    if (open) {
      if (existingData) {
        // Edit mode: populate form with existing data
        form.setFieldsValue({
          envName: existingData.envName,
          mappedBranch: existingData.mappedBranch || 'master',
          mappedCommitId: existingData.mappedCommitId || undefined,
          description: existingData.description || '',
        })
      } else {
        // Create mode: reset form with defaults
        form.resetFields()
        form.setFieldsValue({
          mappedBranch: 'master', // Default to "master" as per backend
        })
      }
    }
  }, [open, existingData, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      const envName = values.envName || environmentId || `env_${Date.now()}`
      
      // Create or update EnvironmentData
      const envData: EnvironmentData = {
        envName: envName,
        mappedBranch: values.mappedBranch || 'master',
        mappedCommitId: values.mappedCommitId || null,
        description: values.description || undefined,
        updatedAt: new Date().toISOString(),
      }

      // Format as snapshotData
      const snapshotData = formatEnvironmentToSnapshotData(envData)

      // Create JSON Patch
      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: snapshotData,
        },
      ])

      // Commit the environment entity
      await batchCommit({
        slugs: [envName],
        branch: currentBranch,
        jsonPatch,
        message: environmentId
          ? `Update environment: ${envName}`
          : `Create environment: ${envName}`,
      }).unwrap()

      message.success(
        environmentId
          ? `Environment "${envName}" updated successfully`
          : `Environment "${envName}" created successfully`
      )
      form.resetFields()
      onSuccess?.()
      onCancel()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save environment')
    }
  }

  return (
    <Modal
      title={
        <Space>
          <Server size={18} />
          <Text strong style={{ fontSize: '16px' }}>
            {environmentId ? 'Edit Environment' : 'Create Environment'}
          </Text>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={isCommitting}>
          Cancel
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSubmit}
          loading={isCommitting || isLoadingSnapshot}
        >
          {environmentId ? 'Update' : 'Create'}
        </Button>,
      ]}
      width={600}
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
              Environment Name
            </Text>
          }
          name="envName"
          rules={[
            { required: true, message: 'Please enter an environment name' },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: 'Environment name can only contain letters, numbers, underscores, and hyphens',
            },
          ]}
        >
          <Input
            placeholder="e.g., production, staging, dev"
            prefix={<Server size={14} style={{ color: colorTextSecondary }} />}
            style={{ fontFamily: 'monospace' }}
            disabled={!!environmentId} // Read-only if editing
          />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <Text style={{ color: colorText, fontWeight: 500 }}>
                Mapped Branch
              </Text>
              <Text style={{ color: colorTextSecondary, fontSize: '12px', fontWeight: 400 }}>
                (defaults to "master")
              </Text>
            </Space>
          }
          name="mappedBranch"
          initialValue="master"
        >
          <Select
            placeholder="Select branch to map"
            loading={isLoadingBranches}
            options={branchNames.map((name) => ({
              label: (
                <Space>
                  <GitBranch size={14} />
                  <span>{name}</span>
                </Space>
              ),
              value: name,
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
            <Space>
              <Text style={{ color: colorText, fontWeight: 500 }}>
                Mapped Commit ID
              </Text>
              <Text style={{ color: colorTextSecondary, fontSize: '12px', fontWeight: 400 }}>
                (Optional)
              </Text>
            </Space>
          }
          name="mappedCommitId"
          tooltip="Pin to a specific commit for stable testing"
        >
          <InputNumber
            placeholder="e.g., 101"
            prefix={<Hash size={14} style={{ color: colorTextSecondary }} />}
            style={{ width: '100%' }}
            min={1}
            precision={0}
            controls
            loading={isLoadingCommit}
          />
        </Form.Item>

        {branchMismatchWarning && (
          <Alert
            message={branchMismatchWarning}
            type="warning"
            icon={<AlertTriangle size={16} />}
            style={{ marginBottom: '16px' }}
            showIcon
          />
        )}

        <Form.Item
          label={
            <Space>
              <Text style={{ color: colorText, fontWeight: 500 }}>
                Description
              </Text>
              <Text style={{ color: colorTextSecondary, fontSize: '12px', fontWeight: 400 }}>
                (Optional)
              </Text>
            </Space>
          }
          name="description"
        >
          <TextArea
            placeholder="e.g., Production environment for customer-facing services"
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
            The environment will be mapped to the selected branch (defaults to "master" if not provided).
            If a commit ID is mapped, the environment will be pinned to that specific commit for stable testing.
            Changes will be committed to branch "{currentBranch}".
          </Text>
        </div>
      </Form>
    </Modal>
  )
}

