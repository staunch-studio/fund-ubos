import { useState, useMemo } from 'react'
import { Table, Select, Space, Tag, theme, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { GitBranch, Plus, Edit, Trash2 } from 'lucide-react'
import { useGetBranchStatusQuery, useGetBranchesQuery } from '../store/ubosApi'
import type { EntityStatus } from '../types/ubos'
import { buildUbosUri } from '../utils/useUbosUri'

const { Text } = Typography

interface BranchStatusViewerProps {
  currentBranch: string
  onEntitySelect?: (uri: string) => void
}

export function BranchStatusViewer({ currentBranch, onEntitySelect }: BranchStatusViewerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer, colorSuccess, colorError, colorWarning },
  } = theme.useToken()

  const [baseBranch, setBaseBranch] = useState('master')

  // Fetch branches
  const { data: branches = [], isLoading: isLoadingBranches } = useGetBranchesQuery()

  // Fetch branch status diff
  const {
    data: statusData,
    isLoading: isLoadingStatus,
    error,
  } = useGetBranchStatusQuery(
    {
      baseBranch,
      currentBranch,
    },
    {
      skip: !baseBranch || !currentBranch,
    }
  )

  const handleRowClick = (record: EntityStatus) => {
    if (onEntitySelect) {
      const uri = buildUbosUri(record.entityType, record.slug, currentBranch)
      onEntitySelect(uri)
    }
  }

  const getStatusTag = (status: EntityStatus['status']) => {
    switch (status) {
      case 'NEW':
        return (
          <Tag
            icon={<Plus size={12} />}
            color="success"
            style={{
              margin: 0,
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            NEW
          </Tag>
        )
      case 'MODIFIED':
        return (
          <Tag
            icon={<Edit size={12} />}
            color="processing"
            style={{
              margin: 0,
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            MODIFIED
          </Tag>
        )
      case 'DELETED':
        return (
          <Tag
            icon={<Trash2 size={12} />}
            color="error"
            style={{
              margin: 0,
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            DELETED
          </Tag>
        )
      default:
        return null
    }
  }

  const columns: ColumnsType<EntityStatus> = useMemo(
    () => [
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: EntityStatus['status']) => getStatusTag(status),
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
        width: 120,
        render: (type: string) => (
          <Tag
            color="blue"
            style={{
              margin: 0,
              borderRadius: 4,
              border: `1px solid rgba(74, 158, 255, 0.3)`,
              background: 'rgba(74, 158, 255, 0.1)',
              color: colorPrimary,
              fontWeight: 500,
            }}
          >
            {type}
          </Tag>
        ),
      },
      {
        title: 'Base Commit',
        dataIndex: 'baseCommitId',
        key: 'baseCommitId',
        width: 120,
        render: (commitId?: number) => (
          <Text style={{ color: colorTextSecondary, fontSize: '12px', fontFamily: 'monospace' }}>
            {commitId ? `#${commitId}` : '-'}
          </Text>
        ),
      },
      {
        title: 'Current Commit',
        dataIndex: 'currentCommitId',
        key: 'currentCommitId',
        width: 120,
        render: (commitId?: number) => (
          <Text style={{ color: colorTextSecondary, fontSize: '12px', fontFamily: 'monospace' }}>
            {commitId ? `#${commitId}` : '-'}
          </Text>
        ),
      },
    ],
    [colorText, colorTextSecondary, colorPrimary]
  )

  const branchNames = useMemo(() => branches.map((b) => b.branchName), [branches])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colorBgContainer }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${colorBorder}`,
          background: colorBgContainer,
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space>
            <GitBranch size={18} color={colorPrimary} />
            <Text strong style={{ fontSize: '16px', color: colorText }}>
              Branch Status
            </Text>
          </Space>
          <Space>
            <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>Base Branch:</Text>
            <Select
              value={baseBranch}
              onChange={setBaseBranch}
              loading={isLoadingBranches}
              style={{ width: 160 }}
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
            <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>Current Branch:</Text>
            <Select
              value={currentBranch}
              disabled
              style={{ width: 160 }}
              options={[{ label: currentBranch, value: currentBranch }]}
            />
          </Space>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {error && (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: '#F85149',
            }}
          >
            <Text type="danger">Error loading branch status: {JSON.stringify(error)}</Text>
          </div>
        )}
        {!error && (
          <Table
            columns={columns}
            dataSource={statusData?.entities || []}
            loading={isLoadingStatus}
            rowKey={(record) => `${record.slug}-${record.entityType}`}
            pagination={{
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => (
                <Text style={{ color: colorTextSecondary }}>
                  Total <Text strong style={{ color: colorText }}>{total}</Text> changes
                </Text>
              ),
            }}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: {
                cursor: 'pointer',
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = 'rgba(74, 158, 255, 0.05)'
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = 'transparent'
              },
            })}
            size="middle"
          />
        )}
      </div>
    </div>
  )
}


