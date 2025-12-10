import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, Button, Space, message, theme, Typography } from 'antd'
import { Webhook, Save } from 'lucide-react'
import { useBatchCommitMutation } from '../store/ubosApi'
import { formatWebhookToSnapshotData, type WebhookData } from '../utils/entityHelpers'

const { TextArea } = Input
const { Text } = Typography

interface WebhookEditModalProps {
  open: boolean
  onCancel: () => void
  onSuccess?: () => void
  webhookId?: string | null // If provided, this is an edit operation
  webhookData?: WebhookData | null // Existing webhook data for editing
  currentBranch: string
  availableEntityTypes?: string[]
}

export function WebhookEditModal({
  open,
  onCancel,
  onSuccess,
  webhookId,
  webhookData,
  currentBranch,
  availableEntityTypes = ['LOGIC', 'VIEW', 'DATA', 'CONFIG', 'UserProfile', 'Product', 'Order'],
}: WebhookEditModalProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder },
  } = theme.useToken()

  const [form] = Form.useForm()
  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()

  useEffect(() => {
    if (open) {
      if (webhookData && webhookId) {
        // Edit mode: populate form with existing data
        form.setFieldsValue({
          hookName: webhookData.hookName,
          entityType: webhookData.entityType,
          triggerEvent: webhookData.triggerEvent,
          targetUrl: webhookData.targetUrl,
        })
      } else {
        // Create mode: reset form
        form.resetFields()
      }
    }
  }, [open, webhookData, webhookId, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      const hookId = webhookId || `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      // Create or update WebhookData
      const webhookDataToSave: WebhookData = {
        hookId: hookId,
        hookName: values.hookName,
        entityType: values.entityType,
        triggerEvent: values.triggerEvent,
        targetUrl: values.targetUrl,
        isActive: webhookData?.isActive !== false, // Preserve existing state or default to true
        createdAt: webhookData?.createdAt || new Date().toISOString(),
        lastTriggered: webhookData?.lastTriggered,
      }

      // Format as snapshotData
      const snapshotData = formatWebhookToSnapshotData(webhookDataToSave)

      // Create JSON Patch
      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: snapshotData,
        },
      ])

      // Commit the webhook entity
      await batchCommit({
        slugs: [hookId],
        branch: currentBranch,
        jsonPatch,
        message: webhookId 
          ? `Update webhook: ${values.hookName}`
          : `Create webhook: ${values.hookName}`,
      }).unwrap()

      message.success(
        webhookId
          ? `Webhook "${values.hookName}" updated successfully`
          : `Webhook "${values.hookName}" created successfully`
      )
      form.resetFields()
      onSuccess?.()
      onCancel()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save webhook')
    }
  }

  return (
    <Modal
      title={
        <Space>
          <Webhook size={18} />
          <Text strong style={{ fontSize: '16px' }}>
            {webhookId ? 'Edit Webhook' : 'Create Webhook'}
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
          icon={<Save size={16} />}
          onClick={handleSubmit}
          loading={isCommitting}
        >
          {webhookId ? 'Update' : 'Create'}
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
              Hook Name
            </Text>
          }
          name="hookName"
          rules={[
            { required: true, message: 'Please enter a hook name' },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: 'Hook name can only contain letters, numbers, underscores, and hyphens',
            },
          ]}
        >
          <Input
            placeholder="e.g., production-deploy-notification"
            prefix={<Webhook size={14} style={{ color: colorTextSecondary }} />}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              Entity Type
            </Text>
          }
          name="entityType"
          rules={[{ required: true, message: 'Please select an entity type' }]}
        >
          <Select
            placeholder="Select entity type"
            options={availableEntityTypes.map((type) => ({
              label: type,
              value: type,
            }))}
          />
        </Form.Item>

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              Trigger Event
            </Text>
          }
          name="triggerEvent"
          rules={[{ required: true, message: 'Please select a trigger event' }]}
        >
          <Select
            placeholder="Select trigger event"
            options={[
              {
                label: 'DEPLOY',
                value: 'DEPLOY',
              },
              {
                label: 'MERGE',
                value: 'MERGE',
              },
              {
                label: 'COMMIT',
                value: 'COMMIT',
              },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={
            <Text style={{ color: colorText, fontWeight: 500 }}>
              Target URL
            </Text>
          }
          name="targetUrl"
          rules={[
            { required: true, message: 'Please enter a target URL' },
            {
              type: 'url',
              message: 'Please enter a valid URL',
            },
          ]}
        >
          <Input
            placeholder="e.g., https://api.example.com/webhook"
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
            The webhook will be triggered when the selected event occurs for entities of the
            specified type. The target URL will receive a POST request with event details.
            Changes will be committed to branch "{currentBranch}".
          </Text>
        </div>
      </Form>
    </Modal>
  )
}
