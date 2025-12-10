import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { useGetSnapshotQuery } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'
import { Button } from './ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Select } from './ui/select'
import { GitCommit, History, Loader2 } from 'lucide-react'
import { message } from 'antd'

interface SnapshotEditorProps {
  entity: EntityInstance | null
  branches: string[]
  currentBranch: string
  onBranchChange: (branch: string) => void
  onCommit?: (snapshotData: string, commitMessage?: string) => void
  onSnapshotChange?: (slug: string, data: string) => void
}

export function SnapshotEditor({
  entity,
  branches,
  currentBranch,
  onBranchChange,
  onCommit,
  onSnapshotChange,
}: SnapshotEditorProps) {
  const [editorValue, setEditorValue] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [activeTab, setActiveTab] = useState('editor')

  // RTK Query - skip if no entity selected
  const {
    data: snapshot,
    isLoading,
    error,
  } = useGetSnapshotQuery(
    {
      slug: entity?.slug || '',
      entityType: entity?.entityType || '',
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

  const handleCommit = () => {
    if (!editorValue.trim() || !entity) {
      message.warning('No changes to commit')
      return
    }

    if (onCommit) {
      onCommit(editorValue, commitMessage || undefined)
      setCommitMessage('')
      message.success('Changes committed successfully')
    } else {
      message.info('Commit handler not implemented')
    }
  }

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
      <div className="flex items-center justify-center h-full text-muted-foreground bg-card">
        <div className="text-center">
          <p className="text-lg mb-2">No entity selected</p>
          <p className="text-sm">
            Select an entity from the grid to view and edit its snapshot data
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header with Branch Selector */}
      <div className="border-b border-border p-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Branch:
            </label>
            <Select
              value={currentBranch}
              onChange={(e) => onBranchChange(e.target.value)}
              className="w-40"
            >
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{entity.slug}</span>
            <span className="mx-2">•</span>
            <span>{entity.entityType}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="border-b border-border px-4">
          <TabsList>
            <TabsTrigger value="editor">
              <GitCommit className="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Editor Tab */}
        <TabsContent value="editor" className="flex-1 flex flex-col m-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Loading snapshot...
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive">
              <div className="text-center">
                <p className="mb-2">Error loading snapshot</p>
                <p className="text-sm text-muted-foreground">
                  {JSON.stringify(error)}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 border-b border-border">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={editorValue}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  loading={
                    <div className="flex items-center justify-center h-full">
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
                  }}
                />
              </div>
              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Commit message (optional)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button
                    onClick={handleCommit}
                    disabled={!editorValue.trim()}
                  >
                    <GitCommit className="h-4 w-4 mr-2" />
                    Commit Changes
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Raw JSON editor - preserves exact data format. Changes are
                  committed to branch: <strong>{currentBranch}</strong>
                </p>
              </div>
            </>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 m-0 overflow-auto">
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Version Chain</h3>
            {snapshot ? (
              <div className="border border-border rounded-lg p-4 bg-background">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{snapshot.commitId}
                    </span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                      Latest
                    </span>
                  </div>
                  {snapshot.createdAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {snapshot.message && (
                  <p className="text-sm font-medium mb-2">
                    {snapshot.message}
                  </p>
                )}
                {snapshot.authorId && (
                  <p className="text-xs text-muted-foreground">
                    Author: {snapshot.authorId}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Branch: {snapshot.branchName}
                </p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No version history available
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
