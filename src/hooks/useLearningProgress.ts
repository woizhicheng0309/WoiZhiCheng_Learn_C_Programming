import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { LoopConfig } from '../domain'
import type { ChallengeId, LessonId } from '../data'
import {
  LEGACY_PROGRESS_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  clearProgress,
  createDefaultProgress,
  getLessonProgress as selectLessonProgress,
  isProgressV2,
  loadProgress,
  saveProgress,
  type JsonObject,
  type LessonProgress,
  type ProgressStorage,
  type ProgressV2,
} from '../state'

type ProgressUpdater = (current: ProgressV2) => ProgressV2
type LessonProgressUpdater = (current: LessonProgress) => LessonProgress

export interface ForLoopProgressView {
  guidedRunCompleted: boolean
  completedChallengeIds: string[]
  lastConfig: LoopConfig
}

export type LearningProgressView = ProgressV2 & ForLoopProgressView

export interface MarkChallengeCompleted {
  (challengeId: ChallengeId): void
  (lessonId: LessonId, challengeId: string): void
}

export interface LearningProgressContextValue {
  /** V2 progress plus read-only legacy for-loop fields during the page migration. */
  progress: LearningProgressView
  updateProgress: (updater: ProgressUpdater) => void
  getLessonProgress: (id: LessonId) => LessonProgress
  updateLessonProgress: (
    id: LessonId,
    updater: LessonProgressUpdater,
  ) => void
  markGuidedRunCompleted: (id?: LessonId) => void
  markChallengeCompleted: MarkChallengeCompleted
  rememberLessonState: (id: LessonId, state: unknown) => void
  visitLesson: (id: LessonId) => void
  /** @deprecated Prefer rememberLessonState('loops-for', config). */
  rememberConfig: (config: LoopConfig) => void
  resetProgress: () => LearningProgressView
}

export interface ProgressProviderProps {
  children: ReactNode
  /** Dependency injection for tests and non-browser renders. */
  storage?: ProgressStorage | null
}

const ProgressContext = createContext<LearningProgressContextValue | null>(null)

function toLearningProgressView(progress: ProgressV2): LearningProgressView {
  const loopProgress = selectLessonProgress(progress, 'loops-for')
  const saved = loopProgress.savedState as unknown as LoopConfig
  return {
    ...progress,
    guidedRunCompleted: loopProgress.guidedRunCompleted,
    completedChallengeIds: [...loopProgress.completedChallengeIds],
    lastConfig: { ...saved },
  }
}

export function ProgressProvider({
  children,
  storage,
}: ProgressProviderProps) {
  const [storedProgress, setStoredProgress] = useState<ProgressV2>(() =>
    loadProgress(storage),
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncProgress = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === PROGRESS_STORAGE_KEY ||
        event.key === LEGACY_PROGRESS_STORAGE_KEY
      ) {
        setStoredProgress(loadProgress(storage))
      }
    }
    window.addEventListener('storage', syncProgress)
    return () => window.removeEventListener('storage', syncProgress)
  }, [storage])

  const updateProgress = useCallback((updater: ProgressUpdater) => {
    setStoredProgress((current) => {
      const next = updater(current)
      if (next === current || !isProgressV2(next)) return current
      saveProgress(next, storage)
      return next
    })
  }, [storage])

  const getLessonProgress = useCallback(
    (id: LessonId) => selectLessonProgress(storedProgress, id),
    [storedProgress],
  )

  const updateLessonProgress = useCallback((
    id: LessonId,
    updater: LessonProgressUpdater,
  ) => {
    updateProgress((current) => {
      const currentLesson = selectLessonProgress(current, id)
      const nextLesson = updater(currentLesson)
      const next: ProgressV2 = {
        ...current,
        lessons: { ...current.lessons, [id]: nextLesson },
      }
      return isProgressV2(next) ? next : current
    })
  }, [updateProgress])

  const markGuidedRunCompleted = useCallback((id: LessonId = 'loops-for') => {
    updateLessonProgress(id, (current) => current.guidedRunCompleted
      ? current
      : { ...current, guidedRunCompleted: true })
  }, [updateLessonProgress])

  const markChallengeCompleted = useCallback((
    lessonIdOrChallengeId: LessonId | ChallengeId,
    suppliedChallengeId?: string,
  ) => {
    const lessonId = suppliedChallengeId === undefined
      ? 'loops-for'
      : lessonIdOrChallengeId as LessonId
    const challengeId = suppliedChallengeId ?? lessonIdOrChallengeId

    updateLessonProgress(lessonId, (current) => {
      if (current.completedChallengeIds.includes(challengeId)) return current
      return {
        ...current,
        completedChallengeIds: [
          ...current.completedChallengeIds,
          challengeId,
        ],
      }
    })
  }, [updateLessonProgress]) as MarkChallengeCompleted

  const rememberLessonState = useCallback((
    id: LessonId,
    state: unknown,
  ) => {
    if (
      state !== null &&
      (typeof state !== 'object' || Array.isArray(state))
    ) return
    updateLessonProgress(id, (current) => ({
      ...current,
      savedState: state === null
        ? null
        : { ...state as JsonObject },
    }))
  }, [updateLessonProgress])

  const visitLesson = useCallback((id: LessonId) => {
    updateProgress((current) => current.lastVisitedLessonId === id
      ? current
      : { ...current, lastVisitedLessonId: id })
  }, [updateProgress])

  const rememberConfig = useCallback((config: LoopConfig) => {
    rememberLessonState('loops-for', { ...config })
  }, [rememberLessonState])

  const progress = useMemo(
    () => toLearningProgressView(storedProgress),
    [storedProgress],
  )

  const resetProgress = useCallback(() => {
    clearProgress(storage)
    const fresh = createDefaultProgress()
    setStoredProgress(fresh)
    return toLearningProgressView(fresh)
  }, [storage])

  const value = useMemo<LearningProgressContextValue>(() => ({
    progress,
    updateProgress,
    getLessonProgress,
    updateLessonProgress,
    markGuidedRunCompleted,
    markChallengeCompleted,
    rememberLessonState,
    visitLesson,
    rememberConfig,
    resetProgress,
  }), [
    getLessonProgress,
    markChallengeCompleted,
    markGuidedRunCompleted,
    progress,
    rememberConfig,
    rememberLessonState,
    resetProgress,
    updateLessonProgress,
    updateProgress,
    visitLesson,
  ])

  return createElement(ProgressContext.Provider, { value }, children)
}

export function useLearningProgress(): LearningProgressContextValue {
  const value = useContext(ProgressContext)
  if (!value) {
    throw new Error('useLearningProgress 必須在 ProgressProvider 內使用。')
  }
  return value
}
