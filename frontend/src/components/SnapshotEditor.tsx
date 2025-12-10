import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Tabs, theme, Typography } from 'antd'
import type { TabsProps } from 'antd'
import { useGetSnapshotQuery } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'
import { FileCode, History, Loader2 } from 'lucide-react'
import { HistoryViewer } from './HistoryViewer'

const { Text } = Typography

interface SnapshotEditorProps {
  entity: EntityInstance | null
  branches: string[]
  currentBranch: string
  onBranchChange: (branch: string) => void
  onCommit?: (snapshotData: string, commitMessage?: string) => void
  onSnapshotChange?: (slug: string, data: string) => void
  hideHeader?: boolean
}

export function SnapshotEditor({
  entity,
  currentBranch,
  onSnapshotChange,
}: SnapshotEditorProps) {
  const {
    token: { colorBgContainer, colorText, colorTextSecondary, colorBorder },
  } = theme.useToken()

  const [editorValue, setEditorValue] = useState('')
  const [activeTab, setActiveTab] = useState('current')

  // RTK Query - skip if no entity selected
  // Uses ResourceContextRequest DTO
  const {
    data: snapshot,
    isLoading,
    error,
  } = useGetSnapshotQuery(
    {
      slug: entity?.slug || '',
      type: entity?.entityType || '',
      branch: currentBranch,
    },
    {
      skip: !entity?.slug || !entity?.entityType,
    }
  )

  // Update editor value when snapshot data changes
  useEffect(() => {
    if (snapshot?.snapshotData) {
      // snapshotData is a RAW JSON string - format it for display
      try {
        const parsed = JSON.parse(snapshot.snapshotData)
        setEditorValue(JSON.stringify(parsed, null, 2))
      } catch {
        // If not valid JSON, use raw data
        setEditorValue(snapshot.snapshotData)
      }
    } else if (entity && !snapshot) {
      // Entity selected but no snapshot yet
      setEditorValue('')
    }
  }, [snapshot, entity])

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || ''
    setEditorValue(newValue)
    // Notify parent component of changes
    if (entity?.slug && onSnapshotChange) {
      onSnapshotChange(entity.slug, newValue)
    }
  }

  if (!entity) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: colorTextSecondary,
          background: colorBgContainer,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '16px', marginBottom: '8px', color: colorText }}>
            No entity selected
          </p>
          <p style={{ fontSize: '13px' }}>
            Select an entity from the grid to view and edit its snapshot data
          </p>
        </div>
      </div>
    )
  }

  // Tab items for Ant Design Tabs
  const tabItems: TabsProps['items'] = [
    {
      key: 'current',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileCode size={16} />
          Current State
        </span>
      ),
      children: (
        <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: colorTextSecondary,
              }}
            >
              <Loader2 size={20} style={{ marginRight: '8px' }} />
              <Text style={{ color: colorTextSecondary }}>Loading snapshot...</Text>
            </div>
          ) : error ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#F85149',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '8px' }}>Error loading snapshot</p>
                <Text type="danger" style={{ fontSize: '12px' }}>
                  {error && 'data' in error && typeof error.data === 'string' 
                    ? error.data 
                    : JSON.stringify(error)}
                </Text>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, height: '100%', minHeight: 0, position: 'relative' }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={editorValue || '{}'}
                onChange={handleEditorChange}
                theme="vs-dark"
                loading={
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                    }}
                  >
                    Loading editor...
                  </div>
                }
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on',
                  formatOnPaste: true,
                  formatOnType: true,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                }}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <History size={16} />
          History
        </span>
      ),
      children: (
        <div style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
          <HistoryViewer entity={entity} currentBranch={currentBranch} />
        </div>
      ),
    },
  ]

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colorBgContainer,
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        tabBarStyle={{
          margin: 0,
          padding: '0 16px',
          background: colorBgContainer,
          borderBottom: `1px solid ${colorBorder}`,
        }}
      />
    </div>
  )
}
