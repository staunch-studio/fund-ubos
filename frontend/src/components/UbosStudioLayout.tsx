import { useState, useMemo, useEffect } from 'react'
import { Layout, Menu, Select, Input, Button, Space, theme, Typography, Badge } from 'antd'
const { Search: SearchInput } = Input
import type { MenuProps } from 'antd'
import SplitPane from 'react-split-pane'
import { Database, Code, FileCode, Box, Users, ShoppingCart, Settings, GitBranch, Copy, CheckCircle2, Settings as SettingsIcon, GitMerge, Search, FileText, Server, FileJson, ShieldCheck, Shield, User, GitCompare } from 'lucide-react'
import { EntityManager } from './EntityManager'
import { SnapshotEditor } from './SnapshotEditor'
import { ThemeSelector } from './ThemeSelector'
import { BranchManagerModal } from './BranchManagerModal'
import { BranchMergeModal } from './BranchMergeModal'
import { SearchResultsModal } from './SearchResultsModal'
import { ProcessLogViewer } from './ProcessLogViewer'
import { EnvironmentManager } from './EnvironmentManager'
import { SchemaManager } from './SchemaManager'
import { ApprovalManager } from './ApprovalManager'
import { IdentityManager } from './IdentityManager'
import { BranchStatusViewer } from './BranchStatusViewer'
import type { EntityInstance } from '../types/ubos'
import { useBatchCommitMutation, useGetBranchesQuery, useLazySearchQuery, useCreateApprovalRequestMutation } from '../store/ubosApi'
import { message } from 'antd'
import { buildUbosUri, parseUbosUri } from '../utils/useUbosUri'
import './UbosStudioLayout.css'

const { Header, Sider, Content } = Layout
const { Text } = Typography

interface UbosStudioLayoutProps {
  branches?: string[]
  entityTypes?: string[]
}

// Icon mapping for entity types
const entityTypeIcons: Record<string, React.ReactNode> = {
  Logic: <Code size={16} />,
  View: <FileCode size={16} />,
  Data: <Database size={16} />,
  Config: <Settings size={16} />,
  UserProfile: <Users size={16} />,
  Product: <Box size={16} />,
  Order: <ShoppingCart size={16} />,
}

export function UbosStudioLayout({
  branches: defaultBranches = ['master', 'beijing', 'shanghai', 'development'],
  entityTypes = ['Logic', 'View', 'Data', 'Config', 'UserProfile', 'Product', 'Order'],
}: UbosStudioLayoutProps) {
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

  const [activeResourceUri, setActiveResourceUri] = useState<string | null>(null) // Store full UBOS URI
  const [currentBranch, setCurrentBranch] = useState('master')
  const [selectedEntityType, setSelectedEntityType] = useState<string | undefined>(undefined)
  const [editedSnapshotData, setEditedSnapshotData] = useState<Record<string, string>>({}) // Key: URI, Value: snapshotData
  const [commitMessage, setCommitMessage] = useState('')
  const [uriCopied, setUriCopied] = useState(false)
  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [activeView, setActiveView] = useState<'entities' | 'processLog' | 'environments' | 'schema' | 'approvals' | 'identity' | 'branchStatus'>('entities')
  
  const [triggerSearch, { data: searchResults = [], isLoading: isSearching }] = useLazySearchQuery()

  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()
  const [createApprovalRequest] = useCreateApprovalRequestMutation()

  // Fetch branches from API
  const { data: branchesData = [], isLoading: isLoadingBranches } = useGetBranchesQuery()
  
  // Use API branches if available, otherwise fall back to default branches
  const branches = useMemo(() => {
    if (branchesData.length > 0) {
      return branchesData.map(b => b.branchName)
    }
    return defaultBranches
  }, [branchesData, defaultBranches])

  // Set initial branch to first available branch
  useEffect(() => {
    if (branches.length > 0 && !branches.includes(currentBranch)) {
      setCurrentBranch(branches[0])
    }
  }, [branches, currentBranch])

  const handleBranchChange = (branch: string) => {
    setCurrentBranch(branch)
    // Clear active URI when branch changes (URI contains branch info)
    setActiveResourceUri(null)
    setEditedSnapshotData({})
  }

  const handleEntityTypeSelect: MenuProps['onClick'] = (e) => {
    if (e.key === 'processLog') {
      setActiveView('processLog')
      setSelectedEntityType(undefined)
    } else if (e.key === 'environments') {
      setActiveView('environments')
      setSelectedEntityType(undefined)
    } else if (e.key === 'schema') {
      setActiveView('schema')
      setSelectedEntityType(undefined)
    } else if (e.key === 'approvals') {
      setActiveView('approvals')
      setSelectedEntityType(undefined)
    } else if (e.key === 'all') {
      setActiveView('entities')
      setSelectedEntityType(undefined)
    } else {
      setActiveView('entities')
      setSelectedEntityType(e.key)
    }
  }

  const handleSearch = (value: string) => {
    if (!value.trim()) {
      message.warning('Please enter a search query')
      return
    }
    setSearchQuery(value)
    triggerSearch({
      query: value.trim(),
      branch: currentBranch,
    })
    setSearchModalOpen(true)
  }

  const handleSearchResultClick = (result: any) => {
    // Find the entity and select it
    // This would require additional logic to load the entity
    setSearchModalOpen(false)
    message.info(`Selected: ${result.slug}`)
  }

  // Check if a branch is protected (requires approval)
  // For now, we'll consider 'master' and 'main' as protected branches
  // This can be extended to fetch from backend or configuration
  const isProtectedBranch = (branch: string): boolean => {
    const protectedBranches = ['master', 'main', 'production', 'prod']
    return protectedBranches.includes(branch.toLowerCase())
  }

  const handleCommit = async () => {
    if (!activeResourceUri) {
      message.warning('Please select a resource to commit')
      return
    }

    const snapshotData = editedSnapshotData[activeResourceUri]
    if (!snapshotData) {
      message.warning('No changes detected')
      return
    }

    try {
      // Parse URI to extract slug and branch for batchCommit
      const uriDetails = parseUbosUri(activeResourceUri)
      if (!uriDetails) {
        message.error('Invalid URI format')
        return
      }

      const targetBranch = uriDetails.branch || currentBranch

      // Check if branch is protected
      if (isProtectedBranch(targetBranch)) {
        // Create approval request instead of direct commit
        // Backend expects: { targetUri, content: Map<String, Object>, author?, message? }
        const approvalResponse = await createApprovalRequest({
          targetUri: activeResourceUri,
          content: {
            snapshotData: snapshotData, // The new snapshot data to be approved
          },
          author: undefined, // Optional - backend defaults to "system"
          message: commitMessage || `Update ${uriDetails.slug}`,
        }).unwrap()

        message.success({
          content: `Approval request created: ${approvalResponse.requestId}. Waiting for approval...`,
          duration: 3,
        })
        setCommitMessage('')
        setEditedSnapshotData((prev) => {
          const updated = { ...prev }
          delete updated[activeResourceUri]
          return updated
        })
      } else {
        // Direct commit for non-protected branches
        const jsonPatch = JSON.stringify([
          {
            op: 'replace',
            path: '/snapshotData',
            value: snapshotData,
          },
        ])

        await batchCommit({
          slugs: [uriDetails.slug],
          branch: targetBranch,
          jsonPatch,
          message: commitMessage || `Update ${uriDetails.slug}`,
        }).unwrap()

        message.success({
          content: `Successfully committed changes to ${activeResourceUri}`,
          duration: 2,
        })
        setCommitMessage('')
        setEditedSnapshotData((prev) => {
          const updated = { ...prev }
          delete updated[activeResourceUri]
          return updated
        })
      }
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to commit changes'
      if (err?.status === 403 || err?.data?.status === 403) {
        message.error(`Permission Denied: ${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
    }
  }

  const handleSnapshotChange = (uri: string, data: string) => {
    setEditedSnapshotData((prev) => ({
      ...prev,
      [uri]: data,
    }))
  }

  const handleCopyUri = () => {
    if (currentUri) {
      navigator.clipboard.writeText(currentUri)
      setUriCopied(true)
      message.success('URI copied to clipboard', 1.5)
      setTimeout(() => setUriCopied(false), 2000)
    }
  }

  // Build menu items for entity types
  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'all',
        icon: <Database size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'entities' && selectedEntityType === undefined ? 500 : 400 }}>
            All Entities
          </span>
        ),
      },
      {
        type: 'divider' as const,
      },
      ...entityTypes.map((type) => ({
        key: type,
        icon: entityTypeIcons[type] || <Code size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'entities' && selectedEntityType === type ? 500 : 400 }}>
            {type}
          </span>
        ),
      })),
      {
        type: 'divider' as const,
      },
      {
        key: 'processLog',
        icon: <FileText size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'processLog' ? 500 : 400 }}>
            Process Log
          </span>
        ),
      },
      {
        key: 'environments',
        icon: <Server size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'environments' ? 500 : 400 }}>
            Environments
          </span>
        ),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'schema',
        icon: <FileJson size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'schema' ? 500 : 400 }}>
            Schema Manager
          </span>
        ),
      },
      {
        key: 'approvals',
        icon: <ShieldCheck size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'approvals' ? 500 : 400 }}>
            Approvals
          </span>
        ),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'identity',
        icon: <Shield size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'identity' ? 500 : 400 }}>
            Identity
          </span>
        ),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'branchStatus',
        icon: <GitCompare size={18} />,
        label: (
          <span style={{ fontWeight: activeView === 'branchStatus' ? 500 : 400 }}>
            Branch Status
          </span>
        ),
      },
    ],
    [entityTypes, selectedEntityType, activeView]
  )

  const currentUri = activeResourceUri || ''

  const hasChanges = activeResourceUri && editedSnapshotData[activeResourceUri]

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden', background: '#010409' }}>
      {/* Top Header - Enhanced */}
      <Header
        style={{
          background: 'linear-gradient(180deg, #161B22 0%, #0D1117 100%)',
          borderBottom: `1px solid ${colorBorder}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              background: 'rgba(74, 158, 255, 0.1)',
              borderRadius: borderRadius,
              border: `1px solid rgba(74, 158, 255, 0.2)`,
            }}
          >
            <FileCode size={20} color={colorPrimary} />
            <Text
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: colorText,
                letterSpacing: '-0.3px',
              }}
            >
              UBOS Studio
            </Text>
          </div>
          <SearchInput
            placeholder="Search entities, commits, branches..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 400, maxWidth: '100%' }}
            enterButton={<Search size={16} />}
            loading={isSearching}
          />
        </div>
        <Space size="middle">
          <ThemeSelector />
          <Space size="small">
            <GitBranch size={16} color={colorTextSecondary} />
            <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>Branch:</Text>
          </Space>
          <Select
            value={currentBranch}
            onChange={handleBranchChange}
            loading={isLoadingBranches}
            style={{ 
              width: 160,
              fontWeight: 500,
            }}
            options={branches.map((b) => ({ 
              label: (
                <Space>
                  <GitBranch size={14} />
                  <span>{b}</span>
                </Space>
              ), 
              value: b 
            }))}
          />
          <Button
            type="default"
            icon={<SettingsIcon size={14} />}
            onClick={() => setBranchModalOpen(true)}
            style={{ marginLeft: '8px' }}
          >
            Manage Branches
          </Button>
          <Button
            type="primary"
            icon={<GitMerge size={14} />}
            onClick={() => setMergeModalOpen(true)}
            style={{ marginLeft: '8px' }}
          >
            Merge
          </Button>
        </Space>
      </Header>

      {/* Branch Manager Modal */}
      <BranchManagerModal
        open={branchModalOpen}
        onCancel={() => setBranchModalOpen(false)}
        onSuccess={() => {
          // Branch list will automatically refresh via RTK Query cache invalidation
        }}
      />

      {/* Branch Merge Modal */}
      <BranchMergeModal
        open={mergeModalOpen}
        onCancel={() => setMergeModalOpen(false)}
        onSuccess={() => {
          // All caches will automatically refresh via RTK Query cache invalidation
        }}
        currentBranch={currentBranch}
      />

      <Layout style={{ height: 'calc(100vh - 56px)', background: '#010409' }}>
        {/* Left Sidebar - Enhanced */}
        <Sider
          width={220}
          style={{
            background: colorBgElevated,
            borderRight: `1px solid ${colorBorder}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: `1px solid ${colorBorder}`,
              background: 'rgba(74, 158, 255, 0.05)',
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
              {activeView === 'processLog' || activeView === 'environments' || activeView === 'schema' || activeView === 'approvals' || activeView === 'identity' || activeView === 'branchStatus' ? 'Navigation' : 'Entity Types'}
            </Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={
              activeView === 'processLog'
                ? ['processLog']
                : activeView === 'environments'
                ? ['environments']
                : activeView === 'schema'
                ? ['schema']
                : activeView === 'approvals'
                ? ['approvals']
                : selectedEntityType
                ? [selectedEntityType]
                : ['all']
            }
            onClick={handleEntityTypeSelect}
            style={{
              height: 'calc(100% - 57px)',
              borderRight: 0,
              background: 'transparent',
              padding: '8px',
            }}
            items={menuItems}
          />
        </Sider>

        {/* Main Content Area with Split Pane */}
        <Content
          style={{
            background: colorBgContainer,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {activeView === 'processLog' ? (
            <ProcessLogViewer />
          ) : activeView === 'environments' ? (
            <EnvironmentManager currentBranch={currentBranch} />
          ) : activeView === 'schema' ? (
            <SchemaManager availableEntityTypes={entityTypes} currentBranch={currentBranch} />
          ) : activeView === 'approvals' ? (
            <ApprovalManager currentBranch={currentBranch} />
          ) : activeView === 'identity' ? (
            <IdentityManager currentBranch={currentBranch} />
          ) : activeView === 'branchStatus' ? (
            <BranchStatusViewer
              currentBranch={currentBranch}
              onEntitySelect={(uri) => {
                setActiveResourceUri(uri)
                setActiveView('entities')
              }}
            />
          ) : (
          <SplitPane
            split="vertical"
            minSize={320}
            maxSize={-320}
            defaultSize="50%"
            style={{ height: '100%' }}
            paneStyle={{ overflow: 'hidden' }}
            resizerStyle={{
              background: colorBorder,
              width: '2px',
              cursor: 'col-resize',
              zIndex: 10,
              transition: 'all 0.2s ease',
            }}
          >
                      {/* Left Pane: Entity Grid */}
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colorBgContainer }}>
                        <EntityManager
                          selectedEntityUri={activeResourceUri}
                          onRowSelect={(entity) => {
                            // Build URI from entity and current branch
                            if (entity) {
                              const uri = buildUbosUri(entity.entityType, entity.slug, currentBranch)
                              setActiveResourceUri(uri)
                            } else {
                              setActiveResourceUri(null)
                            }
                          }}
                          currentBranch={currentBranch}
                          onBranchChange={handleBranchChange}
                          editedSnapshotData={editedSnapshotData}
                          entityTypeFilter={selectedEntityType}
                        />
                      </div>

            {/* Right Pane: Code Inspector - Enhanced */}
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colorBgContainer }}>
              {/* Metadata Bar - Full UBOS URI - Enhanced */}
              {activeResourceUri ? (
                <div
                  style={{
                    padding: '14px 20px',
                    background: `linear-gradient(135deg, ${colorBgElevated} 0%, ${colorBgContainer} 100%)`,
                    borderBottom: `1px solid ${colorBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(74, 158, 255, 0.1)',
                      borderRadius: '4px',
                      border: `1px solid rgba(74, 158, 255, 0.2)`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: colorPrimary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      URI
                    </Text>
                  </div>
                  <Input
                    readOnly
                    value={currentUri}
                    style={{
                      fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
                      fontSize: '13px',
                      flex: 1,
                      background: colorBgContainer,
                      border: `1px solid ${colorBorder}`,
                      color: colorText,
                      fontWeight: 400,
                    }}
                    suffix={
                      <Button
                        type="text"
                        size="small"
                        icon={uriCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        onClick={handleCopyUri}
                        style={{
                          fontSize: '12px',
                          color: uriCopied ? colorPrimary : colorTextSecondary,
                          minWidth: 'auto',
                        }}
                      >
                        {uriCopied ? 'Copied' : 'Copy'}
                      </Button>
                    }
                  />
                  {hasChanges && (
                    <Badge
                      status="processing"
                      text={
                        <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
                          Modified
                        </Text>
                      }
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px 20px',
                    background: colorBgElevated,
                    borderBottom: `1px solid ${colorBorder}`,
                    textAlign: 'center',
                  }}
                >
                  <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>
                    Select an entity to view and edit
                  </Text>
                </div>
              )}

              {/* Monaco Editor - Full Height */}
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <SnapshotEditor
                  activeUri={activeResourceUri}
                  onSnapshotChange={handleSnapshotChange}
                  hideHeader={true}
                />
              </div>

              {/* Action Bar - Commit Message & Button - Enhanced */}
              <div
                style={{
                  padding: '16px 20px',
                  background: `linear-gradient(180deg, ${colorBgContainer} 0%, ${colorBgElevated} 100%)`,
                  borderTop: `1px solid ${colorBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Input
                  placeholder="Enter commit message..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onPressEnter={handleCommit}
                  style={{ flex: 1 }}
                  disabled={!activeResourceUri}
                  prefix={
                    <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>💬</Text>
                  }
                />
                <Button
                  type="primary"
                  onClick={handleCommit}
                  loading={isCommitting}
                  disabled={!activeResourceUri || !hasChanges}
                  style={{
                    minWidth: 140,
                    height: 36,
                    fontWeight: 500,
                    boxShadow: hasChanges ? `0 2px 8px rgba(74, 158, 255, 0.3)` : 'none',
                  }}
                  icon={<CheckCircle2 size={16} />}
                >
                  {isCommitting ? 'Committing...' : 'Commit Changes'}
                </Button>
              </div>
            </div>
          </SplitPane>
          )}
        </Content>
      </Layout>

      {/* Search Results Modal */}
      <SearchResultsModal
        open={searchModalOpen}
        onCancel={() => setSearchModalOpen(false)}
        results={searchResults}
        isLoading={isSearching}
        searchQuery={searchQuery}
        onResultClick={handleSearchResultClick}
      />
    </Layout>
  )
}
