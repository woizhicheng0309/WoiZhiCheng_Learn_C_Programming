import {
  COMPARATORS,
  CONDITIONAL_LIMITS,
  CONDITIONAL_LOGICAL_OPERATORS,
  DEFAULT_CONDITIONAL_CONFIG,
  DEFAULT_LOOP_CONFIG,
  validateLoopConfig,
} from '../domain'
import type { ConditionalConfig, LoopConfig } from '../domain'
import {
  LESSONS,
  getLessonById,
  isLessonAvailable,
  isLessonId,
} from '../data/lessons'
import type {
  LessonDefinition,
  LessonId,
  LessonProgressStatus,
} from '../data/lessons'
import { CHALLENGE_IDS } from '../data/challenges'
import type { ChallengeId } from '../data/challenges'

export const PROGRESS_VERSION = 2 as const
export const PROGRESS_STORAGE_KEY =
  'woizhicheng-c-programming:learning-progress:v2'
export const LEGACY_PROGRESS_STORAGE_KEY =
  'woizhicheng-c-programming:learning-progress:v1'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export type VariableValueType = 'int' | 'double'
export type VariableOperator = '+' | '-' | '*' | '/' | '%'

export interface VariableBasicsSavedState extends JsonObject {
  valueType: VariableValueType
  x: number
  y: number
  operator: VariableOperator
}

export interface ConditionalSavedState extends JsonObject {
  score: number
  attendance: number
  logicalOperator: ConditionalConfig['logicalOperator']
}

export interface LessonProgress {
  guidedRunCompleted: boolean
  completedChallengeIds: string[]
  savedState: JsonObject | null
}

export interface ProgressV2 {
  version: typeof PROGRESS_VERSION
  lessons: Partial<Record<LessonId, LessonProgress>>
  lastVisitedLessonId: LessonId | null
}

/** The shape saved by the original for-loop-only release. */
export interface ProgressV1 {
  version: 1
  guidedRunCompleted: boolean
  completedChallengeIds: ChallengeId[]
  lastConfig: LoopConfig
}

export interface CourseProgressSummary {
  completedLessons: number
  totalLessons: number
  completedChallenges: number
  totalChallenges: number
  percentage: number
}

export interface ProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const variableOperators: readonly VariableOperator[] = ['+', '-', '*', '/', '%']
const loopChallengeIdSet = new Set<string>(CHALLENGE_IDS)

export const DEFAULT_VARIABLE_BASICS_STATE: Readonly<VariableBasicsSavedState> = {
  valueType: 'int',
  x: 5,
  y: 2,
  operator: '+',
}

export const DEFAULT_CONDITIONAL_STATE: Readonly<ConditionalSavedState> = {
  ...DEFAULT_CONDITIONAL_CONFIG,
}

export function createDefaultProgress(): ProgressV2 {
  return {
    version: PROGRESS_VERSION,
    lessons: {},
    lastVisitedLessonId: null,
  }
}

export function createDefaultLessonProgress(id: LessonId): LessonProgress {
  return {
    guidedRunCompleted: false,
    completedChallengeIds: [],
    savedState: createDefaultSavedState(id),
  }
}

export function createDefaultSavedState(id: LessonId): JsonObject | null {
  if (id === 'variables-basics') return { ...DEFAULT_VARIABLE_BASICS_STATE }
  if (id === 'conditionals-if-else') return { ...DEFAULT_CONDITIONAL_STATE }
  if (id === 'loops-for') return { ...DEFAULT_LOOP_CONFIG }
  return null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isLoopConfig(value: unknown): value is LoopConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

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

function isHalfStep(value: number): boolean {
  return Number.isInteger(value * 2)
}

export function isVariableBasicsSavedState(
  value: unknown,
): value is VariableBasicsSavedState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const state = value as Record<string, unknown>
  if (
    state.valueType !== 'int' &&
    state.valueType !== 'double'
  ) return false

  if (
    !isFiniteNumber(state.x) ||
    !isFiniteNumber(state.y) ||
    state.x < -20 ||
    state.x > 20 ||
    state.y < -20 ||
    state.y > 20 ||
    !isHalfStep(state.x) ||
    !isHalfStep(state.y) ||
    typeof state.operator !== 'string' ||
    !variableOperators.includes(state.operator as VariableOperator)
  ) return false

  return state.valueType !== 'int' ||
    (Number.isInteger(state.x) && Number.isInteger(state.y))
}

export function isConditionalSavedState(
  value: unknown,
): value is ConditionalSavedState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const state = value as Record<string, unknown>
  return (
    isFiniteNumber(state.score) &&
    Number.isInteger(state.score) &&
    state.score >= CONDITIONAL_LIMITS.score.min &&
    state.score <= CONDITIONAL_LIMITS.score.max &&
    isFiniteNumber(state.attendance) &&
    Number.isInteger(state.attendance) &&
    state.attendance >= CONDITIONAL_LIMITS.attendance.min &&
    state.attendance <= CONDITIONAL_LIMITS.attendance.max &&
    typeof state.logicalOperator === 'string' &&
    CONDITIONAL_LOGICAL_OPERATORS.includes(
      state.logicalOperator as ConditionalConfig['logicalOperator'],
    )
  )
}

export function isSavedStateForLesson(
  id: LessonId,
  value: unknown,
): value is JsonObject | null {
  if (id === 'variables-basics') return isVariableBasicsSavedState(value)
  if (id === 'conditionals-if-else') return isConditionalSavedState(value)
  if (id === 'loops-for') return isLoopConfig(value)
  return value === null
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

function cloneLessonProgress(progress: LessonProgress): LessonProgress {
  return {
    guidedRunCompleted: progress.guidedRunCompleted,
    completedChallengeIds: [...progress.completedChallengeIds],
    savedState: progress.savedState === null
      ? null
      : cloneJsonObject(progress.savedState),
  }
}

export function cloneProgress(progress: ProgressV2): ProgressV2 {
  const lessons: ProgressV2['lessons'] = {}
  for (const id of Object.keys(progress.lessons) as LessonId[]) {
    const lessonProgress = progress.lessons[id]
    if (lessonProgress) lessons[id] = cloneLessonProgress(lessonProgress)
  }
  return {
    version: PROGRESS_VERSION,
    lessons,
    lastVisitedLessonId: progress.lastVisitedLessonId,
  }
}

function hasValidChallengeIds(
  lesson: LessonDefinition,
  ids: unknown,
): ids is string[] {
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    return false
  }
  const allowed = new Set(lesson.requiredChallengeIds)
  return (
    new Set(ids).size === ids.length && ids.every((id) => allowed.has(id))
  )
}

function isLessonProgressFor(
  id: LessonId,
  value: unknown,
): value is LessonProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const lesson = getLessonById(id)
  if (!lesson) return false

  const progress = value as Record<string, unknown>
  return (
    typeof progress.guidedRunCompleted === 'boolean' &&
    hasValidChallengeIds(lesson, progress.completedChallengeIds) &&
    isSavedStateForLesson(id, progress.savedState)
  )
}

export function isProgressV1(value: unknown): value is ProgressV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const progress = value as Record<string, unknown>
  return (
    progress.version === 1 &&
    typeof progress.guidedRunCompleted === 'boolean' &&
    Array.isArray(progress.completedChallengeIds) &&
    progress.completedChallengeIds.every(
      (id) => typeof id === 'string' && loopChallengeIdSet.has(id),
    ) &&
    new Set(progress.completedChallengeIds).size ===
      progress.completedChallengeIds.length &&
    isLoopConfig(progress.lastConfig)
  )
}

export function isProgressV2(value: unknown): value is ProgressV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const progress = value as Record<string, unknown>
  if (
    progress.version !== PROGRESS_VERSION ||
    !progress.lessons ||
    typeof progress.lessons !== 'object' ||
    Array.isArray(progress.lessons) ||
    !(progress.lastVisitedLessonId === null ||
      isLessonId(progress.lastVisitedLessonId))
  ) return false

  return Object.entries(progress.lessons).every(
    ([id, lessonProgress]) =>
      isLessonId(id) && isLessonProgressFor(id, lessonProgress),
  )
}

function normalizeProgressV2(value: unknown): ProgressV2 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (
    candidate.version !== PROGRESS_VERSION ||
    !candidate.lessons ||
    typeof candidate.lessons !== 'object' ||
    Array.isArray(candidate.lessons)
  ) return null

  const rawLessons = candidate.lessons as Record<string, unknown>
  const lessons: ProgressV2['lessons'] = {}
  for (const id of LESSONS.map((lesson) => lesson.id)) {
    if (!(id in rawLessons)) continue
    lessons[id] = isLessonProgressFor(id, rawLessons[id])
      ? cloneLessonProgress(rawLessons[id])
      : createDefaultLessonProgress(id)
  }

  return {
    version: PROGRESS_VERSION,
    lessons,
    lastVisitedLessonId: isLessonId(candidate.lastVisitedLessonId)
      ? candidate.lastVisitedLessonId
      : null,
  }
}

export function migrateProgressV1(progress: ProgressV1): ProgressV2 {
  return {
    version: PROGRESS_VERSION,
    lessons: {
      'loops-for': {
        guidedRunCompleted: progress.guidedRunCompleted,
        completedChallengeIds: [...progress.completedChallengeIds],
        savedState: { ...progress.lastConfig },
      },
    },
    lastVisitedLessonId: 'loops-for',
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
 * Load V2 progress and salvage valid lessons independently. When no V2 value
 * exists, a valid V1 value is migrated atomically: V1 is removed only after
 * writing V2 succeeds.
 */
export function loadProgress(
  storage?: ProgressStorage | null,
): ProgressV2 {
  const target = resolveStorage(storage)
  if (!target) return createDefaultProgress()

  try {
    const serialized = target.getItem(PROGRESS_STORAGE_KEY)
    if (serialized !== null) {
      const normalized = normalizeProgressV2(JSON.parse(serialized))
      return normalized ?? createDefaultProgress()
    }

    const legacySerialized = target.getItem(LEGACY_PROGRESS_STORAGE_KEY)
    if (legacySerialized === null) return createDefaultProgress()

    const legacyCandidate: unknown = JSON.parse(legacySerialized)
    if (!isProgressV1(legacyCandidate)) return createDefaultProgress()

    const migrated = migrateProgressV1(legacyCandidate)
    try {
      target.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(migrated))
      target.removeItem(LEGACY_PROGRESS_STORAGE_KEY)
    } catch {
      // The in-memory migration still lets the learner continue. Keeping V1
      // ensures a later load can retry without losing data.
    }
    return cloneProgress(migrated)
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

/** Clear both current and legacy keys without touching other applications. */
export function clearProgress(storage?: ProgressStorage | null): boolean {
  const target = resolveStorage(storage)
  if (!target) return false

  let succeeded = true
  for (const key of [PROGRESS_STORAGE_KEY, LEGACY_PROGRESS_STORAGE_KEY]) {
    try {
      target.removeItem(key)
    } catch {
      succeeded = false
    }
  }
  return succeeded
}

export function getLessonProgress(
  progress: ProgressV2,
  id: LessonId,
): LessonProgress {
  const lessonProgress = progress.lessons[id]
  return lessonProgress
    ? cloneLessonProgress(lessonProgress)
    : createDefaultLessonProgress(id)
}

export function isLessonCompleted(
  progress: ProgressV2,
  id: LessonId,
): boolean {
  const lesson = getLessonById(id)
  if (!lesson || lesson.requiredChallengeIds.length === 0) return false
  const completed = getLessonProgress(progress, id).completedChallengeIds
  return lesson.requiredChallengeIds.every((challengeId) =>
    completed.includes(challengeId),
  )
}

export function getLessonProgressStatus(
  progress: ProgressV2,
  id: LessonId,
): LessonProgressStatus {
  if (isLessonCompleted(progress, id)) return 'completed'
  return progress.lessons[id] || progress.lastVisitedLessonId === id
    ? 'in-progress'
    : 'not-started'
}

export function getCourseProgress(progress: ProgressV2): CourseProgressSummary {
  const availableLessons = LESSONS.filter(isLessonAvailable)
  const totalChallenges = availableLessons.reduce(
    (total, lesson) => total + lesson.requiredChallengeIds.length,
    0,
  )
  const completedChallenges = availableLessons.reduce((total, lesson) => {
    const completedIds = getLessonProgress(
      progress,
      lesson.id,
    ).completedChallengeIds
    return total + lesson.requiredChallengeIds.filter((id) =>
      completedIds.includes(id),
    ).length
  }, 0)
  const completedLessons = availableLessons.filter((lesson) =>
    isLessonCompleted(progress, lesson.id),
  ).length

  return {
    completedLessons,
    totalLessons: availableLessons.length,
    completedChallenges,
    totalChallenges,
    percentage: totalChallenges === 0
      ? 0
      : Math.round((completedChallenges / totalChallenges) * 100),
  }
}

export function getContinueLearningLesson(
  progress: ProgressV2,
): LessonDefinition | undefined {
  if (progress.lastVisitedLessonId) {
    const lastVisited = getLessonById(progress.lastVisitedLessonId)
    if (lastVisited && isLessonAvailable(lastVisited)) return lastVisited
  }

  const available = LESSONS.filter(isLessonAvailable)
  return available.find((lesson) => !isLessonCompleted(progress, lesson.id))
    ?? available[0]
}

export function getContinueLearningPath(progress: ProgressV2): string {
  return getContinueLearningLesson(progress)?.path
    ?? '/learn/variables/basics'
}

export function isForLoopLessonCompleted(progress: ProgressV2): boolean {
  return isLessonCompleted(progress, 'loops-for')
}
