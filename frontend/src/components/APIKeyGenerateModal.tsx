import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, Button, Space, message, theme, Typography, Alert, Input as AntdInput } from 'antd'
import { Key, Save, Copy, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useBatchCommitMutation } from '../store/ubosApi'
import { formatSecurityKeyToSnapshotData, type SecurityKeyData } from '../utils/entityHelpers'

const { TextArea } = Input
const { Text } = Typography

interface APIKeyGenerateModalProps {
  open: boolean
  onCancel: () => void
  onSuccess?: () => void
  currentBranch: string
  availableScopes?: string[]
}

export function APIKeyGenerateModal({
  open,
  onCancel,
  onSuccess,
  currentBranch,
  availableScopes = ['read', 'write', 'admin'],
}: APIKeyGenerateModalProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorWarning, colorSuccess },
  } = theme.useToken()

  const [form] = Form.useForm()
  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)
  const [generatedKeyId, setGeneratedKeyId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      form.resetFields()
      setGeneratedKey(null)
      setKeyCopied(false)
      setGeneratedKeyId(null)
    }
  }, [open, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      // Generate a unique key ID (slug)
      const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      // Generate a secure API key token (this would normally be done by the backend)
      // For now, we'll generate a placeholder - the backend should handle actual key generation
      const apiKeyToken = `ubos_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`

      // Create SecurityKeyData
      const keyData: SecurityKeyData = {
        keyId: keyId,
        description: values.description || undefined,
        scope: values.scope,
        isActive: true,
        createdAt: new Date().toISOString(),
      }

      // Format as snapshotData
      const snapshotData = formatSecurityKeyToSnapshotData(keyData)

      // Create JSON Patch
      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: snapshotData,
        },
      ])

      // Commit the new key entity
      await batchCommit({
        slugs: [keyId],
        branch: currentBranch,
        jsonPatch,
        message: `Create API key: ${values.description || keyId}`,
      }).unwrap()

      // Set generated key for display (one-time view)
      setGeneratedKey(apiKeyToken)
      setGeneratedKeyId(keyId)
      message.success('API Key generated successfully')
      onSuccess?.()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to generate API key')
    }
  }

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey)
      setKeyCopied(true)
      message.success('API Key copied to clipboard', 1.5)
      setTimeout(() => setKeyCopied(false), 2000)
    }
  }

  const handleClose = () => {
    if (generatedKey) {
      // Warn user if they haven't copied the key
      Modal.confirm({
        title: 'Close without copying?',
        content: 'The API key will never be shown again. Are you sure you want to close?',
        okText: 'Yes, close',
        cancelText: 'No, keep open',
        onOk: () => {
          setGeneratedKey(null)
          setGeneratedKeyId(null)
          form.resetFields()
          onCancel()
        },
      })
    } else {
      onCancel()
    }
  }

  return (
    <Modal
      title={
        <Space>
          <Key size={18} />
          <Text strong style={{ fontSize: '16px' }}>
            Generate New API Key
          </Text>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={generatedKey ? null : [
        <Button key="cancel" onClick={handleClose} disabled={isCommitting}>
          Cancel
        </Button>,
        <Button
          key="generate"
          type="primary"
          icon={<Save size={16} />}
          onClick={handleSubmit}
          loading={isCommitting}
        >
          Generate Key
        </Button>,
      ]}
      width={700}
      destroyOnClose
    >
      {generatedKey ? (
        // Display generated key (one-time view)
        <div>
          <Alert
            message="API Key Generated Successfully"
            description="Please copy this key now. It will never be shown again after you close this dialog."
            type="success"
            icon={<CheckCircle2 size={16} />}
            style={{ marginBottom: '24px' }}
            showIcon
          />

          <div style={{ marginBottom: '16px' }}>
            <Text style={{ color: colorText, fontWeight: 500, marginBottom: '8px', display: 'block' }}>
              Your API Key:
            </Text>
            <AntdInput
              value={generatedKey}
              readOnly
              style={{
                fontFamily: 'monospace',
                fontSize: '14px',
                padding: '12px',
                background: colorTextSecondary + '10',
                border: `2px solid ${colorSuccess}`,
                borderRadius: '4px',
              }}
              suffix={
                <Button
                  type="text"
                  icon={keyCopied ? <CheckCircle2 size={16} style={{ color: colorSuccess }} /> : <Copy size={16} />}
                  onClick={handleCopyKey}
                  style={{ color: keyCopied ? colorSuccess : colorTextSecondary }}
                >
                  {keyCopied ? 'Copied!' : 'Copy'}
                </Button>
              }
            />
          </div>

          <Alert
            message="Important Security Notice"
            description={
              <div>
                <Text style={{ fontSize: '12px' }}>
                  • Store this key securely - it will not be shown again
                  <br />
                  • Do not share this key publicly or commit it to version control
                  <br />
                  • If you lose this key, you will need to generate a new one
                </Text>
              </div>
            }
            type="warning"
            icon={<AlertTriangle size={16} />}
            style={{ marginBottom: '16px' }}
            showIcon
          />

          <div style={{ textAlign: 'right' }}>
            <Button type="primary" onClick={handleClose}>
              I've Saved the Key
            </Button>
          </div>
        </div>
      ) : (
        // Generate form
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: '16px' }}
        >
          <Form.Item
            label={
              <Space>
                <Text style={{ color: colorText, fontWeight: 500 }}>Scope</Text>
                <Text style={{ color: colorTextSecondary, fontSize: '12px', fontWeight: 400 }}>
                  (Required)
                </Text>
              </Space>
            }
            name="scope"
            rules={[{ required: true, message: 'Please select a scope' }]}
          >
            <Select
              placeholder="Select scope/permissions"
              options={availableScopes.map((scope) => ({
                label: (
                  <Space>
                    <Key size={14} />
                    <span style={{ textTransform: 'capitalize' }}>{scope}</span>
                  </Space>
                ),
                value: scope,
              }))}
            />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <Text style={{ color: colorText, fontWeight: 500 }}>Description</Text>
                <Text style={{ color: colorTextSecondary, fontSize: '12px', fontWeight: 400 }}>
                  (Optional)
                </Text>
              </Space>
            }
            name="description"
          >
            <TextArea
              placeholder="e.g., Production API access for CI/CD pipeline"
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
              The generated API key will be shown only once. Make sure to copy and store it securely
              before closing this dialog. The key will be committed to branch "{currentBranch}".
            </Text>
          </div>
        </Form>
      )}
    </Modal>
  )
}
