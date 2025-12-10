import { useState } from 'react'
import { Table, Drawer, Space, Tag, Typography, theme, Button, Descriptions, Divider } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileText, User, Calendar, GitCommit, Hash, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useGetRecentProcessesQuery, useGetProcessDetailQuery } from '../store/ubosApi'
import type { ProcessRecord } from '../types/ubos'

const { Text } = Typography

export function ProcessLogViewer() {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer, colorSuccess, colorError },
  } = theme.useToken()

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Fetch recent processes
  const {
    data: processes = [],
    isLoading: isLoadingProcesses,
    refetch: refetchProcesses,
  } = useGetRecentProcessesQuery({ limit: 100 })

  // Fetch process detail when a process is selected
  const {
    data: processDetail,
    isLoading: isLoadingDetail,
  } = useGetProcessDetailQuery(selectedProcessId || '', {
    skip: !selectedProcessId,
  })

  const handleRowClick = (record: ProcessRecord) => {
    setSelectedProcessId(record.processId)
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    setSelectedProcessId(null)
  }

  const columns: ColumnsType<ProcessRecord> = [
    {
      title: 'Process ID',
      dataIndex: 'processId',
      key: 'processId',
      width: 200,
      render: (text: string) => (
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: colorPrimary,
            fontWeight: 500,
          }}
        >
          {text.substring(0, 16)}...
        </Text>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'processName',
      key: 'processName',
      render: (name: string) => (
        <Text style={{ color: colorText, fontWeight: 500 }}>{name}</Text>
      ),
    },
    {
      title: 'Operator',
      dataIndex: 'operator',
      key: 'operator',
      width: 150,
      render: (operator: string) => (
        <Space size="small">
          <User size={14} color={colorTextSecondary} />
          <Text style={{ color: colorText, fontSize: '13px' }}>{operator}</Text>
        </Space>
      ),
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (time: string) => (
        <Space size="small">
          <Calendar size={14} color={colorTextSecondary} />
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            {time ? new Date(time).toLocaleString() : '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        if (status === 'completed') {
          return (
            <Tag
              icon={<CheckCircle size={12} />}
              color="success"
              style={{ margin: 0 }}
            >
              Completed
            </Tag>
          )
        } else if (status === 'failed') {
          return (
            <Tag
              icon={<XCircle size={12} />}
              color="error"
              style={{ margin: 0 }}
            >
              Failed
            </Tag>
          )
        }
        return (
          <Tag style={{ margin: 0 }}>In Progress</Tag>
        )
      },
    },
    {
      title: 'Commits',
      dataIndex: 'commitCount',
      key: 'commitCount',
      width: 100,
      render: (count: number) => (
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
          {count !== undefined ? count : '-'}
        </Text>
      ),
    },
  ]

  const commitColumns: ColumnsType<any> = [
    {
      title: 'Commit ID',
      dataIndex: 'commitId',
      key: 'commitId',
      width: 120,
      render: (commitId: number) => (
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
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: '12px', color: colorText }}>
          {slug}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 100,
      render: (type: string) => (
        <Tag
          style={{
            margin: 0,
            borderRadius: 4,
            border: `1px solid ${colorBorder}`,
            background: 'rgba(74, 158, 255, 0.1)',
            color: colorText,
          }}
        >
          {type}
        </Tag>
      ),
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      render: (branch: string) => (
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{branch}</Text>
      ),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (msg: string) => (
        <Text style={{ color: colorText, fontSize: '12px' }}>{msg || '-'}</Text>
      ),
    },
    {
      title: 'Author',
      dataIndex: 'authorId',
      key: 'authorId',
      width: 120,
      render: (author: string) => (
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{author}</Text>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => (
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
          {time ? new Date(time).toLocaleString() : '-'}
        </Text>
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
          <FileText size={18} color={colorPrimary} />
          <Text strong style={{ fontSize: '16px', color: colorText }}>
            Process Log
          </Text>
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            ({processes.length} processes)
          </Text>
        </Space>
        <Button
          size="small"
          onClick={() => refetchProcesses()}
          loading={isLoadingProcesses}
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <Table
          columns={columns}
          dataSource={processes}
          loading={isLoadingProcesses}
          rowKey="processId"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} processes`,
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: {
              cursor: 'pointer',
            },
          })}
          size="small"
          style={{ background: colorBgContainer }}
        />
      </div>

      {/* Detail Drawer */}
      <Drawer
        title={
          <Space>
            <FileText size={18} />
            <Text strong>Process Details</Text>
          </Space>
        }
        open={drawerOpen}
        onClose={handleCloseDrawer}
        width={800}
        destroyOnClose
      >
        {isLoadingDetail ? (
          <div style={{ textAlign: 'center', padding: '48px', color: colorTextSecondary }}>
            <Text>Loading process details...</Text>
          </div>
        ) : processDetail ? (
          <div>
            {/* Process Metadata */}
            <Descriptions
              title="Process Information"
              bordered
              column={1}
              size="small"
              style={{ marginBottom: '24px' }}
            >
              <Descriptions.Item label="Process ID">
                <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {processDetail.processId}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Name">
                <Text>{processDetail.processName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Operator">
                <Space size="small">
                  <User size={14} />
                  <Text>{processDetail.operator}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Start Time">
                <Space size="small">
                  <Calendar size={14} />
                  <Text>{new Date(processDetail.startTime).toLocaleString()}</Text>
                </Space>
              </Descriptions.Item>
              {processDetail.endTime && (
                <Descriptions.Item label="End Time">
                  <Space size="small">
                    <Clock size={14} />
                    <Text>{new Date(processDetail.endTime).toLocaleString()}</Text>
                  </Space>
                </Descriptions.Item>
              )}
              {processDetail.status && (
                <Descriptions.Item label="Status">
                  <Tag
                    color={processDetail.status === 'completed' ? 'success' : processDetail.status === 'failed' ? 'error' : 'default'}
                  >
                    {processDetail.status}
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider>Associated Commits</Divider>

            {/* Commits Table */}
            <div style={{ marginTop: '16px' }}>
              <Text strong style={{ fontSize: '14px', marginBottom: '12px', display: 'block' }}>
                Commits ({processDetail.commits?.length || 0})
              </Text>
              <Table
                columns={commitColumns}
                dataSource={processDetail.commits || []}
                rowKey="commitId"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                }}
                size="small"
              />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px', color: colorTextSecondary }}>
            <Text>No process details found</Text>
          </div>
        )}
      </Drawer>
    </div>
  )
}

