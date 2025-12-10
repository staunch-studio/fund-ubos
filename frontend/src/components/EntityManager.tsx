import { useState, useMemo } from 'react'
import { Table, Select, Button, Input, Space, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useGetEntitiesQuery, useBatchCommitMutation } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'
import { SendOutlined } from '@ant-design/icons'

const { Search } = Input

interface EntityManagerProps {
  selectedEntity: EntityInstance | null
  onRowSelect: (entity: EntityInstance | null) => void
  currentBranch?: string
  onBranchChange?: (branch: string) => void
  editedSnapshotData?: Record<string, string>
}

export function EntityManager({
  selectedEntity,
  onRowSelect,
  currentBranch: externalBranch,
  onBranchChange: externalBranchChange,
  editedSnapshotData = {},
}: EntityManagerProps) {
  const [internalBranch, setInternalBranch] = useState('master')
  const currentBranch = externalBranch ?? internalBranch
  const setCurrentBranch = externalBranchChange ?? setInternalBranch
  const [searchText, setSearchText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // RTK Query hooks
  const {
    data: entities = [],
    isLoading,
    error,
  } = useGetEntitiesQuery({
    branch: currentBranch,
    search: searchText || undefined,
  })

  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()

  // Table columns
  const columns: ColumnsType<EntityInstance> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 200,
        render: (text: string) => (
          <span className="font-mono text-xs">{text}</span>
        ),
      },
      {
        title: 'Slug',
        dataIndex: 'slug',
        key: 'slug',
        render: (text: string) => <span className="font-medium">{text}</span>,
      },
      {
        title: 'Type',
        dataIndex: 'entityType',
        key: 'entityType',
        render: (type: string) => (
          <Tag color="blue">{type}</Tag>
        ),
      },
      {
        title: 'Created At',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (date: string) =>
          date ? new Date(date).toLocaleString() : '-',
      },
    ],
    []
  )

  // Handle row selection
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys)
    },
    onSelect: (record: EntityInstance, selected: boolean) => {
      if (selected) {
        onRowSelect(record)
      } else if (selectedEntity?.id === record.id) {
        onRowSelect(null)
      }
    },
  }

  // Handle batch commit
  const handleBatchCommit = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one entity')
      return
    }

    try {
      const selectedEntities = entities.filter((e) =>
        selectedRowKeys.includes(e.id)
      )
      const selectedSlugs = selectedEntities.map((e) => e.slug)

      // Check if any entities have edited data
      const hasEditedData = selectedSlugs.some(
        (slug) => editedSnapshotData[slug]
      )

      if (!hasEditedData) {
        message.warning(
          'No changes detected. Please edit entity data before committing.'
        )
        return
      }

      // Build JSON Patch for all selected entities
      // For each entity, create a replace operation if it has edited data
      const patchOperations = selectedSlugs
        .filter((slug) => editedSnapshotData[slug])
        .map((slug) => ({
          op: 'replace' as const,
          path: `/snapshotData`,
          value: editedSnapshotData[slug],
        }))

      const jsonPatch = JSON.stringify(patchOperations)

      const result = await batchCommit({
        slugs: selectedSlugs,
        branch: currentBranch,
        jsonPatch,
        message: `Batch commit for ${selectedSlugs.length} entities`,
      }).unwrap()

      message.success(
        `Successfully committed ${result.commitIds.length} changes`
      )
      setSelectedRowKeys([])
      // RTK Query will automatically refetch entities due to invalidatesTags
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to commit changes')
    }
  }

  // Handle search
  const handleSearch = (value: string) => {
    setSearchText(value)
  }

  // Branch options
  const branchOptions = [
    { value: 'master', label: 'Master' },
    { value: 'beijing', label: 'Beijing' },
    { value: 'shanghai', label: 'Shanghai' },
    { value: 'development', label: 'Development' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-border p-3 bg-card">
        <Space className="w-full" direction="vertical" size="small">
          <Space className="w-full justify-between">
            <Space>
              <Select
                value={currentBranch}
                onChange={setCurrentBranch}
                style={{ width: 150 }}
                options={branchOptions}
              />
              <Search
                placeholder="Search entities..."
                allowClear
                onSearch={handleSearch}
                style={{ width: 300 }}
                enterButton
              />
            </Space>
            {selectedRowKeys.length > 0 && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleBatchCommit}
                loading={isCommitting}
              >
                Batch Commit ({selectedRowKeys.length})
              </Button>
            )}
          </Space>
        </Space>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4 text-destructive">
            Error loading entities: {JSON.stringify(error)}
          </div>
        )}
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={entities}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} entities`,
          }}
          onRow={(record) => ({
            onClick: () => {
              onRowSelect(record)
              setSelectedRowKeys([record.id])
            },
            className:
              selectedEntity?.id === record.id ? 'bg-primary/10' : '',
          })}
          scroll={{ y: 'calc(100vh - 200px)' }}
        />
      </div>
    </div>
  )
}

