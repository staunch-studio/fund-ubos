import { useState } from 'react'
import { Table, Button, Space, Tag, Typography, theme, Popconfirm, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Webhook, Plus, Edit, Trash2, Calendar, ExternalLink } from 'lucide-react'
import { useGetWebhooksQuery, useDeleteWebhookMutation } from '../store/ubosApi'
import { WebhookEditModal } from './WebhookEditModal'
import type { WebhookConfig } from '../types/ubos'

const { Text } = Typography

interface WebhookManagerProps {
  availableEntityTypes?: string[]
}

export function WebhookManager({ availableEntityTypes = ['LOGIC', 'VIEW', 'DATA', 'CONFIG', 'UserProfile', 'Product', 'Order'] }: WebhookManagerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer, colorError },
  } = theme.useToken()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null)

  // Fetch webhooks
  const {
    data: webhooks = [],
    isLoading: isLoadingWebhooks,
    refetch: refetchWebhooks,
  } = useGetWebhooksQuery()

  const [deleteWebhook, { isLoading: isDeleting }] = useDeleteWebhookMutation()

  const handleCreate = () => {
    setEditingWebhook(null)
    setEditModalOpen(true)
  }

  const handleEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook)
    setEditModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhook(id).unwrap()
      message.success('Webhook deleted successfully')
      refetchWebhooks()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to delete webhook')
    }
  }

  const handleModalSuccess = () => {
    refetchWebhooks()
  }

  const getTriggerEventColor = (event: string) => {
    switch (event) {
      case 'DEPLOY':
        return 'blue'
      case 'MERGE':
        return 'green'
      case 'COMMIT':
        return 'orange'
      default:
        return 'default'
    }
  }

  const columns: ColumnsType<WebhookConfig> = [
    {
      title: 'Hook Name',
      dataIndex: 'hookName',
      key: 'hookName',
      render: (name: string) => (
        <Space>
          <Webhook size={16} color={colorPrimary} />
          <Text style={{ fontWeight: 500, color: colorText }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 120,
      render: (type: string) => (
        <Tag
          style={{
            margin: 0,
            borderRadius: 4,
            border: `1px solid ${colorBorder}`,
            background: 'rgba(74, 158, 255, 0.1)',
            color: colorText,
          }}
        >
          {type}
        </Tag>
      ),
    },
    {
      title: 'Trigger Event',
      dataIndex: 'triggerEvent',
      key: 'triggerEvent',
      width: 120,
      render: (event: string) => (
        <Tag color={getTriggerEventColor(event)} style={{ margin: 0 }}>
          {event}
        </Tag>
      ),
    },
    {
      title: 'Target URL',
      dataIndex: 'targetUrl',
      key: 'targetUrl',
      ellipsis: true,
      render: (url: string) => (
        <Space size="small">
          <ExternalLink size={14} color={colorTextSecondary} />
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: colorTextSecondary,
            }}
            ellipsis={{ tooltip: url }}
          >
            {url}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Last Triggered',
      dataIndex: 'lastTriggered',
      key: 'lastTriggered',
      width: 180,
      render: (time: string) =>
        time ? (
          <Space size="small">
            <Calendar size={14} color={colorTextSecondary} />
            <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
              {new Date(time).toLocaleString()}
            </Text>
          </Space>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>Never</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_, record: WebhookConfig) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<Edit size={14} />}
            onClick={() => handleEdit(record)}
            style={{ padding: '0 8px' }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete webhook"
            description={`Are you sure you want to delete "${record.hookName}"?`}
            onConfirm={() => record.id && handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              size="small"
              icon={<Trash2 size={14} />}
              danger
              style={{ padding: '0 8px' }}
              loading={isDeleting}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colorBgContainer }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${colorBorder}`,
          background: colorBgContainer,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Webhook size={18} color={colorPrimary} />
          <Text strong style={{ fontSize: '16px', color: colorText }}>
            Webhook Manager
          </Text>
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            ({webhooks.length} webhooks)
          </Text>
        </Space>
        <Space>
          <Button
            size="small"
            onClick={() => refetchWebhooks()}
            loading={isLoadingWebhooks}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={handleCreate}
          >
            New Webhook
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {webhooks.length === 0 && !isLoadingWebhooks ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: colorTextSecondary,
            }}
          >
            <Webhook size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <Text style={{ fontSize: '14px' }}>No webhooks configured</Text>
            <div style={{ marginTop: '16px' }}>
              <Button type="primary" icon={<Plus size={14} />} onClick={handleCreate}>
                Create First Webhook
              </Button>
            </div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={webhooks}
            loading={isLoadingWebhooks}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} webhooks`,
            }}
            size="small"
            style={{ background: colorBgContainer }}
          />
        )}
      </div>

      {/* Edit Modal */}
      <WebhookEditModal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingWebhook(null)
        }}
        onSuccess={handleModalSuccess}
        webhook={editingWebhook}
        availableEntityTypes={availableEntityTypes}
      />
    </div>
  )
}

