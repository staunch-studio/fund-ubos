import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Slider, Switch, Tooltip, Avatar, Space, Typography, theme, Popover } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import type { HistoryRecord } from '../types/ubos'
import { GitCommit, User, Clock, Eye } from 'lucide-react'

const { Text } = Typography

interface TimeTravelSliderProps {
  history: HistoryRecord[]
  currentCommitId: number | null // Current commit ID being viewed
  onCommitChange: (commitId: number | null) => void
  snapshotData?: string // Current snapshot data (JSON string)
  onSnapshotChange?: (data: string) => void
  blameData?: Record<string, { author: string; timestamp: string; commitId: number }> // Field-level blame data
  slug?: string
  entityType?: string
  branch?: string
}

// Helper to format time ago
function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  } else {
    return 'just now'
  }
}

// Helper to get avatar color from author name
function getAvatarColor(author: string): string {
  const colors = [
    '#4A9EFF',
    '#52C41A',
    '#FAAD14',
    '#F5222D',
    '#722ED1',
    '#13C2C2',
    '#EB2F96',
    '#FA8C16',
  ]
  let hash = 0
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Helper to get initials from author name
function getInitials(author: string): string {
  const parts = author.split(/[\s._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return author.substring(0, 2).toUpperCase()
}

export function TimeTravelSlider({
  history,
  currentCommitId,
  onCommitChange,
  snapshotData,
  onSnapshotChange,
  blameData = {},
  slug,
  entityType,
  branch,
}: TimeTravelSliderProps) {
  const {
    token: {
      colorBgContainer,
      colorBgElevated,
      colorText,
      colorTextSecondary,
      colorBorder,
      colorPrimary,
      colorSuccess,
    },
  } = theme.useToken()

  const [blameMode, setBlameMode] = useState(false)
  const [hoveredCommitId, setHoveredCommitId] = useState<number | null>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  // Sort history by commitId (oldest first for timeline)
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => a.commitId - b.commitId)
  }, [history])

  // Find current index in sorted history
  const currentIndex = useMemo(() => {
    if (currentCommitId === null) return sortedHistory.length - 1
    const index = sortedHistory.findIndex((h) => h.commitId === currentCommitId)
    return index >= 0 ? index : sortedHistory.length - 1
  }, [currentCommitId, sortedHistory])

  // Calculate slider value (0 to 100)
  const sliderValue = useMemo(() => {
    if (sortedHistory.length === 0) return 0
    return (currentIndex / (sortedHistory.length - 1)) * 100
  }, [currentIndex, sortedHistory.length])

  // Handle slider change
  const handleSliderChange = useCallback(
    (value: number) => {
      const index = Math.round((value / 100) * (sortedHistory.length - 1))
      const commit = sortedHistory[index]
      if (commit) {
        onCommitChange(commit.commitId)
      }
    },
    [sortedHistory, onCommitChange]
  )

  // Handle marker click
  const handleMarkerClick = useCallback(
    (commitId: number) => {
      onCommitChange(commitId)
    },
    [onCommitChange]
  )

  // Calculate marker positions
  const markerPositions = useMemo(() => {
    if (sortedHistory.length === 0) return []
    return sortedHistory.map((commit, index) => ({
      commit,
      position: (index / (sortedHistory.length - 1)) * 100,
    }))
  }, [sortedHistory])

  if (sortedHistory.length === 0) {
    return null
  }

  return (
    <div
      style={{
        padding: '16px 24px',
        borderTop: `1px solid ${colorBorder}`,
        background: colorBgElevated,
      }}
    >
      {/* Blame Mode Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <Space>
          <Eye size={16} color={colorTextSecondary} />
          <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>Blame Mode</Text>
          <Switch checked={blameMode} onChange={setBlameMode} size="small" />
        </Space>
        {currentCommitId && (
          <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
            Viewing commit #{currentCommitId}
          </Text>
        )}
      </div>

      {/* Timeline Slider */}
      <div
        ref={sliderRef}
        style={{
          position: 'relative',
          padding: '20px 0 40px 0',
        }}
      >
        {/* Custom Slider */}
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Track */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '4px',
              background: colorBorder,
              borderRadius: '2px',
              transform: 'translateY(-50%)',
            }}
          />

          {/* Markers */}
          {markerPositions.map(({ commit, position }) => {
            const isActive = commit.commitId === currentCommitId
            const isHovered = commit.commitId === hoveredCommitId

            return (
              <Tooltip
                key={commit.commitId}
                title={
                  <div style={{ maxWidth: '300px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong style={{ color: '#fff', fontSize: '13px' }}>
                        Commit #{commit.commitId}
                      </Text>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      <Space size="small">
                        <User size={12} />
                        <Text style={{ color: '#fff', fontSize: '12px' }}>{commit.authorId}</Text>
                      </Space>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      <Space size="small">
                        <Clock size={12} />
                        <Text style={{ color: '#fff', fontSize: '12px' }}>
                          {new Date(commit.createdAt).toLocaleString()}
                        </Text>
                      </Space>
                    </div>
                    {commit.message && (
                      <div>
                        <Text style={{ color: '#fff', fontSize: '12px' }}>{commit.message}</Text>
                      </div>
                    )}
                  </div>
                }
                placement="top"
              >
                <motion.div
                  style={{
                    position: 'absolute',
                    left: `${position}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    zIndex: isActive || isHovered ? 10 : 5,
                  }}
                  onMouseEnter={() => setHoveredCommitId(commit.commitId)}
                  onMouseLeave={() => setHoveredCommitId(null)}
                  onClick={() => handleMarkerClick(commit.commitId)}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 1.1 }}
                  animate={{
                    scale: isActive ? 1.2 : isHovered ? 1.15 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <motion.div
                    style={{
                      width: isActive ? '12px' : '8px',
                      height: isActive ? '12px' : '8px',
                      borderRadius: '50%',
                      background: isActive ? colorPrimary : colorTextSecondary,
                      border: `2px solid ${colorBgContainer}`,
                      boxShadow: isActive
                        ? `0 0 0 4px rgba(74, 158, 255, 0.2)`
                        : isHovered
                        ? `0 0 0 2px rgba(74, 158, 255, 0.1)`
                        : 'none',
                    }}
                    animate={{
                      boxShadow: isActive
                        ? `0 0 0 4px rgba(74, 158, 255, 0.3)`
                        : isHovered
                        ? `0 0 0 2px rgba(74, 158, 255, 0.2)`
                        : 'none',
                    }}
                  />
                </motion.div>
              </Tooltip>
            )
          })}

          {/* Slider Handle */}
          <motion.div
            style={{
              position: 'absolute',
              left: `${sliderValue}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: colorPrimary,
              border: `3px solid ${colorBgContainer}`,
              cursor: 'grab',
              zIndex: 20,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
            drag="x"
            dragConstraints={sliderRef}
            dragElastic={0.1}
            dragMomentum={false}
            onDrag={(_, info) => {
              if (sliderRef.current) {
                const rect = sliderRef.current.getBoundingClientRect()
                const x = info.point.x - rect.left
                const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
                handleSliderChange(percentage)
              }
            }}
            whileDrag={{ scale: 1.2, cursor: 'grabbing' }}
            animate={{
              left: `${sliderValue}%`,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <GitCommit
              size={10}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
              }}
            />
          </motion.div>
        </div>

        {/* Slider Input (hidden, for accessibility) */}
        <Slider
          value={sliderValue}
          onChange={handleSliderChange}
          min={0}
          max={100}
          step={sortedHistory.length > 1 ? 100 / (sortedHistory.length - 1) : 0}
          tooltip={{ formatter: (value) => {
            const index = Math.round((value! / 100) * (sortedHistory.length - 1))
            const commit = sortedHistory[index]
            return commit ? `Commit #${commit.commitId}` : ''
          } }}
          style={{ marginTop: '8px' }}
        />
      </div>

      {/* Blame Overlay Info */}
      {blameMode && Object.keys(blameData).length > 0 && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(74, 158, 255, 0.05)',
              borderRadius: '4px',
              border: `1px solid ${colorBorder}`,
            }}
          >
            <Text strong style={{ color: colorText, fontSize: '12px', display: 'block', marginBottom: '8px' }}>
              Field-Level Blame Information
            </Text>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {Object.entries(blameData).map(([fieldPath, blame]) => (
                <div
                  key={fieldPath}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    background: colorBgContainer,
                    borderRadius: '4px',
                  }}
                >
                  <Text style={{ color: colorText, fontSize: '12px', fontFamily: 'monospace' }}>
                    {fieldPath}
                  </Text>
                  <Space size="small">
                    <Avatar
                      size="small"
                      style={{
                        background: getAvatarColor(blame.author),
                        fontSize: '10px',
                      }}
                    >
                      {getInitials(blame.author)}
                    </Avatar>
                    <Text style={{ color: colorTextSecondary, fontSize: '11px' }}>
                      {blame.author}, {formatTimeAgo(blame.timestamp)}
                    </Text>
                  </Space>
                </div>
              ))}
            </Space>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

