import { useState } from 'react'
import { Table, Button, Space, Tag, Typography, theme, message, Modal, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircle, Clock, User, GitBranch, FileCode, XCircle } from 'lucide-react'
import { useGetEntitiesQuery, useApproveRequestMutation, ubosApi } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'
import { entityToApprovalRequest, parseApprovalRequestFromSnapshot, type ApprovalRequestData } from '../utils/entityHelpers'
import { buildUbosUri } from '../utils/useUbosUri'
import { useGetSnapshotQuery } from '../store/ubosApi'
import { useAppDispatch } from '../store/hooks'

const { Text } = Typography

interface ApprovalManagerProps {
  currentBranch: string
}

// Component to render a single row with snapshot data
function ApprovalRequestRow({ entity, currentBranch, onApprove, onReject }: { 
  entity: EntityInstance
  currentBranch: string
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
}) {
  // Try URI mode first
  const uri = buildUbosUri('APPROVAL_REQUEST', entity.slug, currentBranch)
  const { data: snapshotUri, isLoading: isLoadingUri, error: errorUri } = useGetSnapshotQuery(uri, {
    skip: !entity.slug,
  })

  // Fallback to standard mode if URI mode fails (400 error)
  // Check if URI mode failed with a 400 error (which indicates URI mode not supported)
  const shouldTryStandard = errorUri && 'status' in errorUri && errorUri.status === 400 && !snapshotUri
  const standardParams = {
    type: 'APPROVAL_REQUEST' as const,
    slug: entity.slug,
    branch: currentBranch,
  }
  const { data: snapshotStandard, isLoading: isLoadingStandard, error: errorStandard } = useGetSnapshotQuery(
    standardParams,
    {
      skip: !shouldTryStandard || !entity.slug,
    }
  )

  // Use whichever snapshot is available
  const snapshot = snapshotUri || snapshotStandard
  const isLoading = isLoadingUri || isLoadingStandard
  const error = errorUri && errorStandard ? errorStandard : null

  // Parse snapshot data if available, otherwise use defaults
  const requestData = snapshot && !error ? parseApprovalRequestFromSnapshot(snapshot) : null
  const partial = entityToApprovalRequest(entity)

  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorSuccess, colorWarning },
  } = theme.useToken()

  // Use default data if snapshot is not available or failed to load
  const data: ApprovalRequestData = requestData || {
    requestId: entity.slug,
    targetUri: '', // Will be populated from snapshot if available
    requestedBy: '', // Will be populated from snapshot if available
    status: 'PENDING' as const, // Default status
    requestedAt: partial.createdAt || entity.createdAt,
    branch: currentBranch,
  }

  // Show loading state only if actively loading (not if error occurred)
  if (isLoading && !error) {
    return (
      <tr>
        <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>
          <Text style={{ color: colorTextSecondary }}>Loading...</Text>
        </td>
      </tr>
    )
  }

  const getStatusTag = (status: ApprovalRequestData['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <Tag
            icon={<Clock size={12} />}
            color="warning"
            style={{
              margin: 0,
              borderRadius: 4,
              border: `1px solid ${colorWarning}`,
            }}
          >
            Pending
          </Tag>
        )
      case 'APPROVED':
        return (
          <Tag
            icon={<CheckCircle size={12} />}
            color="success"
            style={{
              margin: 0,
              borderRadius: 4,
            }}
          >
            Approved
          </Tag>
        )
      default:
        return <Tag>{status}</Tag>
    }
  }

  return (
    <tr>
      <td>
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: colorPrimary,
            fontWeight: 500,
          }}
        >
          {data.requestId}
        </Text>
      </td>
      <td>
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: colorTextSecondary,
          }}
          title={data.targetUri}
          ellipsis
        >
          {data.targetUri || '-'}
        </Text>
      </td>
      <td>
        <Space size="small">
          <User size={14} color={colorTextSecondary} />
          <Text style={{ fontSize: '12px', color: colorText }}>
            {data.requestedBy || '-'}
          </Text>
        </Space>
      </td>
      <td>
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
            {data.branch}
          </Tag>
        </Space>
      </td>
      <td>{getStatusTag(data.status)}</td>
      <td>
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
          {data.requestedAt ? new Date(data.requestedAt).toLocaleString() : '-'}
        </Text>
      </td>
      <td>
        {data.status === 'PENDING' && (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              icon={<CheckCircle size={14} />}
              onClick={() => onApprove(entity.slug)}
              style={{ minWidth: 80 }}
            >
              Approve
            </Button>
            <Button
              danger
              size="small"
              icon={<XCircle size={14} />}
              onClick={() => onReject(entity.slug)}
              style={{ minWidth: 80 }}
            >
              Reject
            </Button>
          </Space>
        )}
      </td>
    </tr>
  )
}

export function ApprovalManager({ currentBranch }: ApprovalManagerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  // Fetch all APPROVAL_REQUEST entities
  const {
    data: approvalEntities = [],
    isLoading: isLoadingApprovals,
    refetch: refetchApprovals,
  } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'APPROVAL_REQUEST',
  })

  const [approveRequest, { isLoading: isApproving }] = useApproveRequestMutation()
  const dispatch = useAppDispatch()

  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  
  // Add a refresh key to force ApprovalRequestRow components to remount and refetch
  const [refreshKey, setRefreshKey] = useState(0)

  const handleApprove = async (requestId: string) => {
    try {
      await approveRequest({
        requestId,
        approver: 'admin', // TODO: Get from user context
        action: 'approve',
      }).unwrap()

      message.success(`Approval request ${requestId} approved successfully`)
      
      // Invalidate all snapshot caches for APPROVAL_REQUEST entities
      // This ensures ApprovalRequestRow components refetch their snapshot data
      approvalEntities.forEach((entity) => {
        const uri = buildUbosUri('APPROVAL_REQUEST', entity.slug, currentBranch)
        const standardTag = `${entity.slug}-APPROVAL_REQUEST-${currentBranch}`
        // Invalidate both URI-based and standard snapshot tags
        dispatch(ubosApi.util.invalidateTags([{ type: 'Snapshot', id: uri }]))
        dispatch(ubosApi.util.invalidateTags([{ type: 'Snapshot', id: standardTag }]))
      })
      
      // Force refresh: refetch entities and increment refresh key to remount rows
      await refetchApprovals()
      setRefreshKey(prev => prev + 1)
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to approve request')
    }
  }

  const handleRejectClick = (requestId: string) => {
    setRejectingRequestId(requestId)
    setRejectReason('')
    setRejectModalVisible(true)
  }

  const handleRejectConfirm = async () => {
    if (!rejectingRequestId) return

    try {
      await approveRequest({
        requestId: rejectingRequestId,
        approver: 'admin', // TODO: Get from user context
        action: 'reject',
        reason: rejectReason || 'Changes need revision',
      }).unwrap()

      message.success(`Approval request ${rejectingRequestId} rejected`)
      setRejectModalVisible(false)
      setRejectingRequestId(null)
      setRejectReason('')
      
      // Invalidate all snapshot caches for APPROVAL_REQUEST entities
      // This ensures ApprovalRequestRow components refetch their snapshot data
      approvalEntities.forEach((entity) => {
        const uri = buildUbosUri('APPROVAL_REQUEST', entity.slug, currentBranch)
        const standardTag = `${entity.slug}-APPROVAL_REQUEST-${currentBranch}`
        // Invalidate both URI-based and standard snapshot tags
        dispatch(ubosApi.util.invalidateTags([{ type: 'Snapshot', id: uri }]))
        dispatch(ubosApi.util.invalidateTags([{ type: 'Snapshot', id: standardTag }]))
      })
      
      // Force refresh: refetch entities and increment refresh key to remount rows
      await refetchApprovals()
      setRefreshKey(prev => prev + 1)
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to reject request')
    }
  }

  const handleRejectCancel = () => {
    setRejectModalVisible(false)
    setRejectingRequestId(null)
    setRejectReason('')
  }

  const columns: ColumnsType<EntityInstance> = [
    {
      title: 'Request ID',
      key: 'requestId',
      width: 200,
    },
    {
      title: 'Target URI',
      key: 'targetUri',
      width: 350,
      ellipsis: true,
    },
    {
      title: 'Requested By',
      key: 'requestedBy',
      width: 150,
    },
    {
      title: 'Branch',
      key: 'branch',
      width: 120,
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
    },
    {
      title: 'Requested At',
      key: 'requestedAt',
      width: 180,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
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
          <FileCode size={18} color={colorPrimary} />
          <Text strong style={{ fontSize: '16px', color: colorText }}>
            Approval Manager
          </Text>
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            ({approvalEntities.length} requests)
          </Text>
        </Space>
        <Space>
          <Button
            size="small"
            onClick={() => refetchApprovals()}
            loading={isLoadingApprovals}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {approvalEntities.length === 0 && !isLoadingApprovals ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: colorTextSecondary,
            }}
          >
            <FileCode size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <Text style={{ fontSize: '14px' }}>No approval requests</Text>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={approvalEntities}
            loading={isLoadingApprovals || isApproving}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} requests`,
            }}
            size="small"
            style={{ background: colorBgContainer }}
            components={{
              body: {
                row: (props: any) => {
                  const entity = approvalEntities.find((e) => e.id === props['data-row-key'])
                  if (!entity) return <tr {...props} />
                  // Use refreshKey as key to force remount when approval/reject happens
                  // This ensures useGetSnapshotQuery hooks refetch with fresh data
                  return (
                    <ApprovalRequestRow
                      key={`${entity.id}-${refreshKey}`}
                      entity={entity}
                      currentBranch={currentBranch}
                      onApprove={handleApprove}
                      onReject={handleRejectClick}
                    />
                  )
                },
              },
            }}
          />
        )}
      </div>

      {/* Reject Modal */}
      <Modal
        title="Reject Approval Request"
        open={rejectModalVisible}
        onOk={handleRejectConfirm}
        onCancel={handleRejectCancel}
        okText="Reject"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Request ID: </Text>
          <Text code>{rejectingRequestId}</Text>
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Reason (optional):
          </Text>
          <Input.TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection (e.g., 'Changes need revision')"
          />
        </div>
      </Modal>
    </div>
  )
}
