import { useState } from 'react'
import { ConfigProvider } from 'antd'
import { Sidebar } from './Sidebar'
import { EntityManager } from './EntityManager'
import { SnapshotEditor } from './SnapshotEditor'
import type { EntityInstance } from '../types/ubos'
import { useBatchCommitMutation } from '../store/ubosApi'
import { message } from 'antd'

export function UBOSStudio() {
  const [activeView, setActiveView] = useState('entities')
  const [selectedEntity, setSelectedEntity] = useState<EntityInstance | null>(
    null
  )
  const [currentBranch, setCurrentBranch] = useState('master')
  const [editedSnapshotData, setEditedSnapshotData] = useState<
    Record<string, string>
  >({})

  const [batchCommit] = useBatchCommitMutation()

  const handleBranchChange = (branch: string) => {
    setCurrentBranch(branch)
    // Clear selection when branch changes
    setSelectedEntity(null)
    setEditedSnapshotData({})
  }

  const handleCommit = async (
    snapshotData: string,
    commitMessage?: string
  ) => {
    if (!selectedEntity) return

    try {
      // Create JSON Patch: replace entire snapshotData
      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: snapshotData,
        },
      ])

      await batchCommit({
        slugs: [selectedEntity.slug],
        branch: currentBranch,
        jsonPatch,
        message: commitMessage || `Update ${selectedEntity.slug}`,
      }).unwrap()

      message.success(
        `Successfully committed changes to ${selectedEntity.slug}`
      )
      // Clear edited data after successful commit
      setEditedSnapshotData((prev) => {
        const updated = { ...prev }
        delete updated[selectedEntity.slug]
        return updated
      })
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to commit changes')
    }
  }

  const handleSnapshotChange = (slug: string, data: string) => {
    setEditedSnapshotData((prev) => ({
      ...prev,
      [slug]: data,
    }))
  }

  const branches = ['master', 'beijing', 'shanghai', 'development']

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: 'hsl(var(--primary))',
          borderRadius: 6,
        },
      }}
    >
      <div className="h-full w-full flex overflow-hidden bg-background">
        {/* Sidebar */}
        <Sidebar activeView={activeView} onViewChange={setActiveView} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {activeView === 'entities' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: Entity Grid */}
              <div className="w-1/2 border-r border-border flex flex-col">
                <EntityManager
                  selectedEntity={selectedEntity}
                  onRowSelect={setSelectedEntity}
                  currentBranch={currentBranch}
                  onBranchChange={handleBranchChange}
                  editedSnapshotData={editedSnapshotData}
                />
              </div>

              {/* Right Pane: Snapshot Editor */}
              <div className="w-1/2 flex flex-col">
                <SnapshotEditor
                  entity={selectedEntity}
                  branches={branches}
                  currentBranch={currentBranch}
                  onBranchChange={handleBranchChange}
                  onCommit={handleCommit}
                  onSnapshotChange={handleSnapshotChange}
                />
              </div>
            </div>
          )}

          {activeView === 'commits' && (
            <div className="flex-1 p-8 flex items-center justify-center text-muted-foreground">
              <p>Commits view - Coming soon</p>
            </div>
          )}

          {activeView === 'branches' && (
            <div className="flex-1 p-8 flex items-center justify-center text-muted-foreground">
              <p>Branches view - Coming soon</p>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="flex-1 p-8 flex items-center justify-center text-muted-foreground">
              <p>Settings view - Coming soon</p>
            </div>
          )}
        </div>
      </div>
    </ConfigProvider>
  )
}
