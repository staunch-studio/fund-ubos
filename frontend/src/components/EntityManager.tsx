import { useState, useMemo } from 'react'
import { Table, Button, Input, Space, Tag, message, theme, Typography, Badge, Breadcrumb } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import SplitPane from 'react-split-pane'
import { useGetEntitiesQuery, useBatchCommitMutation } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'
import { SendOutlined, SearchOutlined } from '@ant-design/icons'
import { buildUbosUri, parseUbosUri } from '../utils/useUbosUri'
import { Copy, CheckCircle2 } from 'lucide-react'
import { NamespaceTree } from './NamespaceTree'
import { getEntitiesInNamespace, getBreadcrumbItems } from '../utils/namespaceTree'

const { Text } = Typography
const { Search } = Input

interface EntityManagerProps {
  selectedEntityUri: string | null // Full UBOS URI string
  onRowSelect: (entity: EntityInstance | null) => void
  currentBranch?: string
  onBranchChange?: (branch: string) => void
  editedSnapshotData?: Record<string, string> // Key: URI, Value: snapshotData
  entityTypeFilter?: string
}

export function EntityManager({
  selectedEntityUri,
  onRowSelect,
  currentBranch: externalBranch,
  editedSnapshotData = {},
  entityTypeFilter,
}: EntityManagerProps) {
  const {
    token: {
      colorBgContainer,
      colorBgElevated,
      colorText,
      colorTextSecondary,
      colorBorder,
      colorPrimary,
      borderRadius,
    },
  } = theme.useToken()

  const [internalBranch] = useState('master')
  const currentBranch = externalBranch ?? internalBranch
  const [searchText, setSearchText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [copiedUri, setCopiedUri] = useState<string | null>(null)
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null)

  // RTK Query hooks
  const {
    data: allEntities = [],
    isLoading,
    error,
  } = useGetEntitiesQuery({
    branch: currentBranch,
    search: searchText || undefined,
    type: entityTypeFilter,
  })

  // Filter entities by selected namespace
  const entities = useMemo(() => {
    if (!selectedNamespace) {
      // Show root-level entities (those without dots)
      return allEntities.filter((e) => !e.slug.includes('.'))
    }
    return getEntitiesInNamespace(allEntities, selectedNamespace)
  }, [allEntities, selectedNamespace])

  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()

  // Table columns
  const columns: ColumnsType<EntityInstance> = useMemo(
    () => [
      {
        title: 'Slug',
        dataIndex: 'slug',
        key: 'slug',
        render: (text: string) => (
          <Text style={{ fontWeight: 500, color: colorText }}>{text}</Text>
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
              borderRadius: borderRadius,
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
        title: 'UBOS URI',
        key: 'ubosUri',
        width: 380,
        render: (_: any, record: EntityInstance) => {
          // Safely build URI with validation
          if (!record.entityType || !record.slug || !currentBranch) {
            return <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
          }
          const uri = buildUbosUri(record.entityType, record.slug, currentBranch)
          const isCopied = copiedUri === uri
          return (
            <Space
              style={{
                fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
                fontSize: '12px',
                color: colorTextSecondary,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: borderRadius,
                background: isCopied ? 'rgba(74, 158, 255, 0.1)' : 'transparent',
                border: isCopied ? `1px solid ${colorPrimary}` : '1px solid transparent',
                transition: 'all 0.2s',
              }}
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(uri)
                setCopiedUri(uri)
                message.success('URI copied', 1)
                setTimeout(() => setCopiedUri(null), 2000)
              }}
              title="Click to copy"
            >
              {isCopied ? <CheckCircle2 size={14} color={colorPrimary} /> : <Copy size={14} />}
              <Text
                style={{
                  color: isCopied ? colorPrimary : colorTextSecondary,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                {uri}
              </Text>
            </Space>
          )
        },
      },
      {
        title: 'Created At',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (date: string) => (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            {date ? new Date(date).toLocaleString() : '-'}
          </Text>
        ),
      },
    ],
    [currentBranch, copiedUri, colorText, colorTextSecondary, colorPrimary, borderRadius]
  )

  // Parse selectedEntityUri to find matching entity
  const selectedEntity = useMemo(() => {
    if (!selectedEntityUri) return null
    // Parse URI to extract slug and type
    try {
      const uriDetails = parseUbosUri(selectedEntityUri)
      if (!uriDetails) return null
      return entities.find(
        (e) => e.slug === uriDetails.slug && e.entityType === uriDetails.type
      ) || null
    } catch {
      return null
    }
  }, [selectedEntityUri, entities])

  // Handle row selection
  const rowSelection = {
    selectedRowKeys: selectedEntity ? [selectedEntity.id] : [],
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colorBgContainer }}>
      {/* Toolbar - Enhanced */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${colorBorder}`,
          background: `linear-gradient(180deg, ${colorBgElevated} 0%, ${colorBgContainer} 100%)`,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size="middle">
            <Search
              placeholder="Search entities by slug or type..."
              allowClear
              onSearch={handleSearch}
              style={{ width: 360 }}
              enterButton={<SearchOutlined />}
              size="middle"
            />
            {entities.length > 0 && (
              <Badge
                count={entities.length}
                style={{
                  backgroundColor: colorPrimary,
                }}
              >
                <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>
                  Entities
                </Text>
              </Badge>
            )}
          </Space>
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleBatchCommit}
              loading={isCommitting}
              style={{
                fontWeight: 500,
                boxShadow: `0 2px 8px rgba(74, 158, 255, 0.3)`,
              }}
            >
              Batch Commit ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
      </div>

      {/* Split Panel: Tree View + Entity List */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <SplitPane
          split="vertical"
          minSize={200}
          maxSize={600}
          defaultSize={300}
          style={{ position: 'relative' }}
        >
          {/* Left Pane: Tree View */}
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: colorBgContainer,
              borderRight: `1px solid ${colorBorder}`,
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${colorBorder}`,
                background: colorBgElevated,
              }}
            >
              <Text
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colorTextSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Namespace Tree
              </Text>
            </div>
            <NamespaceTree
              currentBranch={currentBranch}
              entityTypeFilter={entityTypeFilter}
              selectedNamespace={selectedNamespace || undefined}
              onNamespaceSelect={(namespace) => {
                setSelectedNamespace(namespace)
                onRowSelect(null)
                setSelectedRowKeys([])
              }}
              onEntitySelect={(entity) => {
                onRowSelect(entity)
                setSelectedRowKeys([entity.id])
              }}
            />
          </div>

          {/* Right Pane: Entity List */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colorBgContainer }}>
            {/* Breadcrumb Navigation */}
            {selectedNamespace && (
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${colorBorder}`,
                  background: colorBgElevated,
                }}
              >
                <Breadcrumb
                  items={[
                    {
                      title: (
                        <span
                          style={{ cursor: 'pointer', color: colorText }}
                          onClick={() => setSelectedNamespace(null)}
                        >
                          Root
                        </span>
                      ),
                    },
                    ...getBreadcrumbItems(selectedNamespace).map((item, index) => {
                      const items = getBreadcrumbItems(selectedNamespace)
                      const path = items.slice(0, index + 1).join('.')
                      return {
                        title: (
                          <span
                            style={{ cursor: 'pointer', color: colorText }}
                            onClick={() => setSelectedNamespace(path)}
                          >
                            {item}
                          </span>
                        ),
                      }
                    }),
                  ]}
                  separator=">"
                  style={{ fontSize: '13px' }}
                />
              </div>
            )}

            {/* Table - Enhanced */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {error && (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#F85149',
                  }}
                >
                  <Text type="danger">Error loading entities: {JSON.stringify(error)}</Text>
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
            showTotal: (total) => (
              <Text style={{ color: colorTextSecondary }}>
                Total <Text strong style={{ color: colorText }}>{total}</Text> entities
              </Text>
            ),
            style: { padding: '16px 20px' },
          }}
          onRow={(record) => ({
            onClick: () => {
              onRowSelect(record)
              setSelectedRowKeys([record.id])
            },
            style: {
              cursor: 'pointer',
              background:
                selectedEntity?.id === record.id
                  ? 'rgba(74, 158, 255, 0.1)'
                  : 'transparent',
              borderLeft:
                selectedEntity?.id === record.id
                  ? `3px solid ${colorPrimary}`
                  : '3px solid transparent',
            },
            onMouseEnter: (e) => {
              if (selectedEntity?.id !== record.id) {
                e.currentTarget.style.background = colorBgElevated
              }
            },
            onMouseLeave: (e) => {
              if (selectedEntity?.id !== record.id) {
                e.currentTarget.style.background = 'transparent'
              }
            },
          })}
                scroll={{ y: 'calc(100vh - 280px)' }}
                size="middle"
              />
            </div>
          </div>
        </SplitPane>
      </div>
    </div>
  )
}

