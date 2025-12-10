import { useState } from 'react'
import { Table, Button, Space, Tag, Typography, theme, Badge } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileCode, Edit, Calendar, GitBranch } from 'lucide-react'
import { SchemaEditModal } from './SchemaEditModal'

const { Text } = Typography

interface SchemaManagerProps {
  availableEntityTypes?: string[]
  currentBranch: string
}

interface SchemaEntityType {
  entityType: string
  hasSchema?: boolean // Whether a schema exists for this type
  lastUpdated?: string // Last commit time if schema exists
}

export function SchemaManager({ 
  availableEntityTypes = ['LOGIC', 'VIEW', 'DATA', 'CONFIG', 'UserProfile', 'Product', 'Order'],
  currentBranch,
}: SchemaManagerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingEntityType, setEditingEntityType] = useState<string | null>(null)

  const handleEdit = (entityType: string) => {
    setEditingEntityType(entityType)
    setEditModalOpen(true)
  }

  const handleModalSuccess = () => {
    // Schema will be automatically refreshed via RTK Query cache invalidation
    setEditModalOpen(false)
    setEditingEntityType(null)
  }

  const columns: ColumnsType<SchemaEntityType> = [
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (type: string) => (
        <Space>
          <FileCode size={16} color={colorPrimary} />
          <Text style={{ fontWeight: 500, color: colorText, fontFamily: 'monospace' }}>
            {type}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Branch',
      key: 'branch',
      width: 120,
      render: () => (
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
            {currentBranch}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Schema Status',
      key: 'status',
      width: 150,
      render: (_, record: SchemaEntityType) => {
        // Note: We can't know if schema exists without fetching it
        // For now, show "Available" - actual status will be shown in the modal
        return (
          <Tag
            color="default"
            style={{ margin: 0 }}
          >
            Available
          </Tag>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_, record: SchemaEntityType) => (
        <Button
          type="link"
          size="small"
          icon={<Edit size={14} />}
          onClick={() => handleEdit(record.entityType)}
          style={{ padding: '0 8px' }}
        >
          Edit Schema
        </Button>
      ),
    },
  ]

  // Create data source from available entity types
  const dataSource: SchemaEntityType[] = availableEntityTypes.map((type) => ({
    entityType: type,
  }))

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
          <FileCode size={18} color={colorPrimary} />
          <Text strong style={{ fontSize: '16px', color: colorText }}>
            Schema Manager
          </Text>
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            ({dataSource.length} entity types)
          </Text>
          <Space size="small" style={{ marginLeft: '16px' }}>
            <GitBranch size={14} color={colorTextSecondary} />
            <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
              Branch: {currentBranch}
            </Text>
          </Space>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="entityType"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} entity types`,
          }}
          size="small"
          style={{ background: colorBgContainer }}
        />
      </div>

      {/* Edit Modal */}
      <SchemaEditModal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingEntityType(null)
        }}
        onSuccess={handleModalSuccess}
        entityType={editingEntityType}
        currentBranch={currentBranch}
      />
    </div>
  )
}

