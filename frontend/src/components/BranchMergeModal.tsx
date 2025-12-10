import { useState, useEffect, useMemo } from 'react'
import { Modal, Form, Select, Table, Input, Button, Space, message, theme, Typography, Steps, Checkbox } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { GitBranch, ArrowRight, CheckCircle, FileCode, User } from 'lucide-react'
import { useGetBranchesQuery, useMergeMutation, useGetEntitiesQuery } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'

const { Text } = Typography
const { TextArea } = Input

interface BranchMergeModalProps {
  open: boolean
  onCancel: () => void
  onSuccess?: () => void
  currentBranch?: string
}

type StepType = 'branch' | 'entities' | 'confirm'

export function BranchMergeModal({ open, onCancel, onSuccess, currentBranch }: BranchMergeModalProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState<StepType>('branch')
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [merge, { isLoading: isMerging }] = useMergeMutation()

  // Fetch branches
  const { data: branches = [], isLoading: isLoadingBranches } = useGetBranchesQuery(undefined, {
    skip: !open,
  })

  const branchNames = useMemo(() => branches.map(b => b.branchName), [branches])

  // Get source branch from form
  const sourceBranch = Form.useWatch('sourceBranch', form)

  // Fetch entities from source branch
  const {
    data: sourceEntities = [],
    isLoading: isLoadingEntities,
  } = useGetEntitiesQuery(
    {
      branch: sourceBranch || '',
    },
    {
      skip: !open || !sourceBranch || currentStep !== 'entities',
    }
  )

  useEffect(() => {
    if (open) {
      form.resetFields()
      setCurrentStep('branch')
      setSelectedSlugs([])
      // Set default target branch to current branch if available
      if (currentBranch && branchNames.includes(currentBranch)) {
        form.setFieldsValue({ targetBranch: currentBranch })
      }
    }
  }, [open, currentBranch, branchNames, form])

  const handleNext = async () => {
    if (currentStep === 'branch') {
      try {
        const values = await form.validateFields(['sourceBranch', 'targetBranch'])
        if (values.sourceBranch === values.targetBranch) {
          message.error('Source and target branches must be different')
          return
        }
        setCurrentStep('entities')
      } catch (err) {
        // Validation failed
      }
    } else if (currentStep === 'entities') {
      if (selectedSlugs.length === 0) {
        message.warning('Please select at least one entity to merge')
        return
      }
      setCurrentStep('confirm')
    }
  }

  const handleBack = () => {
    if (currentStep === 'entities') {
      setCurrentStep('branch')
    } else if (currentStep === 'confirm') {
      setCurrentStep('entities')
    }
  }

  const handleSubmit = async () => {
    try {
      // Validate all fields including sourceBranch and targetBranch
      const values = await form.validateFields()
      
      // Ensure all required fields are present
      if (!values.sourceBranch || !values.targetBranch) {
        message.error('Please select both source and target branches')
        setCurrentStep('branch')
        return
      }
      
      if (!values.message || values.message.trim() === '') {
        message.error('Please enter a commit message')
        return
      }
      
      if (selectedSlugs.length === 0) {
        message.error('Please select at least one entity to merge')
        setCurrentStep('entities')
        return
      }
      
      // Construct the merge request with all required fields
      const mergeRequest = {
        sourceBranch: values.sourceBranch,
        targetBranch: values.targetBranch,
        slugs: selectedSlugs,
        message: values.message.trim(),
        ...(values.author && values.author.trim() ? { author: values.author.trim() } : {}),
      }
      
      console.log('Merge request:', mergeRequest) // Debug log
      
      const result = await merge(mergeRequest).unwrap()

      message.success({
        content: `Successfully merged ${result.mergedSlugs.length} entity(ies) from ${values.sourceBranch} to ${values.targetBranch}`,
        duration: 5,
      })
      
      form.resetFields()
      setCurrentStep('branch')
      setSelectedSlugs([])
      onSuccess?.()
      onCancel()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to merge branches')
    }
  }

  const columns: ColumnsType<EntityInstance> = useMemo(
    () => [
      {
        title: '',
        key: 'select',
        width: 50,
        render: (_, record: EntityInstance) => (
          <Checkbox
            checked={selectedSlugs.includes(record.slug)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedSlugs([...selectedSlugs, record.slug])
              } else {
                setSelectedSlugs(selectedSlugs.filter(s => s !== record.slug))
              }
            }}
          />
        ),
      },
      {
        title: 'Slug',
        dataIndex: 'slug',
        key: 'slug',
        render: (text: string) => (
          <Text style={{ fontWeight: 500, color: colorText, fontFamily: 'monospace' }}>{text}</Text>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'entityType',
        key: 'entityType',
        render: (type: string) => (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{type}</Text>
        ),
      },
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 120,
        render: (text: string) => (
          <Text style={{ fontFamily: 'monospace', fontSize: '11px', color: colorTextSecondary }}>
            {text.substring(0, 8)}...
          </Text>
        ),
      },
    ],
    [selectedSlugs, colorText, colorTextSecondary]
  )

  const steps = [
    {
      title: 'Select Branches',
      icon: <GitBranch size={16} />,
    },
    {
      title: 'Select Entities',
      icon: <FileCode size={16} />,
    },
    {
      title: 'Confirm & Commit',
      icon: <CheckCircle size={16} />,
    },
  ]

  return (
    <Modal
      title={
        <Space>
          <GitBranch size={18} />
          <Text strong style={{ fontSize: '16px' }}>
            Merge Branches
          </Text>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnClose
    >
      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <Steps
          current={currentStep === 'branch' ? 0 : currentStep === 'entities' ? 1 : 2}
          items={steps}
          size="small"
        />
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        {/* Step 1: Branch Selection */}
        {currentStep === 'branch' && (
          <div>
            <Form.Item
              label={
                <Space>
                  <Text style={{ color: colorText, fontWeight: 500 }}>Source Branch (FROM)</Text>
                  <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
                    Select the branch to merge from
                  </Text>
                </Space>
              }
              name="sourceBranch"
              rules={[{ required: true, message: 'Please select a source branch' }]}
            >
              <Select
                placeholder="Select source branch"
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
                  <Text style={{ color: colorText, fontWeight: 500 }}>Target Branch (TO)</Text>
                  <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
                    Select the branch to merge into
                  </Text>
                </Space>
              }
              name="targetBranch"
              rules={[{ required: true, message: 'Please select a target branch' }]}
            >
              <Select
                placeholder="Select target branch"
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
              />
            </Form.Item>

            <div
              style={{
                padding: '12px',
                background: 'rgba(74, 158, 255, 0.05)',
                borderRadius: '4px',
                border: `1px solid ${colorBorder}`,
                marginTop: '16px',
              }}
            >
              <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
                <ArrowRight size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Changes from the source branch will be merged into the target branch. Select entities
                in the next step.
              </Text>
            </div>
          </div>
        )}

        {/* Step 2: Entity Selection */}
        {currentStep === 'entities' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Text style={{ color: colorText, fontWeight: 500, fontSize: '14px' }}>
                Select entities to merge from{' '}
                <Text strong style={{ color: colorPrimary }}>{sourceBranch}</Text>
              </Text>
              <div style={{ marginTop: '8px' }}>
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedSlugs(sourceEntities.map(e => e.slug))
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedSlugs([])
                    }}
                  >
                    Clear All
                  </Button>
                  <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
                    {selectedSlugs.length} of {sourceEntities.length} selected
                  </Text>
                </Space>
              </div>
            </div>

            <div
              style={{
                border: `1px solid ${colorBorder}`,
                borderRadius: '4px',
                maxHeight: '400px',
                overflow: 'auto',
                background: colorBgContainer,
              }}
            >
              {isLoadingEntities ? (
                <div style={{ padding: '24px', textAlign: 'center', color: colorTextSecondary }}>
                  <Text>Loading entities from {sourceBranch}...</Text>
                </div>
              ) : sourceEntities.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: colorTextSecondary }}>
                  <Text>No entities found in {sourceBranch}</Text>
                </div>
              ) : (
                <Table
                  columns={columns}
                  dataSource={sourceEntities}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} entities`,
                  }}
                  size="small"
                  style={{ background: colorBgContainer }}
                />
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirmation & Commit Message */}
        {currentStep === 'confirm' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Text style={{ color: colorText, fontWeight: 500, fontSize: '14px' }}>
                Merge Summary
              </Text>
            </div>
            <div
              style={{
                padding: '16px',
                background: 'rgba(74, 158, 255, 0.05)',
                borderRadius: '4px',
                border: `1px solid ${colorBorder}`,
                marginBottom: '16px',
              }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>Source Branch:</Text>{' '}
                  <Text strong style={{ color: colorPrimary }}>
                    {form.getFieldValue('sourceBranch')}
                  </Text>
                </div>
                <div>
                  <ArrowRight size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>Target Branch:</Text>{' '}
                  <Text strong style={{ color: colorPrimary }}>
                    {form.getFieldValue('targetBranch')}
                  </Text>
                </div>
                <div>
                  <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
                    Entities to merge: {selectedSlugs.length}
                  </Text>
                </div>
              </Space>
            </div>

            <Form.Item
              label={
                <Space>
                  <Text style={{ color: colorText, fontWeight: 500 }}>Author</Text>
                  <Text style={{ color: colorTextSecondary, fontSize: '12px', fontWeight: 400 }}>
                    (Optional)
                  </Text>
                </Space>
              }
              name="author"
            >
              <Input
                placeholder="e.g., admin@example.com"
                prefix={<User size={14} style={{ color: colorTextSecondary }} />}
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>

            <Form.Item
              label={
                <Text style={{ color: colorText, fontWeight: 500 }}>Commit Message</Text>
              }
              name="message"
              rules={[{ required: true, message: 'Please enter a commit message' }]}
            >
              <TextArea
                placeholder="e.g., Merging feature-A into master"
                rows={4}
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>

            <div
              style={{
                padding: '12px',
                background: 'rgba(255, 193, 7, 0.1)',
                borderRadius: '4px',
                border: `1px solid rgba(255, 193, 7, 0.3)`,
                marginTop: '8px',
              }}
            >
              <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
                ⚠️ This action will create a new commit on the target branch. Make sure you have
                reviewed the selected entities.
              </Text>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: `1px solid ${colorBorder}`,
          }}
        >
          <Button onClick={currentStep === 'branch' ? onCancel : handleBack} disabled={isMerging}>
            {currentStep === 'branch' ? 'Cancel' : 'Back'}
          </Button>
          <Space>
            {currentStep !== 'confirm' ? (
              <Button type="primary" onClick={handleNext} disabled={isMerging}>
                Next
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={isMerging}
                icon={<CheckCircle size={16} />}
              >
                Confirm Merge & Commit
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </Modal>
  )
}

