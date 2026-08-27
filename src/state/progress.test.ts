import { DEFAULT_CONDITIONAL_CONFIG, DEFAULT_LOOP_CONFIG } from '../domain'
import { CHALLENGE_IDS } from '../data/challenges'
import { VARIABLE_BASICS_CHALLENGE_IDS } from '../data/lessons'
import {
  DEFAULT_CONDITIONAL_STATE,
  DEFAULT_VARIABLE_BASICS_STATE,
  LEGACY_PROGRESS_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  clearProgress,
  createDefaultLessonProgress,
  createDefaultProgress,
  getContinueLearningLesson,
  getContinueLearningPath,
  getCourseProgress,
  getLessonProgress,
  getLessonProgressStatus,
  isForLoopLessonCompleted,
  isLessonCompleted,
  isProgressV1,
  isProgressV2,
  isVariableBasicsSavedState,
  isConditionalSavedState,
  loadProgress,
  saveProgress,
  type ProgressStorage,
  type ProgressV1,
  type ProgressV2,
} from './progress'

describe('Progress V2 storage and migration', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates independent defaults for the course and each lesson', () => {
    const first = createDefaultProgress()
    const second = createDefaultProgress()
    first.lessons['loops-for'] = createDefaultLessonProgress('loops-for')
    first.lessons['loops-for']?.completedChallengeIds.push('zero-to-four')

    expect(second).toEqual({
      version: 2,
      lessons: {},
      lastVisitedLessonId: null,
    })
    expect(createDefaultLessonProgress('variables-basics').savedState)
      .toEqual(DEFAULT_VARIABLE_BASICS_STATE)
    expect(createDefaultLessonProgress('loops-for').savedState)
      .toEqual(DEFAULT_LOOP_CONFIG)
    expect(createDefaultLessonProgress('conditionals-if-else').savedState)
      .toEqual(DEFAULT_CONDITIONAL_STATE)
  })

  it('round-trips valid V2 progress through the versioned key', () => {
    const progress: ProgressV2 = {
      version: 2,
      lessons: {
        'variables-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-int-division'],
          savedState: {
            valueType: 'double', x: 2.5, y: -1, operator: '*',
          },
        },
      },
      lastVisitedLessonId: 'variables-basics',
    }

    expect(saveProgress(progress)).toBe(true)
    expect(loadProgress()).toEqual(progress)
    expect(loadProgress()).not.toBe(progress)
  })

  it('resets only a damaged lesson while preserving valid lessons', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      lessons: {
        'variables-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-int-division'],
          savedState: { valueType: 'int', x: 8, y: 2, operator: '/' },
        },
        'loops-for': {
          guidedRunCompleted: true,
          completedChallengeIds: ['unknown'],
          savedState: DEFAULT_LOOP_CONFIG,
        },
      },
      lastVisitedLessonId: 'loops-for',
    }))

    const loaded = loadProgress()
    expect(loaded.lessons['variables-basics']?.guidedRunCompleted).toBe(true)
    expect(loaded.lessons['loops-for']).toEqual(
      createDefaultLessonProgress('loops-for'),
    )
    expect(loaded.lastVisitedLessonId).toBe('loops-for')
  })

  it('falls back for malformed top-level V2 data', () => {
    for (const serialized of [
      '{not json',
      JSON.stringify({ version: 2, lessons: null }),
      JSON.stringify({ version: 99, lessons: {}, lastVisitedLessonId: null }),
    ]) {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, serialized)
      expect(loadProgress()).toEqual(createDefaultProgress())
    }
  })

  it('migrates valid V1 for-loop progress and removes V1 after writing V2', () => {
    const legacy: ProgressV1 = {
      version: 1,
      guidedRunCompleted: true,
      completedChallengeIds: ['zero-to-four', 'even-two-to-ten'],
      lastConfig: { start: 2, end: 10, comparator: '<=', step: 2 },
    }
    window.localStorage.setItem(
      LEGACY_PROGRESS_STORAGE_KEY,
      JSON.stringify(legacy),
    )

    const migrated = loadProgress()
    expect(migrated).toEqual({
      version: 2,
      lessons: {
        'loops-for': {
          guidedRunCompleted: true,
          completedChallengeIds: ['zero-to-four', 'even-two-to-ten'],
          savedState: { start: 2, end: 10, comparator: '<=', step: 2 },
        },
      },
      lastVisitedLessonId: 'loops-for',
    })
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()
    expect(window.localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('keeps V1 when the V2 migration write fails', () => {
    const values = new Map<string, string>([[
      LEGACY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        guidedRunCompleted: false,
        completedChallengeIds: [],
        lastConfig: DEFAULT_LOOP_CONFIG,
      }),
    ]])
    const storage: ProgressStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: () => { throw new DOMException('quota') },
      removeItem: (key) => { values.delete(key) },
    }

    expect(loadProgress(storage).lessons['loops-for']).toBeDefined()
    expect(values.has(LEGACY_PROGRESS_STORAGE_KEY)).toBe(true)
  })

  it('does not migrate invalid V1 or let it override existing V2', () => {
    window.localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 1,
      guidedRunCompleted: true,
      completedChallengeIds: ['unknown'],
      lastConfig: DEFAULT_LOOP_CONFIG,
    }))
    expect(loadProgress()).toEqual(createDefaultProgress())
    expect(window.localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).not.toBeNull()

    const v2 = createDefaultProgress()
    v2.lastVisitedLessonId = 'variables-basics'
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(v2))
    expect(loadProgress()).toEqual(v2)
  })

  it('validates lesson state, challenge ids and legal blocked loop configs', () => {
    expect(isVariableBasicsSavedState(DEFAULT_VARIABLE_BASICS_STATE)).toBe(true)
    expect(isVariableBasicsSavedState({
      valueType: 'int', x: 2.5, y: 2, operator: '+',
    })).toBe(false)
    expect(isVariableBasicsSavedState({
      valueType: 'double', x: 2.5, y: 2, operator: '%',
    })).toBe(true)
    expect(isConditionalSavedState(DEFAULT_CONDITIONAL_CONFIG)).toBe(true)
    expect(isConditionalSavedState({
      ...DEFAULT_CONDITIONAL_CONFIG,
      score: 100.5,
    })).toBe(false)

    const progress = createDefaultProgress()
    const loop = createDefaultLessonProgress('loops-for')
    loop.savedState = { ...DEFAULT_LOOP_CONFIG, step: 0 }
    progress.lessons['loops-for'] = loop
    expect(isProgressV2(progress)).toBe(true)
    expect(saveProgress(progress)).toBe(true)
    expect((getLessonProgress(loadProgress(), 'loops-for').savedState as {
      step: number
    }).step).toBe(0)

    loop.completedChallengeIds = ['unknown']
    expect(isProgressV2(progress)).toBe(false)
    expect(saveProgress(progress)).toBe(false)
  })

  it('recognizes V1 strictly, including duplicates and bounds', () => {
    const legacy: ProgressV1 = {
      version: 1,
      guidedRunCompleted: false,
      completedChallengeIds: [],
      lastConfig: { ...DEFAULT_LOOP_CONFIG },
    }
    expect(isProgressV1(legacy)).toBe(true)
    expect(isProgressV1({
      ...legacy,
      completedChallengeIds: ['zero-to-four', 'zero-to-four'],
    })).toBe(false)
    expect(isProgressV1({
      ...legacy,
      lastConfig: { ...DEFAULT_LOOP_CONFIG, start: 99 },
    })).toBe(false)
  })

  it('does not throw when storage is unavailable', () => {
    const unavailableStorage: ProgressStorage = {
      getItem: () => { throw new DOMException('denied') },
      setItem: () => { throw new DOMException('denied') },
      removeItem: () => { throw new DOMException('denied') },
    }

    expect(loadProgress(unavailableStorage)).toEqual(createDefaultProgress())
    expect(saveProgress(createDefaultProgress(), unavailableStorage)).toBe(false)
    expect(clearProgress(unavailableStorage)).toBe(false)
    expect(loadProgress(null)).toEqual(createDefaultProgress())
  })

  it('clears both progress keys and preserves unrelated storage', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, '{}')
    window.localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, '{}')
    window.localStorage.setItem('another-app', 'keep me')

    expect(clearProgress()).toBe(true)
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem('another-app')).toBe('keep me')
  })
})

describe('progress selectors', () => {
  it('computes lesson completion and course totals from required challenges', () => {
    const progress = createDefaultProgress()
    progress.lessons['variables-basics'] = {
      ...createDefaultLessonProgress('variables-basics'),
      completedChallengeIds: [...VARIABLE_BASICS_CHALLENGE_IDS],
    }
    progress.lessons['loops-for'] = {
      ...createDefaultLessonProgress('loops-for'),
      completedChallengeIds: [...CHALLENGE_IDS],
    }

    expect(isLessonCompleted(progress, 'variables-basics')).toBe(true)
    expect(isForLoopLessonCompleted(progress)).toBe(true)
    expect(getLessonProgressStatus(progress, 'loops-for')).toBe('completed')
    expect(getLessonProgressStatus(progress, 'conditionals-if-else'))
      .toBe('not-started')
    expect(getCourseProgress(progress)).toEqual({
      completedLessons: 2,
      totalLessons: 3,
      completedChallenges: 6,
      totalChallenges: 9,
      percentage: 67,
    })
  })

  it('uses last visited available lesson, then the first incomplete lesson', () => {
    const progress = createDefaultProgress()
    expect(getContinueLearningLesson(progress)?.id).toBe('variables-basics')
    expect(getContinueLearningPath(progress)).toBe('/learn/variables/basics')

    progress.lastVisitedLessonId = 'loops-for'
    expect(getContinueLearningLesson(progress)?.id).toBe('loops-for')
    expect(getLessonProgressStatus(progress, 'loops-for')).toBe('in-progress')

    progress.lastVisitedLessonId = 'conditionals-if-else'
    expect(getContinueLearningLesson(progress)?.id).toBe('conditionals-if-else')
  })
})
