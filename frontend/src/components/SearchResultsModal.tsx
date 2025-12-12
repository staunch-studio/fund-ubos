import { useState } from 'react'
import { Modal, Table, Space, Tag, Typography, theme, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Search, FileCode, GitBranch, Hash } from 'lucide-react'
import type { SearchResult } from '../types/ubos'
import { buildUbosUri } from '../utils/useUbosUri'

const { Text } = Typography

interface SearchResultsModalProps {
  open: boolean
  onCancel: () => void
  results: SearchResult[]
  isLoading?: boolean
  searchQuery: string
  onResultClick?: (result: SearchResult) => void
}

export function SearchResultsModal({
  open,
  onCancel,
  results,
  isLoading = false,
  searchQuery,
  onResultClick,
}: SearchResultsModalProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  const columns: ColumnsType<SearchResult> = [
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
        <Space size="small">
          <GitBranch size={14} color={colorTextSecondary} />
          <Text style={{ color: colorText, fontSize: '12px' }}>{branch}</Text>
        </Space>
      ),
    },
    {
      title: 'Commit ID',
      dataIndex: 'commitId',
      key: 'commitId',
      width: 120,
      render: (commitId: number) =>
        commitId ? (
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: colorPrimary,
            }}
          >
            #{commitId}
          </Text>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
    {
      title: 'Snippet',
      dataIndex: 'snippet',
      key: 'snippet',
      ellipsis: true,
      render: (snippet: string) =>
        snippet ? (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{snippet}</Text>
        ) : (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
        ),
    },
  ]

  return (
    <Modal
      title={
        <Space>
          <Search size={18} />
          <Text strong style={{ fontSize: '16px' }}>
            Search Results
          </Text>
          {searchQuery && (
            <Text style={{ color: colorTextSecondary, fontSize: '13px', fontWeight: 400 }}>
              for "{searchQuery}"
            </Text>
          )}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          Close
        </Button>,
      ]}
      width={900}
      destroyOnClose
    >
      <div style={{ marginTop: '16px' }}>
        {results.length === 0 && !isLoading ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              color: colorTextSecondary,
            }}
          >
            <Search size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <Text style={{ fontSize: '14px' }}>No results found</Text>
            <div style={{ marginTop: '8px' }}>
              <Text style={{ fontSize: '12px' }}>
                Try a different search query or check your filters
              </Text>
            </div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={results}
            loading={isLoading}
            rowKey={(record) => `${record.slug}-${record.branchName}-${record.commitId || 'latest'}`}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} results`,
            }}
            onRow={(record) => ({
              onClick: () => {
                if (onResultClick) {
                  onResultClick(record)
                }
              },
              style: {
                cursor: onResultClick ? 'pointer' : 'default',
              },
            })}
            size="small"
            style={{ background: colorBgContainer }}
          />
        )}
      </div>
    </Modal>
  )
}



