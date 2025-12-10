import { useState, useMemo } from 'react'
import { Table, Button, Space, Tag, Typography, theme, Popconfirm, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Webhook, Plus, Edit, Trash2, Calendar, ExternalLink } from 'lucide-react'
import { useGetEntitiesQuery, useBatchCommitMutation } from '../store/ubosApi'
import { WebhookEditModal } from './WebhookEditModal'
import type { EntityInstance } from '../types/ubos'
import { formatWebhookToSnapshotData, entityToWebhook, type WebhookData } from '../utils/entityHelpers'

const { Text } = Typography

interface WebhookManagerProps {
  availableEntityTypes?: string[]
  currentBranch: string
}

export function WebhookManager({ 
  availableEntityTypes = ['LOGIC', 'VIEW', 'DATA', 'CONFIG', 'UserProfile', 'Product', 'Order'],
  currentBranch,
}: WebhookManagerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer, colorError },
  } = theme.useToken()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null)
  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()

  // Fetch all WEBHOOK entities
  const {
    data: webhookEntities = [],
    isLoading: isLoadingWebhooks,
    refetch: refetchWebhooks,
  } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'WEBHOOK',
  })

  // For simplicity, we'll use entity metadata for display
  // In production, you might want to fetch snapshots on-demand or implement pagination
  const finalWebhooks = useMemo(() => {
    return webhookEntities.map((entity) => {
      const partial = entityToWebhook(entity)
      return {
        entity,
        data: {
          hookId: partial.hookId || entity.slug,
          hookName: entity.slug, // Use slug as name for now
          entityType: '', // Will be loaded from snapshot when needed
          triggerEvent: 'COMMIT' as const,
          targetUrl: '',
          isActive: true,
          createdAt: partial.createdAt || entity.createdAt,
        } as WebhookData,
      }
    })
  }, [webhookEntities])

  const handleDelete = async (hookId: string) => {
    try {
      const webhookData = finalWebhooks.find((w) => w.data.hookId === hookId)?.data
      if (!webhookData) {
        message.error('Webhook data not found')
        return
      }

      // Delete by setting isActive to false
      const updatedData: WebhookData = {
        ...webhookData,
        isActive: false,
      }

      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: formatWebhookToSnapshotData(updatedData),
        },
      ])

      await batchCommit({
        slugs: [hookId],
        branch: currentBranch,
        jsonPatch,
        message: `Delete webhook ${webhookData.hookName}`,
      }).unwrap()

      message.success('Webhook deleted successfully')
      refetchWebhooks()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to delete webhook')
    }
  }

  const handleCreate = () => {
    setEditingWebhookId(null)
    setEditModalOpen(true)
  }

  const handleEdit = (webhookId: string) => {
    setEditingWebhookId(webhookId)
    setEditModalOpen(true)
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

  const columns: ColumnsType<{ entity: EntityInstance; data: WebhookData }> = [
    {
      title: 'Hook Name',
      key: 'hookName',
      render: (_, record) => (
        <Space>
          <Webhook size={16} color={colorPrimary} />
          <Text style={{ fontWeight: 500, color: colorText }}>{record.data.hookName || record.data.hookId}</Text>
        </Space>
      ),
    },
    {
      title: 'Entity Type',
      key: 'entityType',
      width: 120,
      render: (_, record) => (
        <Tag
          style={{
            margin: 0,
            borderRadius: 4,
            border: `1px solid ${colorBorder}`,
            background: 'rgba(74, 158, 255, 0.1)',
            color: colorText,
          }}
        >
          {record.data.entityType}
        </Tag>
      ),
    },
    {
      title: 'Trigger Event',
      key: 'triggerEvent',
      width: 120,
      render: (_, record) => (
        <Tag color={getTriggerEventColor(record.data.triggerEvent)} style={{ margin: 0 }}>
          {record.data.triggerEvent}
        </Tag>
      ),
    },
    {
      title: 'Target URL',
      key: 'targetUrl',
      ellipsis: true,
      render: (_, record) => (
        <Space size="small">
          <ExternalLink size={14} color={colorTextSecondary} />
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: colorTextSecondary,
            }}
            ellipsis={{ tooltip: record.data.targetUrl }}
          >
            {record.data.targetUrl}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Last Triggered',
      key: 'lastTriggered',
      width: 180,
      render: (_, record) =>
        record.data.lastTriggered ? (
          <Space size="small">
            <Calendar size={14} color={colorTextSecondary} />
            <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
              {new Date(record.data.lastTriggered).toLocaleString()}
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
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<Edit size={14} />}
            onClick={() => handleEdit(record.data.hookId)}
            style={{ padding: '0 8px' }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete webhook"
            description={`Are you sure you want to delete "${record.data.hookName}"?`}
            onConfirm={() => handleDelete(record.data.hookId)}
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
              loading={isCommitting}
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
            ({finalWebhooks.length} webhooks)
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
        {finalWebhooks.length === 0 && !isLoadingWebhooks ? (
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
            dataSource={finalWebhooks}
            loading={isLoadingWebhooks}
            rowKey={(record) => record.entity.id}
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
          setEditingWebhookId(null)
        }}
        onSuccess={handleModalSuccess}
        webhookId={editingWebhookId}
        webhookData={editingWebhookId ? finalWebhooks.find((w) => w.data.hookId === editingWebhookId)?.data : null}
        currentBranch={currentBranch}
        availableEntityTypes={availableEntityTypes}
      />
    </div>
  )
}
