import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge, Button, Modal, Space, Typography, theme, message } from 'antd'
import { useGetBranchesQuery, useBatchCommitMutation, useApplyDraftMutation } from '../store/ubosApi'
import { getDraftBranchName, getCurrentUserId, isDraftBranch, isMyDraftBranch } from '../utils/draftHelpers'
import { FileEdit, Save, GitMerge } from 'lucide-react'
import type { EntityInstance } from '../types/ubos'

const { Text } = Typography

interface DraftManagerProps {
  entity: EntityInstance | null
  entityId: string // Entity ID (usually slug)
  currentBranch: string
  editedSnapshotData: string | null // Current edited snapshot data
  onDraftBranchChange?: (draftBranch: string | null) => void
  onApplyDraft?: () => void
}

/**
 * Hook to manage draft state and auto-save
 */
export function useDraftManager({
  entity,
  entityId,
  currentBranch,
  editedSnapshotData,
  onDraftBranchChange,
  onApplyDraft,
}: DraftManagerProps) {
  const {
    token: { colorWarning, colorText, colorTextSecondary },
  } = theme.useToken()

  const [draftBranch, setDraftBranch] = useState<string | null>(null)
  const [isDraftMode, setIsDraftMode] = useState(false)
  const [draftNotificationShown, setDraftNotificationShown] = useState(false)
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<string | null>(null)

  const { data: branches = [] } = useGetBranchesQuery()
  const [batchCommit, { isLoading: isAutoSaving }] = useBatchCommitMutation()
  const [applyDraft, { isLoading: isApplyingDraft }] = useApplyDraftMutation()

  // Check for existing draft branch
  useEffect(() => {
    if (!entity || !entityId) {
      setDraftBranch(null)
      setIsDraftMode(false)
      return
    }

    const userId = getCurrentUserId()
    const expectedDraftBranch = getDraftBranchName(entityId, userId)

    // Check if draft branch exists
    const existingDraft = branches.find(
      (b) => b.branchName === expectedDraftBranch && isMyDraftBranch(b.branchName, userId)
    )

    if (existingDraft && !draftNotificationShown) {
      setDraftBranch(expectedDraftBranch)
      setDraftNotificationShown(true)
      
      // Show notification
      Modal.confirm({
        title: 'Unsaved Draft Found',
        content: `You have an unsaved draft for this entity. Switch to draft branch "${expectedDraftBranch}"?`,
        okText: 'Switch to Draft',
        cancelText: 'Ignore',
        onOk: () => {
          setIsDraftMode(true)
          onDraftBranchChange?.(expectedDraftBranch)
          message.info('Switched to draft mode')
        },
        onCancel: () => {
          // User chose to ignore draft
          setDraftNotificationShown(false)
        },
      })
    } else if (!existingDraft) {
      setDraftBranch(null)
      setIsDraftMode(false)
    }
  }, [entity, entityId, branches, draftNotificationShown, onDraftBranchChange])

  // Auto-save to draft branch
  const autoSaveToDraft = useCallback(async () => {
    if (!entity || !editedSnapshotData || !isDraftMode) return
    if (editedSnapshotData === lastSavedDataRef.current) return // No changes

    try {
      const userId = getCurrentUserId()
      const draftBranchName = draftBranch || getDraftBranchName(entityId, userId)

      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: editedSnapshotData,
        },
      ])

      await batchCommit({
        slugs: [entity.slug],
        branch: draftBranchName,
        jsonPatch,
        message: `Auto-save draft: ${entity.slug}`,
      }).unwrap()

      lastSavedDataRef.current = editedSnapshotData
      
      // Set draft branch if not already set
      if (!draftBranch) {
        setDraftBranch(draftBranchName)
        setIsDraftMode(true)
        onDraftBranchChange?.(draftBranchName)
      }
    } catch (err: any) {
      console.error('Auto-save failed:', err)
      // Don't show error message for auto-save failures to avoid noise
    }
  }, [entity, editedSnapshotData, isDraftMode, draftBranch, entityId, batchCommit, onDraftBranchChange])

  // Setup auto-save timer
  useEffect(() => {
    if (!isDraftMode || !editedSnapshotData) {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer)
        setAutoSaveTimer(null)
      }
      return
    }

    // Clear existing timer
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
    }

    // Setup new timer (auto-save every 30 seconds)
    const timer = setInterval(() => {
      autoSaveToDraft()
    }, 30000)

    setAutoSaveTimer(timer)

    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [isDraftMode, editedSnapshotData, autoSaveToDraft])

  // Enable draft mode when user starts editing
  const enableDraftMode = useCallback(() => {
    if (!entity || !entityId) return

    const userId = getCurrentUserId()
    const draftBranchName = getDraftBranchName(entityId, userId)

    setDraftBranch(draftBranchName)
    setIsDraftMode(true)
    onDraftBranchChange?.(draftBranchName)
    message.info('Draft mode enabled. Changes will be auto-saved.')
  }, [entity, entityId, onDraftBranchChange])

  // Apply draft (merge to main branch)
  const handleApplyDraft = useCallback(async () => {
    if (!entity || !draftBranch) {
      message.warning('No draft to apply')
      return
    }

    try {
      const result = await applyDraft({
        draftBranch: draftBranch,
        targetBranch: currentBranch,
        slug: entity.slug,
        type: entity.entityType,
        message: `Apply draft: ${entity.slug}`,
      }).unwrap()

      if (result.success) {
        message.success('Draft applied successfully')
        
        // Clear draft state
        setDraftBranch(null)
        setIsDraftMode(false)
        setDraftNotificationShown(false)
        lastSavedDataRef.current = null
        onDraftBranchChange?.(null)
        onApplyDraft?.()
      } else {
        message.error(result.message || 'Failed to apply draft')
      }
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to apply draft'
      message.error(errorMessage)
    }
  }, [entity, draftBranch, currentBranch, applyDraft, onDraftBranchChange, onApplyDraft])

  return {
    isDraftMode,
    draftBranch,
    isAutoSaving,
    isApplyingDraft,
    enableDraftMode,
    handleApplyDraft,
  }
}

/**
 * Draft Mode Badge Component
 */
export function DraftModeBadge() {
  const {
    token: { colorWarning, colorText },
  } = theme.useToken()

  return (
    <Badge
      count="Draft"
      style={{
        backgroundColor: colorWarning,
        color: colorText,
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
      }}
    />
  )
}

/**
 * Apply Draft Button Component
 */
export function ApplyDraftButton({
  onClick,
  loading,
  disabled,
}: {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <Button
      type="primary"
      icon={<GitMerge size={16} />}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      style={{
        background: '#FA8C16',
        borderColor: '#FA8C16',
      }}
    >
      Apply Draft
    </Button>
  )
}

