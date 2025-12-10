import { useState, useMemo } from 'react'
import { Table, Button, Space, Tag, Typography, theme, Popconfirm, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Key, Plus, Trash2, CheckCircle, XCircle, Calendar } from 'lucide-react'
import { useGetEntitiesQuery, useBatchCommitMutation } from '../store/ubosApi'
import { APIKeyGenerateModal } from './APIKeyGenerateModal'
import type { EntityInstance } from '../types/ubos'
import { formatSecurityKeyToSnapshotData, entityToSecurityKey, type SecurityKeyData } from '../utils/entityHelpers'

const { Text } = Typography

interface APIKeyManagerProps {
  currentBranch: string
}

export function APIKeyManager({ currentBranch }: APIKeyManagerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer, colorSuccess, colorError },
  } = theme.useToken()

  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()

  // Fetch all SECURITY_KEY entities
  const {
    data: keyEntities = [],
    isLoading: isLoadingKeys,
    refetch: refetchKeys,
  } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'SECURITY_KEY',
  })

  // For simplicity, we'll use entity metadata for display
  // In production, you might want to fetch snapshots on-demand when a row is expanded or clicked
  // For now, we'll show basic info from entity metadata
  const enrichedKeys = useMemo(() => {
    return keyEntities.map((entity) => {
      // Default data from entity metadata
      const partial = entityToSecurityKey(entity)
      return {
        entity,
        data: {
          keyId: partial.keyId || entity.slug,
          scope: 'read', // Default - will be loaded from snapshot when needed
          isActive: true, // Default - will be loaded from snapshot when needed
          createdAt: partial.createdAt || entity.createdAt,
        } as SecurityKeyData,
      }
    })
  }, [keyEntities])

  const handleRevoke = async (keyId: string) => {
    try {
      // Fetch current snapshot to get full data
      const entity = keyEntities.find((e) => e.slug === keyId)
      if (!entity) {
        message.error('Key entity not found')
        return
      }

      // For now, we'll create a basic update
      // In production, you should fetch the snapshot first to preserve all fields
      const updatedData: SecurityKeyData = {
        keyId: keyId,
        scope: 'read', // Default - should be fetched from snapshot
        isActive: false,
        createdAt: entity.createdAt,
      }

      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: formatSecurityKeyToSnapshotData(updatedData),
        },
      ])

      await batchCommit({
        slugs: [keyId],
        branch: currentBranch,
        jsonPatch,
        message: `Revoke API key ${keyId}`,
      }).unwrap()

      message.success('API Key revoked successfully')
      refetchKeys()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to revoke API key')
    }
  }

  const handleActivate = async (keyId: string) => {
    try {
      // Fetch current snapshot to get full data
      const entity = keyEntities.find((e) => e.slug === keyId)
      if (!entity) {
        message.error('Key entity not found')
        return
      }

      // For now, we'll create a basic update
      // In production, you should fetch the snapshot first to preserve all fields
      const updatedData: SecurityKeyData = {
        keyId: keyId,
        scope: 'read', // Default - should be fetched from snapshot
        isActive: true,
        createdAt: entity.createdAt,
      }

      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: formatSecurityKeyToSnapshotData(updatedData),
        },
      ])

      await batchCommit({
        slugs: [keyId],
        branch: currentBranch,
        jsonPatch,
        message: `Activate API key ${keyId}`,
      }).unwrap()

      message.success('API Key activated successfully')
      refetchKeys()
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to activate API key')
    }
  }

  const handleModalSuccess = () => {
    refetchKeys()
  }

  const columns: ColumnsType<{ entity: EntityInstance; data: SecurityKeyData }> = [
    {
      title: 'Key ID',
      key: 'keyId',
      render: (_, record) => (
        <Space>
          <Key size={16} color={colorPrimary} />
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              color: colorText,
              fontWeight: 500,
            }}
          >
            {record.data.keyId.substring(0, 8)}...
          </Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      key: 'description',
      ellipsis: true,
      render: (_, record) =>
        record.data.description ? (
          <Text style={{ color: colorText, fontSize: '13px' }}>{record.data.description}</Text>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px', fontStyle: 'italic' }}>
            No description
          </Text>
        ),
    },
    {
      title: 'Scope',
      key: 'scope',
      width: 120,
      render: (_, record) => (
        <Tag
          style={{
            margin: 0,
            borderRadius: 4,
            border: `1px solid ${colorBorder}`,
            background: 'rgba(74, 158, 255, 0.1)',
            color: colorText,
            textTransform: 'capitalize',
          }}
        >
          {record.data.scope}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'isActive',
      width: 100,
      render: (_, record) => (
        <Tag
          color={record.data.isActive ? 'success' : 'default'}
          icon={record.data.isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
          style={{ margin: 0 }}
        >
          {record.data.isActive ? 'Active' : 'Revoked'}
        </Tag>
      ),
    },
    {
      title: 'Created At',
      key: 'createdAt',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Calendar size={14} color={colorTextSecondary} />
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            {new Date(record.data.createdAt).toLocaleString()}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space size="small">
          {record.data.isActive ? (
            <Popconfirm
              title="Revoke API Key"
              description={`Are you sure you want to revoke this API key? It will no longer be usable.`}
              onConfirm={() => handleRevoke(record.data.keyId)}
              okText="Yes, revoke"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="link"
                size="small"
                icon={<XCircle size={14} />}
                danger
                style={{ padding: '0 8px' }}
                loading={isCommitting}
              >
                Revoke
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<CheckCircle size={14} />}
              onClick={() => handleActivate(record.data.keyId)}
              style={{ padding: '0 8px', color: colorSuccess }}
              loading={isCommitting}
            >
              Activate
            </Button>
          )}
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
          <Key size={18} color={colorPrimary} />
          <Text strong style={{ fontSize: '16px', color: colorText }}>
            API Key Manager
          </Text>
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            ({enrichedKeys.length} keys)
          </Text>
        </Space>
        <Space>
          <Button
            size="small"
            onClick={() => refetchKeys()}
            loading={isLoadingKeys}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setGenerateModalOpen(true)}
          >
            Generate New Key
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {enrichedKeys.length === 0 && !isLoadingKeys ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: colorTextSecondary,
            }}
          >
            <Key size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <Text style={{ fontSize: '14px' }}>No API keys configured</Text>
            <div style={{ marginTop: '16px' }}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setGenerateModalOpen(true)}>
                Generate First API Key
              </Button>
            </div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={enrichedKeys}
            loading={isLoadingKeys}
            rowKey={(record) => record.entity.id}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} API keys`,
            }}
            size="small"
            style={{ background: colorBgContainer }}
          />
        )}
      </div>

      {/* Generate Modal */}
      <APIKeyGenerateModal
        open={generateModalOpen}
        onCancel={() => setGenerateModalOpen(false)}
        onSuccess={handleModalSuccess}
        currentBranch={currentBranch}
        availableScopes={['read', 'write', 'admin']}
      />
    </div>
  )
}
