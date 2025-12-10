import { useState } from 'react'
import { Table, Button, Space, Tag, Typography, theme, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Server, Plus, Edit, GitBranch, Hash, Calendar, FileText } from 'lucide-react'
import { useGetEnvironmentsQuery } from '../store/ubosApi'
import { EnvironmentEditModal } from './EnvironmentEditModal'
import type { Environment } from '../types/ubos'

const { Text } = Typography

export function EnvironmentManager() {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null)

  // Fetch environments
  const {
    data: environments = [],
    isLoading: isLoadingEnvironments,
    refetch: refetchEnvironments,
  } = useGetEnvironmentsQuery()

  const handleCreate = () => {
    setEditingEnvironment(null)
    setEditModalOpen(true)
  }

  const handleEdit = (environment: Environment) => {
    setEditingEnvironment(environment)
    setEditModalOpen(true)
  }

  const handleModalSuccess = () => {
    refetchEnvironments()
  }

  const columns: ColumnsType<Environment> = [
    {
      title: 'Environment Name',
      dataIndex: 'envName',
      key: 'envName',
      render: (name: string) => (
        <Space>
          <Server size={16} color={colorPrimary} />
          <Text style={{ fontWeight: 500, color: colorText }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Mapped Branch',
      dataIndex: 'mappedBranch',
      key: 'mappedBranch',
      width: 150,
      render: (branch: string) => (
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
            {branch}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Mapped Commit ID',
      dataIndex: 'mappedCommitId',
      key: 'mappedCommitId',
      width: 150,
      render: (commitId: number | null | undefined) =>
        commitId ? (
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
              #{commitId}
            </Text>
          </Space>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) =>
        desc ? (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{desc}</Text>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
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
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_, record: Environment) => (
        <Button
          type="link"
          size="small"
          icon={<Edit size={14} />}
          onClick={() => handleEdit(record)}
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
            ({environments.length} environments)
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
        {environments.length === 0 && !isLoadingEnvironments ? (
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
            dataSource={environments}
            loading={isLoadingEnvironments}
            rowKey="envName"
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
          setEditingEnvironment(null)
        }}
        onSuccess={handleModalSuccess}
        environment={editingEnvironment}
      />
    </div>
  )
}

