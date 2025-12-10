import { useState, useMemo } from 'react'
import { Table, Button, Space, Tag, Typography, theme } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Server, Plus, Edit, GitBranch, Hash, Calendar } from 'lucide-react'
import { useGetEntitiesQuery } from '../store/ubosApi'
import { EnvironmentEditModal } from './EnvironmentEditModal'
import type { EntityInstance } from '../types/ubos'
import { entityToEnvironment, type EnvironmentData } from '../utils/entityHelpers'

const { Text } = Typography

interface EnvironmentManagerProps {
  currentBranch: string
}

export function EnvironmentManager({ currentBranch }: EnvironmentManagerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<string | null>(null)

  // Fetch all ENVIRONMENT entities
  const {
    data: environmentEntities = [],
    isLoading: isLoadingEnvironments,
    refetch: refetchEnvironments,
  } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'ENVIRONMENT',
  })

  // Convert entities to enriched environment data
  const enrichedEnvironments = useMemo(() => {
    return environmentEntities.map((entity) => {
      const partial = entityToEnvironment(entity)
      return {
        entity,
        data: {
          envName: partial.envName || entity.slug,
          mappedBranch: 'master', // Default - will be loaded from snapshot when needed
          mappedCommitId: null,
          description: undefined,
          updatedAt: partial.createdAt || entity.createdAt,
        } as EnvironmentData,
      }
    })
  }, [environmentEntities])

  const handleCreate = () => {
    setEditingEnvironmentId(null)
    setEditModalOpen(true)
  }

  const handleEdit = (envName: string) => {
    setEditingEnvironmentId(envName)
    setEditModalOpen(true)
  }

  const handleModalSuccess = () => {
    refetchEnvironments()
  }

  const columns: ColumnsType<{ entity: EntityInstance; data: EnvironmentData }> = [
    {
      title: 'Environment Name',
      key: 'envName',
      render: (_, record) => (
        <Space>
          <Server size={16} color={colorPrimary} />
          <Text style={{ fontWeight: 500, color: colorText }}>{record.data.envName}</Text>
        </Space>
      ),
    },
    {
      title: 'Mapped Branch',
      key: 'mappedBranch',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <GitBranch size={14} color={colorTextSecondary} />
          <Tag
            style={{
              margin: 0,
              borderRadius: 4,
              border: `1px solid ${colorBorder}`,
              background: 'rgba(74, 158, 255, 0.1)',
              color: colorText,
            }}
          >
            {record.data.mappedBranch}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Mapped Commit ID',
      key: 'mappedCommitId',
      width: 150,
      render: (_, record) =>
        record.data.mappedCommitId ? (
          <Space size="small">
            <Hash size={14} color={colorTextSecondary} />
            <Text
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: colorPrimary,
                fontWeight: 500,
              }}
            >
              #{record.data.mappedCommitId}
            </Text>
          </Space>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
    {
      title: 'Description',
      key: 'description',
      ellipsis: true,
      render: (_, record) =>
        record.data.description ? (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{record.data.description}</Text>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
    {
      title: 'Last Updated',
      key: 'updatedAt',
      width: 180,
      render: (_, record) =>
        record.data.updatedAt ? (
          <Space size="small">
            <Calendar size={14} color={colorTextSecondary} />
            <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
              {new Date(record.data.updatedAt).toLocaleString()}
            </Text>
          </Space>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<Edit size={14} />}
          onClick={() => handleEdit(record.data.envName)}
          style={{ padding: '0 8px' }}
        >
          Edit
        </Button>
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
          <Server size={18} color={colorPrimary} />
          <Text strong style={{ fontSize: '16px', color: colorText }}>
            Environment Manager
          </Text>
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            ({enrichedEnvironments.length} environments)
          </Text>
        </Space>
        <Space>
          <Button
            size="small"
            onClick={() => refetchEnvironments()}
            loading={isLoadingEnvironments}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={handleCreate}
          >
            New Environment
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {enrichedEnvironments.length === 0 && !isLoadingEnvironments ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: colorTextSecondary,
            }}
          >
            <Server size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <Text style={{ fontSize: '14px' }}>No environments configured</Text>
            <div style={{ marginTop: '16px' }}>
              <Button type="primary" icon={<Plus size={14} />} onClick={handleCreate}>
                Create First Environment
              </Button>
            </div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={enrichedEnvironments}
            loading={isLoadingEnvironments}
            rowKey={(record) => record.entity.id}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} environments`,
            }}
            size="small"
            style={{ background: colorBgContainer }}
          />
        )}
      </div>

      {/* Edit Modal */}
      <EnvironmentEditModal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingEnvironmentId(null)
        }}
        onSuccess={handleModalSuccess}
        environmentId={editingEnvironmentId}
        environmentData={editingEnvironmentId ? enrichedEnvironments.find((e) => e.data.envName === editingEnvironmentId)?.data : null}
        currentBranch={currentBranch}
      />
    </div>
  )
}

