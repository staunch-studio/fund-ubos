import { useState, useMemo, useCallback } from 'react'
import { Card, Button, Space, Typography, theme, message, Divider, Tag } from 'antd'
import Editor from '@monaco-editor/react'
import type { MergeConflictObject, ConflictField, ResolveConflictRequest } from '../types/ubos'
import { useResolveConflictMutation } from '../store/ubosApi'
import { CheckCircle2, ArrowLeft, ArrowRight, GitMerge, Save } from 'lucide-react'

const { Text, Title } = Typography

interface MergeConflictResolverProps {
  conflictObject: MergeConflictObject
  onResolve?: (resolvedData: Record<string, any>, message?: string) => Promise<void>
  onCancel?: () => void
  onSuccess?: () => void
  currentBranchName?: string
  incomingBranchName?: string
}

// Helper function to get value at a JSON path
function getValueAtPath(obj: any, path: string): any {
  if (!path || path === '/') return obj
  const keys = path.split('/').filter((k) => k)
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    current = current[key]
  }
  return current
}

// Helper function to set value at a JSON path
function setValueAtPath(obj: any, path: string, value: any): any {
  const result = JSON.parse(JSON.stringify(obj)) // Deep clone
  if (!path || path === '/') return value

  const keys = path.split('/').filter((k) => k)
  let current = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (current[key] === null || current[key] === undefined) {
      current[key] = {}
    }
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
  return result
}

// Helper function to find all conflicting paths in JSON
function findConflictPaths(
  base: any,
  ours: any,
  theirs: any,
  currentPath: string = '',
  conflicts: ConflictField[] = []
): ConflictField[] {
  // If both are primitives and different, it's a conflict
  if (typeof ours !== 'object' && typeof theirs !== 'object') {
    if (JSON.stringify(ours) !== JSON.stringify(theirs)) {
      conflicts.push({
        path: currentPath || '/',
        base: base,
        ours: ours,
        theirs: theirs,
      })
    }
    return conflicts
  }

  // If one is object and other is not, it's a conflict
  if (
    (typeof ours === 'object' && ours !== null && typeof theirs !== 'object') ||
    (typeof theirs === 'object' && theirs !== null && typeof ours !== 'object')
  ) {
    conflicts.push({
      path: currentPath || '/',
      base: base,
      ours: ours,
      theirs: theirs,
    })
    return conflicts
  }

  // Both are objects, recurse
  if (typeof ours === 'object' && ours !== null && typeof theirs === 'object' && theirs !== null) {
    const allKeys = new Set([...Object.keys(ours), ...Object.keys(theirs)])
    for (const key of allKeys) {
      const newPath = currentPath ? `${currentPath}/${key}` : `/${key}`
      const baseValue = base && typeof base === 'object' && base !== null ? base[key] : undefined
      findConflictPaths(baseValue, ours[key], theirs[key], newPath, conflicts)
    }
  }

  return conflicts
}

// Helper function to highlight conflicts in JSON string
function highlightConflicts(
  jsonString: string,
  conflicts: ConflictField[],
  highlightColor: string
): string {
  // This is a simplified version - Monaco Editor will handle syntax highlighting
  // We'll use Monaco's marker API for actual highlighting
  return jsonString
}

export function MergeConflictResolver({
  conflictObject,
  onResolve,
  onCancel,
  onSuccess,
  currentBranchName = 'Current Branch',
  incomingBranchName = 'Incoming Branch',
}: MergeConflictResolverProps) {
  const [resolveConflict, { isLoading: isResolving }] = useResolveConflictMutation()
  const {
    token: {
      colorBgContainer,
      colorBgElevated,
      colorText,
      colorTextSecondary,
      colorBorder,
      colorPrimary,
      colorSuccess,
      colorError,
      colorInfo,
    },
  } = theme.useToken()

  // Parse JSON snapshots
  const baseJson = useMemo(() => {
    try {
      return conflictObject.baseSnapshot ? JSON.parse(conflictObject.baseSnapshot) : {}
    } catch {
      return {}
    }
  }, [conflictObject.baseSnapshot])

  const oursJson = useMemo(() => {
    try {
      return conflictObject.oursSnapshot ? JSON.parse(conflictObject.oursSnapshot) : {}
    } catch {
      return {}
    }
  }, [conflictObject.oursSnapshot])

  const theirsJson = useMemo(() => {
    try {
      return conflictObject.theirsSnapshot ? JSON.parse(conflictObject.theirsSnapshot) : {}
    } catch {
      return {}
    }
  }, [conflictObject.theirsSnapshot])

  // Detect conflicts if not provided
  const detectedConflicts = useMemo(() => {
    if (conflictObject.conflicts && conflictObject.conflicts.length > 0) {
      return conflictObject.conflicts
    }
    return findConflictPaths(baseJson, oursJson, theirsJson)
  }, [conflictObject.conflicts, baseJson, oursJson, theirsJson])

  // Initialize resolved data with ours (current branch)
  const [resolvedData, setResolvedData] = useState<Record<string, any>>(() => {
    return JSON.parse(JSON.stringify(oursJson))
  })

  // Format JSON for display
  const formatJson = (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return '{}'
    }
  }

  const oursFormatted = formatJson(oursJson)
  const theirsFormatted = formatJson(theirsJson)
  const resolvedFormatted = formatJson(resolvedData)

  // Handle Accept Ours
  const handleAcceptOurs = useCallback(
    (conflict: ConflictField) => {
      const newResolved = setValueAtPath(resolvedData, conflict.path, conflict.ours)
      setResolvedData(newResolved)
      message.success(`Accepted "Ours" for ${conflict.path}`)
    },
    [resolvedData]
  )

  // Handle Accept Theirs
  const handleAcceptTheirs = useCallback(
    (conflict: ConflictField) => {
      const newResolved = setValueAtPath(resolvedData, conflict.path, conflict.theirs)
      setResolvedData(newResolved)
      message.success(`Accepted "Theirs" for ${conflict.path}`)
    },
    [resolvedData]
  )

  // Handle manual edit in resolved editor
  const handleResolvedChange = useCallback((value: string | undefined) => {
    if (!value) return
    try {
      const parsed = JSON.parse(value)
      setResolvedData(parsed)
    } catch {
      // Invalid JSON, ignore
    }
  }, [])

  // Handle resolve and commit
  const handleResolve = useCallback(async () => {
    try {
      if (onResolve) {
        // Use custom onResolve if provided
        await onResolve(resolvedData)
      } else {
        // Use API mutation
        const result = await resolveConflict({
          slug: conflictObject.slug,
          type: conflictObject.type,
          branch: conflictObject.branch,
          resolvedData: resolvedData,
          message: `Resolved merge conflict for ${conflictObject.slug}`,
        }).unwrap()

        if (result.success) {
          message.success('Conflict resolved and committed successfully')
          onSuccess?.()
        } else {
          message.error(result.message || 'Failed to resolve conflict')
        }
      }
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to resolve conflict'
      message.error(errorMessage)
    }
  }, [resolvedData, onResolve, resolveConflict, conflictObject, onSuccess])

  // Monaco Editor options
  const editorOptions = {
    readOnly: false,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on' as const,
    wordWrap: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
  }

  const oursEditorOptions = {
    ...editorOptions,
    readOnly: true,
  }

  const theirsEditorOptions = {
    ...editorOptions,
    readOnly: true,
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colorBgContainer,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${colorBorder}`,
          background: colorBgElevated,
        }}
      >
        <Space>
          <GitMerge size={20} color={colorPrimary} />
          <Title level={4} style={{ margin: 0, color: colorText }}>
            Resolve Merge Conflicts
          </Title>
        </Space>
        <div style={{ marginTop: '8px' }}>
          <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>
            Entity: <Text strong>{conflictObject.slug}</Text> ({conflictObject.type}) | Branch:{' '}
            <Text strong>{conflictObject.branch}</Text>
          </Text>
        </div>
        {detectedConflicts.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <Tag color="error">
              {detectedConflicts.length} conflict{detectedConflicts.length > 1 ? 's' : ''} detected
            </Tag>
          </div>
        )}
      </div>

      {/* Conflict List */}
      {detectedConflicts.length > 0 && (
        <div
          style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${colorBorder}`,
            background: 'rgba(250, 173, 20, 0.1)',
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          <Text strong style={{ color: colorText, fontSize: '13px', display: 'block', marginBottom: '8px' }}>
            Conflicting Fields:
          </Text>
          <Space wrap size={[8, 8]}>
            {detectedConflicts.map((conflict, index) => {
              const currentValue = getValueAtPath(resolvedData, conflict.path)
              const isOurs = JSON.stringify(currentValue) === JSON.stringify(conflict.ours)
              const isTheirs = JSON.stringify(currentValue) === JSON.stringify(conflict.theirs)

              return (
                <Card
                  key={index}
                  size="small"
                  style={{
                    border: `1px solid ${isOurs ? colorSuccess : isTheirs ? colorInfo : colorBorder}`,
                    background: isOurs
                      ? 'rgba(82, 196, 26, 0.1)'
                      : isTheirs
                      ? 'rgba(24, 144, 255, 0.1)'
                      : colorBgContainer,
                  }}
                  bodyStyle={{ padding: '8px 12px' }}
                >
                  <Space direction="vertical" size={4}>
                    <Text
                      style={{
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: colorText,
                        fontWeight: 500,
                      }}
                    >
                      {conflict.path || '/'}
                    </Text>
                    <Space size={4}>
                      <Button
                        size="small"
                        type={isOurs ? 'primary' : 'default'}
                        icon={<ArrowLeft size={12} />}
                        onClick={() => handleAcceptOurs(conflict)}
                        style={{
                          background: isOurs ? colorSuccess : undefined,
                          borderColor: isOurs ? colorSuccess : undefined,
                        }}
                      >
                        Ours
                      </Button>
                      <Button
                        size="small"
                        type={isTheirs ? 'primary' : 'default'}
                        icon={<ArrowRight size={12} />}
                        onClick={() => handleAcceptTheirs(conflict)}
                        style={{
                          background: isTheirs ? colorInfo : undefined,
                          borderColor: isTheirs ? colorInfo : undefined,
                        }}
                      >
                        Theirs
                      </Button>
                    </Space>
                  </Space>
                </Card>
              )
            })}
          </Space>
        </div>
      )}

      {/* Three Column Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Current Branch (Ours) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${colorBorder}`,
            background: 'rgba(82, 196, 26, 0.05)',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${colorBorder}`,
              background: 'rgba(82, 196, 26, 0.1)',
            }}
          >
            <Space>
              <CheckCircle2 size={16} color={colorSuccess} />
              <Text strong style={{ color: colorText }}>
                {currentBranchName} (Ours)
              </Text>
            </Space>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              language="json"
              value={oursFormatted}
              options={oursEditorOptions}
              theme="vs-dark"
              onChange={() => {}} // Read-only
            />
          </div>
        </div>

        {/* Center: Final Result (Editable) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${colorBorder}`,
            background: colorBgContainer,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${colorBorder}`,
              background: colorBgElevated,
            }}
          >
            <Text strong style={{ color: colorText }}>
              Final Result (Editable)
            </Text>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              language="json"
              value={resolvedFormatted}
              options={editorOptions}
              theme="vs-dark"
              onChange={handleResolvedChange}
            />
          </div>
        </div>

        {/* Right: Incoming Branch (Theirs) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(24, 144, 255, 0.05)',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${colorBorder}`,
              background: 'rgba(24, 144, 255, 0.1)',
            }}
          >
            <Space>
              <CheckCircle2 size={16} color={colorInfo} />
              <Text strong style={{ color: colorText }}>
                {incomingBranchName} (Theirs)
              </Text>
            </Space>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              language="json"
              value={theirsFormatted}
              options={theirsEditorOptions}
              theme="vs-dark"
              onChange={() => {}} // Read-only
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: `1px solid ${colorBorder}`,
          background: colorBgElevated,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button onClick={onCancel}>Cancel</Button>
        <Space>
          <Button
            type="primary"
            icon={<Save size={16} />}
            onClick={handleResolve}
            disabled={detectedConflicts.length === 0}
            loading={isResolving}
          >
            Resolve & Commit
          </Button>
        </Space>
      </div>
    </div>
  )
}

