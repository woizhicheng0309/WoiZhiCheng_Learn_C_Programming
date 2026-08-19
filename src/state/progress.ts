import { COMPARATORS, DEFAULT_LOOP_CONFIG, validateLoopConfig } from '../domain'
import type { LoopConfig } from '../domain'
import { CHALLENGE_IDS } from '../data/challenges'
import type { ChallengeId } from '../data/challenges'
import type { LessonId } from '../data/lessons'

export const PROGRESS_VERSION = 2 as const
export const PROGRESS_STORAGE_KEY =
  'woizhicheng-c-programming:learning-progress:v2'
export const LEGACY_PROGRESS_STORAGE_KEY =
  'woizhicheng-c-programming:learning-progress:v1'

export const FOUNDATION_LESSON_IDS = ['variables', 'conditionals'] as const
export type FoundationLessonId = (typeof FOUNDATION_LESSON_IDS)[number]

export interface ProgressV2 {
  version: typeof PROGRESS_VERSION
  completedLessonIds: FoundationLessonId[]
  guidedRunCompleted: boolean
  completedChallengeIds: ChallengeId[]
  lastConfig: LoopConfig
}

interface LegacyProgressV1 {
  version: 1
  guidedRunCompleted: boolean
  completedChallengeIds: ChallengeId[]
  lastConfig: LoopConfig
}

interface ProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const challengeIdSet = new Set<string>(CHALLENGE_IDS)
const foundationLessonIdSet = new Set<string>(FOUNDATION_LESSON_IDS)

export function createDefaultProgress(): ProgressV2 {
  return {
    version: PROGRESS_VERSION,
    completedLessonIds: [],
    guidedRunCompleted: false,
    completedChallengeIds: [],
    lastConfig: { ...DEFAULT_LOOP_CONFIG },
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isLoopConfig(value: unknown): value is LoopConfig {
  if (!value || typeof value !== 'object') return false

  const config = value as Record<string, unknown>
  return (
    isFiniteNumber(config.start) &&
    isFiniteNumber(config.end) &&
    typeof config.comparator === 'string' &&
    COMPARATORS.includes(config.comparator as (typeof COMPARATORS)[number]) &&
    isFiniteNumber(config.step) &&
    validateLoopConfig(config as unknown as LoopConfig).length === 0
  )
}

function isChallengeId(value: unknown): value is ChallengeId {
  return typeof value === 'string' && challengeIdSet.has(value)
}

function isFoundationLessonId(value: unknown): value is FoundationLessonId {
  return typeof value === 'string' && foundationLessonIdSet.has(value)
}

function hasUniqueValues(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length
}

export function isProgressV2(value: unknown): value is ProgressV2 {
  if (!value || typeof value !== 'object') return false

  const progress = value as Record<string, unknown>
  return (
    progress.version === PROGRESS_VERSION &&
    Array.isArray(progress.completedLessonIds) &&
    progress.completedLessonIds.every(isFoundationLessonId) &&
    hasUniqueValues(progress.completedLessonIds) &&
    typeof progress.guidedRunCompleted === 'boolean' &&
    Array.isArray(progress.completedChallengeIds) &&
    progress.completedChallengeIds.every(isChallengeId) &&
    hasUniqueValues(progress.completedChallengeIds) &&
    isLoopConfig(progress.lastConfig)
  )
}

function isLegacyProgressV1(value: unknown): value is LegacyProgressV1 {
  if (!value || typeof value !== 'object') return false

  const progress = value as Record<string, unknown>
  return (
    progress.version === 1 &&
    typeof progress.guidedRunCompleted === 'boolean' &&
    Array.isArray(progress.completedChallengeIds) &&
    progress.completedChallengeIds.every(isChallengeId) &&
    hasUniqueValues(progress.completedChallengeIds) &&
    isLoopConfig(progress.lastConfig)
  )
}

function cloneProgress(progress: ProgressV2): ProgressV2 {
  return {
    ...progress,
    completedLessonIds: [...progress.completedLessonIds],
    completedChallengeIds: [...progress.completedChallengeIds],
    lastConfig: { ...progress.lastConfig },
  }
}

function resolveStorage(
  suppliedStorage?: ProgressStorage | null,
): ProgressStorage | null {
  if (suppliedStorage !== undefined) return suppliedStorage

  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Load saved progress. Version 1 data is migrated in memory so existing for-loop
 * progress remains available after the two foundation lessons are added.
 */
export function loadProgress(
  storage?: ProgressStorage | null,
): ProgressV2 {
  const target = resolveStorage(storage)
  if (!target) return createDefaultProgress()

  try {
    const serialized = target.getItem(PROGRESS_STORAGE_KEY)
    if (serialized !== null) {
      const candidate: unknown = JSON.parse(serialized)
      if (isProgressV2(candidate)) return cloneProgress(candidate)
    }

    const legacySerialized = target.getItem(LEGACY_PROGRESS_STORAGE_KEY)
    if (legacySerialized === null) return createDefaultProgress()

    const legacyCandidate: unknown = JSON.parse(legacySerialized)
    if (!isLegacyProgressV1(legacyCandidate)) return createDefaultProgress()

    return {
      version: PROGRESS_VERSION,
      completedLessonIds: [],
      guidedRunCompleted: legacyCandidate.guidedRunCompleted,
      completedChallengeIds: [...legacyCandidate.completedChallengeIds],
      lastConfig: { ...legacyCandidate.lastConfig },
    }
  } catch {
    return createDefaultProgress()
  }
}

/** Return false when storage is unavailable or the value is invalid. */
export function saveProgress(
  progress: ProgressV2,
  storage?: ProgressStorage | null,
): boolean {
  const target = resolveStorage(storage)
  if (!target || !isProgressV2(progress)) return false

  try {
    target.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

/** Return false when storage is unavailable; clearing missing data still succeeds. */
export function clearProgress(storage?: ProgressStorage | null): boolean {
  const target = resolveStorage(storage)
  if (!target) return false

  try {
    target.removeItem(PROGRESS_STORAGE_KEY)
    target.removeItem(LEGACY_PROGRESS_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function isForLoopLessonCompleted(progress: ProgressV2): boolean {
  return CHALLENGE_IDS.every((id) => progress.completedChallengeIds.includes(id))
}

export function isLessonCompleted(
  progress: ProgressV2,
  lessonId: LessonId,
): boolean {
  if (lessonId === 'loops') return isForLoopLessonCompleted(progress)
  if (isFoundationLessonId(lessonId)) {
    return progress.completedLessonIds.includes(lessonId)
  }
  return false
}
