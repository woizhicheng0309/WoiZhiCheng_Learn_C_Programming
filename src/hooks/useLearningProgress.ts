import { useCallback, useEffect, useState } from 'react'
import type { LoopConfig } from '../domain'
import type { ChallengeId } from '../data'
import {
  clearProgress,
  createDefaultProgress,
  loadProgress,
  PROGRESS_STORAGE_KEY,
  saveProgress,
  type ProgressV1,
} from '../state'

type ProgressUpdater = (current: ProgressV1) => ProgressV1

export function useLearningProgress() {
  const [progress, setProgress] = useState<ProgressV1>(() => loadProgress())

  useEffect(() => {
    const syncProgress = (event: StorageEvent) => {
      if (event.key === PROGRESS_STORAGE_KEY) setProgress(loadProgress())
    }
    window.addEventListener('storage', syncProgress)
    return () => window.removeEventListener('storage', syncProgress)
  }, [])

  const updateProgress = useCallback((updater: ProgressUpdater) => {
    setProgress((current) => {
      const next = updater(current)
      saveProgress(next)
      return next
    })
  }, [])

  const markGuidedRunCompleted = useCallback(() => {
    updateProgress((current) => ({ ...current, guidedRunCompleted: true }))
  }, [updateProgress])

  const markChallengeCompleted = useCallback((id: ChallengeId) => {
    updateProgress((current) => {
      if (current.completedChallengeIds.includes(id)) return current
      return {
        ...current,
        completedChallengeIds: [...current.completedChallengeIds, id],
      }
    })
  }, [updateProgress])

  const rememberConfig = useCallback((config: LoopConfig) => {
    updateProgress((current) => ({ ...current, lastConfig: { ...config } }))
  }, [updateProgress])

  const resetProgress = useCallback(() => {
    clearProgress()
    const fresh = createDefaultProgress()
    setProgress(fresh)
    return fresh
  }, [])

  return {
    progress,
    updateProgress,
    markGuidedRunCompleted,
    markChallengeCompleted,
    rememberConfig,
    resetProgress,
  }
}
