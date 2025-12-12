import { useState, useEffect, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { Tabs, theme, Typography } from 'antd'
import type { TabsProps } from 'antd'
import { useGetSnapshotQuery, useGetHistoryQuery, useGetSnapshotByCommitQuery } from '../store/ubosApi'
import { FileCode, History, Loader2 } from 'lucide-react'
import { HistoryViewer } from './HistoryViewer'
import { TimeTravelSlider } from './TimeTravelSlider'
import { parseUbosUri } from '../utils/useUbosUri'
import type { ResourceContextRequest } from '../types/ubos'

const { Text } = Typography

interface SnapshotEditorProps {
  activeUri: string | null // Full UBOS URI string (e.g., "ubos://LOGIC/entity.slug?branch=master")
  onSnapshotChange?: (uri: string, data: string) => void
  hideHeader?: boolean
}

export function SnapshotEditor({
  activeUri,
  onSnapshotChange,
  hideHeader = false,
}: SnapshotEditorProps) {
  const {
    token: { colorBgContainer, colorText, colorTextSecondary, colorBorder },
  } = theme.useToken()

  const [editorValue, setEditorValue] = useState('')
  const [activeTab, setActiveTab] = useState('current')
  const [timeTravelCommitId, setTimeTravelCommitId] = useState<number | null>(null)
  const [isTimeTravelMode, setIsTimeTravelMode] = useState(false)

  // Parse URI to extract context for HistoryViewer
  const uriDetails = activeUri ? parseUbosUri(activeUri) : null

  // Fetch history for time travel
  const {
    data: history = [],
    isLoading: isLoadingHistory,
  } = useGetHistoryQuery(
    {
      slug: uriDetails?.slug || '',
      type: uriDetails?.type || '',
      branch: uriDetails?.branch || '',
    } as ResourceContextRequest,
    {
      skip: !uriDetails?.slug || !uriDetails?.type,
    }
  )

  // Fetch snapshot by commit for time travel
  const {
    data: timeTravelSnapshot,
    isLoading: isLoadingTimeTravelSnapshot,
  } = useGetSnapshotByCommitQuery(
    {
      slug: uriDetails?.slug || '',
      type: uriDetails?.type || '',
      branch: uriDetails?.branch || '',
      commitId: timeTravelCommitId || 0,
    },
    {
      skip: !timeTravelCommitId || !uriDetails?.slug || !uriDetails?.type,
    }
  )

  // Determine which snapshot to use
  const snapshotToUse = isTimeTravelMode && timeTravelSnapshot ? timeTravelSnapshot : null

  // Fetch current snapshot using URI string
  const {
    data: snapshot,
    isLoading,
    error,
  } = useGetSnapshotQuery(activeUri || '', {
    skip: !activeUri || (isTimeTravelMode && timeTravelSnapshot !== undefined),
  })

  // Update editor value when snapshot data changes
  useEffect(() => {
    const dataToUse = snapshotToUse || snapshot
    if (dataToUse?.snapshotData) {
      // snapshotData is a RAW JSON string - format it for display
      try {
        const parsed = JSON.parse(dataToUse.snapshotData)
        setEditorValue(JSON.stringify(parsed, null, 2))
      } catch {
        // If not valid JSON, use raw data
        setEditorValue(dataToUse.snapshotData)
      }
    } else if (activeUri && !dataToUse) {
      // URI selected but no snapshot yet
      setEditorValue('')
    }
  }, [snapshot, snapshotToUse, activeUri])

  // Handle time travel commit change
  const handleTimeTravelCommitChange = (commitId: number | null) => {
    setTimeTravelCommitId(commitId)
    setIsTimeTravelMode(commitId !== null)
  }

  // Generate blame data from history (simplified - in real app, this would come from API)
  const blameData = useMemo(() => {
    if (!isTimeTravelMode || !timeTravelSnapshot?.snapshotData) return {}
    
    try {
      const currentData = JSON.parse(timeTravelSnapshot.snapshotData)
      const blame: Record<string, { author: string; timestamp: string; commitId: number }> = {}
      
      // For each field in current data, find the last commit that modified it
      // This is a simplified version - in production, you'd need field-level diff tracking
      const findFieldBlame = (obj: any, path: string = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fieldPath = path ? `${path}.${key}` : key
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            findFieldBlame(value, fieldPath)
          } else {
            // Find the most recent commit that might have changed this field
            const relevantCommit = history.find((h) => h.commitId <= (timeTravelCommitId || 0))
            if (relevantCommit) {
              blame[fieldPath] = {
                author: relevantCommit.authorId,
                timestamp: relevantCommit.createdAt,
                commitId: relevantCommit.commitId,
              }
            }
          }
        }
      }
      
      findFieldBlame(currentData)
      return blame
    } catch {
      return {}
    }
  }, [isTimeTravelMode, timeTravelSnapshot, history, timeTravelCommitId])

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || ''
    setEditorValue(newValue)
    // Notify parent component of changes
    if (activeUri && onSnapshotChange) {
      onSnapshotChange(activeUri, newValue)
    }
  }

  if (!activeUri) {
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
            No resource selected
          </p>
          <p style={{ fontSize: '13px' }}>
            Select a resource from the grid to view and edit its snapshot data
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
          {(isLoading || (isTimeTravelMode && isLoadingTimeTravelSnapshot)) ? (
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
                  readOnly: isTimeTravelMode, // Read-only in time travel mode
                }}
              />
              {/* Time Travel Slider */}
              {uriDetails && history.length > 0 && (
                <TimeTravelSlider
                  history={history}
                  currentCommitId={timeTravelCommitId}
                  onCommitChange={handleTimeTravelCommitChange}
                  snapshotData={editorValue}
                  blameData={blameData}
                  slug={uriDetails.slug}
                  entityType={uriDetails.type}
                  branch={uriDetails.branch}
                />
              )}
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
          {uriDetails ? (
            <HistoryViewer
              slug={uriDetails.slug}
              entityType={uriDetails.type}
              branch={uriDetails.branch}
            />
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: colorTextSecondary }}>
              <Text>No URI context available</Text>
            </div>
          )}
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
