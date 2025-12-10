import { useState, useEffect } from 'react'
import { Modal, Form, Input, Button, Space, message, theme, Typography } from 'antd'
import { FileCode, Save, GitCommit } from 'lucide-react'
import { useGetSchemaQuery, useCommitSchemaMutation } from '../store/ubosApi'
import Editor from '@monaco-editor/react'

const { TextArea } = Input
const { Text } = Typography

interface SchemaEditModalProps {
  open: boolean
  onCancel: () => void
  onSuccess?: () => void
  entityType: string | null
  currentBranch: string
}

export function SchemaEditModal({
  open,
  onCancel,
  onSuccess,
  entityType,
  currentBranch,
}: SchemaEditModalProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorBgContainer },
  } = theme.useToken()

  const [form] = Form.useForm()
  const [editorValue, setEditorValue] = useState('')
  const [commitSchema, { isLoading: isCommitting }] = useCommitSchemaMutation()

  // Fetch schema snapshot using GET /snapshot?type=SCHEMA&slug={entityType}&branch={branch}
  const {
    data: schemaSnapshot,
    isLoading: isLoadingSchema,
    error: schemaError,
  } = useGetSchemaQuery(
    {
      slug: entityType || '',
      type: 'SCHEMA',
      branch: currentBranch,
    },
    {
      skip: !open || !entityType,
    }
  )

  useEffect(() => {
    if (open) {
      form.resetFields()
      setEditorValue('')
    }
  }, [open, form])

  useEffect(() => {
    if (schemaSnapshot?.snapshotData) {
      try {
        // Parse and format JSON Schema
        const parsed = JSON.parse(schemaSnapshot.snapshotData)
        setEditorValue(JSON.stringify(parsed, null, 2))
      } catch {
        // If not valid JSON, use as-is
        setEditorValue(schemaSnapshot.snapshotData)
      }
    } else if (entityType && !isLoadingSchema && !schemaError) {
      // Set default empty schema if no schema exists
      setEditorValue(JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {},
        "required": []
      }, null, 2))
    }
  }, [schemaSnapshot, entityType, isLoadingSchema, schemaError])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (!entityType) {
        message.error('Entity type is required')
        return
      }

      // Validate JSON
      try {
        JSON.parse(editorValue)
      } catch (e) {
        message.error('Invalid JSON format. Please check your schema definition.')
        return
      }

      await commitSchema({
        entityType: entityType,
        schemaDefinition: editorValue,
        branch: currentBranch,
        message: values.message || `Update schema for ${entityType}`,
        author: values.author || undefined,
      }).unwrap()

      message.success(`Schema for "${entityType}" committed successfully`)
      form.resetFields()
      setEditorValue('')
      onSuccess?.()
      onCancel()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to commit schema')
    }
  }

  return (
    <Modal
      title={
        <Space>
          <FileCode size={18} />
          <Text strong style={{ fontSize: '16px' }}>
            Edit Schema: {entityType}
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
          key="commit"
          type="primary"
          icon={<GitCommit size={16} />}
          onClick={handleSubmit}
          loading={isCommitting}
        >
          Commit Schema
        </Button>,
      ]}
      width={900}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        style={{ marginTop: '16px' }}
      >
        {schemaError && (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(248, 81, 73, 0.1)', borderRadius: '4px', border: `1px solid rgba(248, 81, 73, 0.3)` }}>
            <Text style={{ color: '#F85149', fontSize: '12px' }}>
              Schema not found for {entityType} on branch {currentBranch}. You can create a new schema definition.
            </Text>
          </div>
        )}

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              JSON Schema Definition
            </Text>
          }
        >
          <div
            style={{
              border: `1px solid ${colorBorder}`,
              borderRadius: '4px',
              overflow: 'hidden',
              height: '400px',
            }}
          >
            {isLoadingSchema ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: colorTextSecondary,
                }}
              >
                <Text>Loading schema...</Text>
              </div>
            ) : (
              <Editor
                height="100%"
                defaultLanguage="json"
                language="json"
                value={editorValue}
                onChange={(value) => setEditorValue(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on',
                  formatOnPaste: true,
                  formatOnType: true,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                }}
              />
            )}
          </div>
        </Form.Item>

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
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              Commit Message
            </Text>
          }
          name="message"
          rules={[{ required: true, message: 'Please enter a commit message' }]}
        >
          <TextArea
            placeholder="e.g., Update schema definition for LOGIC entities"
            rows={3}
            style={{ fontFamily: 'monospace' }}
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
            Schema definitions are versioned entities. Changes will be committed to branch "{currentBranch}" and tracked in the commit history.
          </Text>
        </div>
      </Form>
    </Modal>
  )
}

