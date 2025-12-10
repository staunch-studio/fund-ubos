import { useMemo } from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { theme, Typography } from 'antd'
import type { EntitySnapshot } from '../types/ubos'

const { Text } = Typography

interface DiffViewerProps {
  snapshotA: EntitySnapshot | undefined
  snapshotB: EntitySnapshot | undefined
  isLoadingA?: boolean
  isLoadingB?: boolean
  errorA?: any
  errorB?: any
}

export function DiffViewer({
  snapshotA,
  snapshotB,
  isLoadingA = false,
  isLoadingB = false,
  errorA,
  errorB,
}: DiffViewerProps) {
  const {
    token: { colorBgContainer, colorText, colorTextSecondary, colorBorder },
  } = theme.useToken()

  // Format JSON for display
  const formatJson = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return jsonString
    }
  }

  const oldValue = useMemo(() => {
    if (!snapshotA) return ''
    return formatJson(snapshotA.snapshotData)
  }, [snapshotA])

  const newValue = useMemo(() => {
    if (!snapshotB) return ''
    return formatJson(snapshotB.snapshotData)
  }, [snapshotB])

  if (isLoadingA || isLoadingB) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: colorText,
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <Text>Loading snapshots for comparison...</Text>
        <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
          {isLoadingA && 'Loading Version A...'}
          {isLoadingB && 'Loading Version B...'}
        </Text>
      </div>
    )
  }

  if (errorA || errorB || !snapshotA || !snapshotB) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: colorText,
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <Text>Unable to load snapshots</Text>
        <Text style={{ fontSize: '12px', color: colorTextSecondary }}>
          {errorA && `Error loading Version A: ${JSON.stringify(errorA)}`}
          {errorB && `Error loading Version B: ${JSON.stringify(errorB)}`}
          {!snapshotA && !errorA && 'Version A not found'}
          {!snapshotB && !errorB && 'Version B not found'}
        </Text>
        <Text style={{ fontSize: '11px', color: colorTextSecondary, marginTop: '8px' }}>
          Please check if the backend API endpoint /api/console/snapshot/{'{commitId}'} is available
        </Text>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <ReactDiffViewer
        oldValue={oldValue}
        newValue={newValue}
        splitView={true}
        leftTitle={`Version A (Commit #${snapshotA.commitId})`}
        rightTitle={`Version B (Commit #${snapshotB.commitId})`}
        styles={{
          variables: {
            light: {
              diffViewerBackground: colorBgContainer,
              diffViewerColor: colorText,
              addedBackground: 'rgba(63, 185, 80, 0.15)',
              addedColor: '#3FB950',
              removedBackground: 'rgba(248, 81, 73, 0.15)',
              removedColor: '#F85149',
              wordAddedBackground: 'rgba(63, 185, 80, 0.3)',
              wordRemovedBackground: 'rgba(248, 81, 73, 0.3)',
              codeFoldGutterBackground: colorBgContainer,
              codeFoldBackground: colorBgContainer,
              emptyLineBackground: colorBgContainer,
              gutterBackground: colorBgContainer,
              gutterBackgroundDark: colorBgContainer,
              highlightBackground: 'rgba(74, 158, 255, 0.2)',
              highlightGutterBackground: 'rgba(74, 158, 255, 0.1)',
            },
          },
          contentText: {
            fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
            fontSize: '13px',
          },
        }}
        useDarkTheme={true}
        hideLineNumbers={false}
        showDiffOnly={false}
      />
    </div>
  )
}

