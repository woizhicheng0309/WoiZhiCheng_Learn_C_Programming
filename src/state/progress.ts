import { COMPARATORS, DEFAULT_LOOP_CONFIG, validateLoopConfig } from '../domain'
import type { LoopConfig } from '../domain'
import { CHALLENGE_IDS } from '../data/challenges'
import type { ChallengeId } from '../data/challenges'

export const PROGRESS_VERSION = 1 as const
export const PROGRESS_STORAGE_KEY =
  'woizhicheng-c-programming:learning-progress:v1'

export interface ProgressV1 {
  version: typeof PROGRESS_VERSION
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

export function createDefaultProgress(): ProgressV1 {
  return {
    version: PROGRESS_VERSION,
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

export function isProgressV1(value: unknown): value is ProgressV1 {
  if (!value || typeof value !== 'object') return false

  const progress = value as Record<string, unknown>
  return (
    progress.version === PROGRESS_VERSION &&
    typeof progress.guidedRunCompleted === 'boolean' &&
    Array.isArray(progress.completedChallengeIds) &&
    progress.completedChallengeIds.every(isChallengeId) &&
    new Set(progress.completedChallengeIds).size ===
      progress.completedChallengeIds.length &&
    isLoopConfig(progress.lastConfig)
  )
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
 * Load saved progress. Missing, malformed, incompatible, or inaccessible data
 * always produces a fresh default value and never prevents the lesson loading.
 */
export function loadProgress(
  storage?: ProgressStorage | null,
): ProgressV1 {
  const target = resolveStorage(storage)
  if (!target) return createDefaultProgress()

  try {
    const serialized = target.getItem(PROGRESS_STORAGE_KEY)
    if (serialized === null) return createDefaultProgress()

    const candidate: unknown = JSON.parse(serialized)
    if (!isProgressV1(candidate)) return createDefaultProgress()

    return {
      ...candidate,
      completedChallengeIds: [...candidate.completedChallengeIds],
      lastConfig: { ...candidate.lastConfig },
    }
  } catch {
    return createDefaultProgress()
  }
}

/** Return false when storage is unavailable or the value is invalid. */
export function saveProgress(
  progress: ProgressV1,
  storage?: ProgressStorage | null,
): boolean {
  const target = resolveStorage(storage)
  if (!target || !isProgressV1(progress)) return false

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
    return true
  } catch {
    return false
  }
}

export function isForLoopLessonCompleted(progress: ProgressV1): boolean {
  return CHALLENGE_IDS.every((id) => progress.completedChallengeIds.includes(id))
}
