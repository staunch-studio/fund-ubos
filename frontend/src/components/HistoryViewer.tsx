import { useState, useMemo, useCallback } from 'react'
import { Table, Checkbox, Space, Tag, Typography, theme, Badge, Button, Modal, Input, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useGetHistoryQuery, useGetSnapshotByCommitQuery, useRevertMutation } from '../store/ubosApi'
import type { HistoryRecord, ResourceContextRequest } from '../types/ubos'
import { DiffViewer } from './DiffViewer'
import { GitCommit, User, Calendar, MessageSquare, RotateCcw } from 'lucide-react'

const { Text } = Typography

interface HistoryViewerProps {
  slug: string
  entityType: string
  branch: string
}

export function HistoryViewer({ slug, entityType, branch }: HistoryViewerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  // Use Set to store selected commit IDs for better performance
  const [selectedCommitIds, setSelectedCommitIds] = useState<Set<number>>(new Set())
  
  // Revert modal state
  const [revertModalOpen, setRevertModalOpen] = useState(false)
  const [revertCommitId, setRevertCommitId] = useState<number | null>(null)
  const [revertMessage, setRevertMessage] = useState('')
  const [revertAuthor, setRevertAuthor] = useState('')
  
  const [revert, { isLoading: isReverting }] = useRevertMutation()

  // Fetch history
  // Uses ResourceContextRequest DTO
  const {
    data: history = [],
    isLoading: isLoadingHistory,
    error: historyError,
  } = useGetHistoryQuery(
    {
      slug: slug,
      type: entityType,
      branch: branch,
    } as ResourceContextRequest,
    {
      skip: !slug || !entityType,
    }
  )

  // Sort history by commitId descending (newest first)
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => b.commitId - a.commitId)
  }, [history])

  // Get the two selected commit IDs for comparison (first two selected)
  const [commitIdA, commitIdB] = useMemo(() => {
    const ids = Array.from(selectedCommitIds)
    if (ids.length >= 2) {
      // Take first two selected (in selection order)
      return [ids[0], ids[1]]
    }
    return [null, null]
  }, [selectedCommitIds])

  // Fetch snapshots for comparison
  const {
    data: snapshotA,
    isLoading: isLoadingA,
    error: errorA,
  } = useGetSnapshotByCommitQuery(
    {
      slug: slug,
      type: entityType,
      branch: branch,
      commitId: commitIdA || 0,
    },
    {
      skip: !slug || !entityType || !commitIdA,
    }
  )

  const {
    data: snapshotB,
    isLoading: isLoadingB,
    error: errorB,
  } = useGetSnapshotByCommitQuery(
    {
      slug: slug,
      type: entityType,
      branch: branch,
      commitId: commitIdB || 0,
    },
    {
      skip: !slug || !entityType || !commitIdB,
    }
  )

  const handleCheckboxChange = useCallback((commitId: number, checked: boolean) => {
    setSelectedCommitIds((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        // Add to selection (max 2)
        if (newSet.size < 2) {
          newSet.add(commitId)
        } else {
          // Replace: remove first, add new
          const ids = Array.from(newSet)
          newSet.delete(ids[0])
          newSet.add(commitId)
        }
      } else {
        // Remove from selection
        newSet.delete(commitId)
      }
      return newSet
    })
  }, [])

  const isChecked = useCallback((commitId: number) => {
    return selectedCommitIds.has(commitId)
  }, [selectedCommitIds])

  const handleRevertClick = useCallback((commitId: number) => {
    setRevertCommitId(commitId)
    setRevertMessage(`Reverting state to commit #${commitId}`)
    setRevertAuthor('') // Reset author field
    setRevertModalOpen(true)
  }, [])

  const handleRevertConfirm = async () => {
    if (!slug || !entityType || !revertCommitId) {
      return
    }

    try {
      await revert({
        slug: slug,
        type: entityType, // Backend uses "type" not "entityType"
        branch: branch,
        commitId: revertCommitId,
        author: revertAuthor || undefined,
        message: revertMessage || undefined,
      }).unwrap()

      message.success(`Successfully reverted to commit #${revertCommitId}`)
      setRevertModalOpen(false)
      setRevertCommitId(null)
      setRevertMessage('')
      setRevertAuthor('')
      
      // Snapshot and history will automatically refresh via RTK Query cache invalidation
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to revert commit')
    }
  }

  const columns: ColumnsType<HistoryRecord> = useMemo(() => [
    {
      title: 'Select',
      key: 'select',
      width: 80,
      fixed: 'left' as const,
      render: (_, record: HistoryRecord) => {
        // ✅ Using Camel Case: record.commitId (NOT record.commit_id)
        const commitId = record.commitId;
        const checked = isChecked(commitId)
        const disabled = selectedCommitIds.size >= 2 && !checked
        const checkboxId = `history-checkbox-${commitId}`
        const checkboxName = `history-checkbox-${commitId}`
        
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              id={checkboxId}
              name={checkboxName}
              checked={checked}
              onChange={(e) => {
                e.stopPropagation()
                handleCheckboxChange(commitId, e.target.checked)
              }}
              onClick={(e) => {
                e.stopPropagation()
              }}
              disabled={disabled}
              data-commit-id={commitId}
            />
          </div>
        )
      },
    },
    {
      title: 'Commit ID',
      dataIndex: 'commitId',
      key: 'commitId',
      width: 120,
      render: (commitId: number) => (
        <Text
          style={{
            fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
            fontSize: '13px',
            color: colorPrimary,
            fontWeight: 500,
          }}
        >
          #{commitId}
        </Text>
      ),
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      render: (branch: string) => (
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
      ),
    },
    {
      title: 'Author',
      dataIndex: 'authorId',
      key: 'authorId',
      width: 150,
      render: (author: string) => (
        <Space size="small">
          <User size={14} color={colorTextSecondary} />
          <Text style={{ color: colorText, fontSize: '13px' }}>{author}</Text>
        </Space>
      ),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string) => (
        <Space size="small">
          <MessageSquare size={14} color={colorTextSecondary} />
          <Text style={{ color: colorText, fontSize: '13px' }}>{message || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (
        <Space size="small">
          <Calendar size={14} color={colorTextSecondary} />
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            {date ? new Date(date).toLocaleString() : '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right' as const,
      render: (_, record: HistoryRecord) => (
        <Button
          type="link"
          size="small"
          icon={<RotateCcw size={14} />}
          onClick={(e) => {
            e.stopPropagation()
            handleRevertClick(record.commitId)
          }}
          style={{
            color: colorPrimary,
            padding: '0 8px',
          }}
        >
          Revert
        </Button>
      ),
    },
  ], [isChecked, handleCheckboxChange, handleRevertClick, selectedCommitIds.size, colorPrimary, colorText, colorBorder, colorTextSecondary])

  if (!slug || !entityType) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: colorTextSecondary,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No resource selected</p>
          <p style={{ fontSize: '13px' }}>Select a resource to view its commit history</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* History Table */}
      <div style={{ flex: '0 0 auto', borderBottom: `1px solid ${colorBorder}` }}>
        <div
          style={{
            padding: '12px 16px',
            background: colorBgContainer,
            borderBottom: `1px solid ${colorBorder}`,
          }}
        >
          <Space>
            <GitCommit size={16} color={colorTextSecondary} />
            <Text style={{ fontWeight: 500, color: colorText, fontSize: '14px' }}>
              Commit History
            </Text>
            {history.length > 0 && (
              <Badge
                count={history.length}
                style={{
                  backgroundColor: colorPrimary,
                }}
              />
            )}
            {selectedCommitIds.size > 0 && (
              <Badge
                count={selectedCommitIds.size}
                style={{
                  backgroundColor: '#10B981',
                }}
                text={
                  <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
                    {selectedCommitIds.size === 2 ? '2 selected - Comparing' : `${selectedCommitIds.size} selected`}
                  </Text>
                }
              />
            )}
          </Space>
        </div>
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          {historyError && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#F85149' }}>
              <Text type="danger" strong>Error loading history</Text>
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                {historyError && 'data' in historyError && typeof historyError.data === 'string' 
                  ? historyError.data 
                  : JSON.stringify(historyError)}
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: colorTextSecondary }}>
                Please check if the backend API endpoint /api/console/history is available
              </div>
            </div>
          )}
          {!historyError && !isLoadingHistory && history.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: colorTextSecondary }}>
              <Text>No commit history found for this entity</Text>
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                History will appear here once commits are made
              </div>
            </div>
          )}
          <Table
            columns={columns}
            dataSource={sortedHistory}
            loading={isLoadingHistory}
            rowKey={(record) => `history-row-${record.commitId}`}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              simple: true,
            }}
            size="small"
            style={{ background: colorBgContainer }}
            locale={{
              emptyText: 'No history records',
            }}
            onRow={() => ({
              onClick: (e) => {
                // Prevent row click from affecting checkbox
                const target = e.target as HTMLElement
                if (target.closest('input[type="checkbox"]') || target.closest('.ant-checkbox')) {
                  return
                }
              },
            })}
          />
        </div>
      </div>

      {/* Diff Viewer */}
      <div style={{ flex: 1, overflow: 'hidden', borderTop: `1px solid ${colorBorder}` }}>
        <div
          style={{
            padding: '12px 16px',
            background: colorBgContainer,
            borderBottom: `1px solid ${colorBorder}`,
          }}
        >
          <Space>
            <Text style={{ fontWeight: 500, color: colorText, fontSize: '14px' }}>
              Diff Comparison
            </Text>
            {commitIdA && commitIdB && (
              <Badge
                status="processing"
                text={
                  <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
                    Comparing #{commitIdA} vs #{commitIdB}
                  </Text>
                }
              />
            )}
          </Space>
        </div>
        <div style={{ height: 'calc(100% - 57px)', overflow: 'hidden' }}>
          {selectedCommitIds.size < 2 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: colorTextSecondary,
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <Text style={{ fontSize: '14px' }}>Select two versions to compare</Text>
              <Text style={{ fontSize: '12px' }}>
                {selectedCommitIds.size === 0 
                  ? 'Use the checkboxes in the history table to select two versions'
                  : `Selected ${selectedCommitIds.size} version(s). Please select one more.`}
              </Text>
            </div>
          )}
          {commitIdA && commitIdB && (
            <DiffViewer
              snapshotA={snapshotA}
              snapshotB={snapshotB}
              isLoadingA={isLoadingA}
              isLoadingB={isLoadingB}
              errorA={errorA}
              errorB={errorB}
            />
          )}
        </div>
      </div>

      {/* Revert Confirmation Modal */}
      <Modal
        title={
          <Space>
            <RotateCcw size={18} />
            <Text strong>Revert to Commit</Text>
          </Space>
        }
        open={revertModalOpen}
        onCancel={() => {
          setRevertModalOpen(false)
          setRevertCommitId(null)
          setRevertMessage('')
          setRevertAuthor('')
        }}
        onOk={handleRevertConfirm}
        confirmLoading={isReverting}
        okText="Confirm Revert"
        cancelText="Cancel"
        width={500}
      >
                <div style={{ marginBottom: '16px' }}>
                  <Text style={{ color: colorTextSecondary }}>
                    This will revert the entity <Text strong style={{ color: colorText }}>{slug}</Text> to the state at commit{' '}
                    <Text strong style={{ color: colorPrimary }}>#{revertCommitId}</Text>.
                  </Text>
                </div>
        <div style={{ marginBottom: '16px' }}>
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            A new commit will be created with the reverted state. This action cannot be undone.
          </Text>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <Text style={{ color: colorText, fontWeight: 500, marginBottom: '8px', display: 'block' }}>
            Author <Text style={{ color: colorTextSecondary, fontWeight: 400, fontSize: '12px' }}>(Optional)</Text>:
          </Text>
          <Input
            value={revertAuthor}
            onChange={(e) => setRevertAuthor(e.target.value)}
            placeholder="e.g., admin@example.com"
            style={{ fontFamily: 'monospace' }}
          />
        </div>
        <div>
          <Text style={{ color: colorText, fontWeight: 500, marginBottom: '8px', display: 'block' }}>
            Message <Text style={{ color: colorTextSecondary, fontWeight: 400, fontSize: '12px' }}>(Optional)</Text>:
          </Text>
          <Input.TextArea
            value={revertMessage}
            onChange={(e) => setRevertMessage(e.target.value)}
            placeholder="e.g., Reverting state to V101"
            rows={3}
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      </Modal>
    </div>
  )
}
