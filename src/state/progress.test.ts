import {
  DEFAULT_CONDITIONAL_CONFIG,
  DEFAULT_ARRAY_CONFIG,
  ARRAY_LIMITS,
  DEFAULT_FUNCTION_CONFIG,
  DEFAULT_LOOP_CONFIG,
  DEFAULT_POINTER_CONFIG,
  DEFAULT_SWAP_CONFIG,
  DEFAULT_TRAVERSAL_CONFIG,
  DEFAULT_STRING_POINTER_CONFIG,
  FUNCTION_LIMITS,
} from '../domain'
import { CHALLENGE_IDS } from '../data/challenges'
import { VARIABLE_BASICS_CHALLENGE_IDS } from '../data/lessons'
import { POINTER_CHALLENGE_IDS } from '../data/pointerChallenges'
import { SWAP_CHALLENGE_IDS } from '../data/swapChallenges'
import { TRAVERSAL_CHALLENGE_IDS } from '../data/traversalChallenges'
import { STRING_POINTER_CHALLENGE_IDS } from '../data/stringPointerChallenges'
import {
  DEFAULT_CONDITIONAL_STATE,
  DEFAULT_ARRAY_STATE,
  DEFAULT_FUNCTION_STATE,
  DEFAULT_POINTER_STATE,
  DEFAULT_SWAP_STATE,
  DEFAULT_TRAVERSAL_STATE,
  DEFAULT_STRING_POINTER_STATE,
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
  isArraySavedState,
  isFunctionSavedState,
  isPointerSavedState,
  isSwapSavedState,
  isTraversalSavedState,
  isStringPointerSavedState,
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
    expect(createDefaultLessonProgress('functions-basics').savedState)
      .toEqual(DEFAULT_FUNCTION_STATE)
    expect(createDefaultLessonProgress('arrays-basics').savedState)
      .toEqual(DEFAULT_ARRAY_STATE)
    expect(createDefaultLessonProgress('pointers-basics').savedState)
      .toEqual(DEFAULT_POINTER_STATE)
    expect(createDefaultLessonProgress('pointers-swap').savedState)
      .toEqual(DEFAULT_SWAP_STATE)
    expect(createDefaultLessonProgress('pointers-traversal').savedState)
      .toEqual(DEFAULT_TRAVERSAL_STATE)
    expect(createDefaultLessonProgress('pointers-strings').savedState)
      .toEqual(DEFAULT_STRING_POINTER_STATE)
    expect(DEFAULT_FUNCTION_STATE).toEqual(DEFAULT_FUNCTION_CONFIG)
    expect(DEFAULT_ARRAY_STATE).toEqual(DEFAULT_ARRAY_CONFIG)
    expect(DEFAULT_POINTER_STATE).toEqual(DEFAULT_POINTER_CONFIG)
    expect(DEFAULT_SWAP_STATE).toEqual(DEFAULT_SWAP_CONFIG)
    expect(DEFAULT_TRAVERSAL_STATE).toEqual(DEFAULT_TRAVERSAL_CONFIG)
    expect(DEFAULT_STRING_POINTER_STATE).toEqual(DEFAULT_STRING_POINTER_CONFIG)
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

  it('round-trips function parameters without changing the V2 schema', () => {
    const progress = createDefaultProgress()
    progress.lessons['functions-basics'] = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-return-value'],
      savedState: { x: 8, y: -2 },
    }
    progress.lastVisitedLessonId = 'functions-basics'

    expect(saveProgress(progress)).toBe(true)
    expect(loadProgress()).toEqual(progress)
    expect(loadProgress().version).toBe(2)
  })

  it('round-trips a valid array index and write value in V2 progress', () => {
    const progress = createDefaultProgress()
    progress.lessons['arrays-basics'] = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-index-read'],
      savedState: { index: 4, newValue: -8 },
    }
    progress.lastVisitedLessonId = 'arrays-basics'

    expect(saveProgress(progress)).toBe(true)
    expect(loadProgress()).toEqual(progress)
    expect(isArraySavedState(progress.lessons['arrays-basics']?.savedState))
      .toBe(true)
  })

  it('round-trips pointer configuration and challenges independently of arrays', () => {
    const progress = createDefaultProgress()
    progress.lessons['arrays-basics'] = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-index-read'],
      savedState: { index: 3, newValue: 10 },
    }
    progress.lessons['pointers-basics'] = {
      guidedRunCompleted: true,
      completedChallengeIds: [...POINTER_CHALLENGE_IDS],
      savedState: { x: -4, y: 9, newValue: 12, target: 'y' },
    }
    progress.lastVisitedLessonId = 'pointers-basics'

    expect(saveProgress(progress)).toBe(true)
    const loaded = loadProgress()
    expect(loaded).toEqual(progress)
    expect(loaded.version).toBe(2)
    expect(isLessonCompleted(loaded, 'pointers-basics')).toBe(true)
    expect(isLessonCompleted(loaded, 'arrays-basics')).toBe(false)
    expect(getContinueLearningPath(loaded)).toBe('/learn/pointers/basics')
  })

  it.each([
    { x: 5, y: 9, newValue: 12, target: 'z' },
    { x: 5.5, y: 9, newValue: 12, target: 'x' },
    { x: 5, y: '9', newValue: 12, target: 'x' },
    { x: 5, y: 9, newValue: null, target: 'x' },
    { x: Number.MAX_SAFE_INTEGER, y: 9, newValue: 12, target: 'x' },
  ])('normalizes malformed pointer state while keeping array progress: %j', (savedState) => {
    const arrayProgress = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-index-read'],
      savedState: { index: 4, newValue: -8 },
    }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      lessons: {
        'arrays-basics': arrayProgress,
        'pointers-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-pointer-read'],
          savedState,
        },
      },
      lastVisitedLessonId: 'pointers-basics',
    }))

    const loaded = loadProgress()
    expect(loaded.lessons['arrays-basics']).toEqual(arrayProgress)
    expect(loaded.lessons['pointers-basics']).toEqual(
      createDefaultLessonProgress('pointers-basics'),
    )
    expect(loaded.lastVisitedLessonId).toBe('pointers-basics')
    expect(isProgressV2(loaded)).toBe(true)
  })

  it('round-trips swap mode and challenges independently of pointer basics', () => {
    const progress = createDefaultProgress()
    progress.lessons['pointers-basics'] = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-pointer-read'],
      savedState: { x: 5, y: 9, newValue: 12, target: 'x' },
    }
    progress.lessons['pointers-swap'] = {
      guidedRunCompleted: true,
      completedChallengeIds: [...SWAP_CHALLENGE_IDS],
      savedState: { x: -4, y: 9, mode: 'pointer' },
    }
    progress.lastVisitedLessonId = 'pointers-swap'

    expect(saveProgress(progress)).toBe(true)
    const loaded = loadProgress()
    expect(loaded).toEqual(progress)
    expect(loaded.version).toBe(2)
    expect(isLessonCompleted(loaded, 'pointers-swap')).toBe(true)
    expect(isLessonCompleted(loaded, 'pointers-basics')).toBe(false)
    expect(getContinueLearningPath(loaded)).toBe('/learn/pointers/swap')
  })

  it.each([
    { x: 5, y: 9, mode: 'reference' },
    { x: 5.5, y: 9, mode: 'value' },
    { x: 5, y: '9', mode: 'value' },
    { x: 5, y: null, mode: 'pointer' },
    { x: Number.MAX_SAFE_INTEGER, y: 9, mode: 'pointer' },
  ])('normalizes malformed swap state while preserving pointer basics: %j', (savedState) => {
    const pointerProgress = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-pointer-read'],
      savedState: { x: 5, y: 9, newValue: 12, target: 'x' },
    }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      lessons: {
        'pointers-basics': pointerProgress,
        'pointers-swap': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-value-swap'],
          savedState,
        },
      },
      lastVisitedLessonId: 'pointers-swap',
    }))

    const loaded = loadProgress()
    expect(loaded.lessons['pointers-basics']).toEqual(pointerProgress)
    expect(loaded.lessons['pointers-swap']).toEqual(
      createDefaultLessonProgress('pointers-swap'),
    )
    expect(loaded.lastVisitedLessonId).toBe('pointers-swap')
    expect(isProgressV2(loaded)).toBe(true)
  })

  it.each(['index', 'pointer'])('round-trips the one-past safety scenario in %s mode without changing swap progress', (mode) => {
    const progress = createDefaultProgress()
    progress.lessons['pointers-swap'] = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-value-swap'],
      savedState: { x: -4, y: 9, mode: 'pointer' },
    }
    progress.lessons['pointers-traversal'] = {
      guidedRunCompleted: true,
      completedChallengeIds: [...TRAVERSAL_CHALLENGE_IDS],
      savedState: { count: 6, mode },
    }
    progress.lastVisitedLessonId = 'pointers-traversal'

    expect(saveProgress(progress)).toBe(true)
    const loaded = loadProgress()
    expect(loaded).toEqual(progress)
    expect(loaded.version).toBe(2)
    expect(isLessonCompleted(loaded, 'pointers-traversal')).toBe(true)
    expect(isLessonCompleted(loaded, 'pointers-swap')).toBe(false)
    expect(getContinueLearningPath(loaded)).toBe('/learn/pointers/traversal')
    expect(isTraversalSavedState(loaded.lessons['pointers-traversal']?.savedState))
      .toBe(true)
  })

  it.each([
    { count: -1, mode: 'pointer' },
    { count: 7, mode: 'pointer' },
    { count: 2.5, mode: 'pointer' },
    { count: '5', mode: 'pointer' },
    { count: null, mode: 'pointer' },
    { count: 5, mode: 'invalid' },
  ])('normalizes malformed traversal state while preserving swap progress: %j', (savedState) => {
    const swapProgress = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-value-swap'],
      savedState: { x: 5, y: 9, mode: 'value' },
    }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      lessons: {
        'pointers-swap': swapProgress,
        'pointers-traversal': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-pointer-offset'],
          savedState,
        },
      },
      lastVisitedLessonId: 'pointers-traversal',
    }))

    const loaded = loadProgress()
    expect(loaded.lessons['pointers-swap']).toEqual(swapProgress)
    expect(loaded.lessons['pointers-traversal']).toEqual(
      createDefaultLessonProgress('pointers-traversal'),
    )
    expect(loaded.lastVisitedLessonId).toBe('pointers-traversal')
    expect(isProgressV2(loaded)).toBe(true)
  })

  it.each([
    { sample: 'word', stopAt: 'nul' },
    { sample: 'digit-zero', stopAt: 'nul' },
    { sample: 'embedded-nul', stopAt: 'nul' },
    { sample: 'word', stopAt: 'digit-zero' },
    { sample: 'digit-zero', stopAt: 'digit-zero' },
    { sample: 'embedded-nul', stopAt: 'digit-zero' },
  ])('round-trips string presets, including safety-stop settings, independently: %j', (savedState) => {
    const progress = createDefaultProgress()
    progress.lessons['pointers-traversal'] = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-pointer-offset'],
      savedState: { count: 6, mode: 'pointer' },
    }
    progress.lessons['pointers-strings'] = {
      guidedRunCompleted: true,
      completedChallengeIds: [...STRING_POINTER_CHALLENGE_IDS],
      savedState,
    }
    progress.lastVisitedLessonId = 'pointers-strings'

    expect(isStringPointerSavedState(savedState)).toBe(true)
    expect(saveProgress(progress)).toBe(true)
    const loaded = loadProgress()
    expect(loaded).toEqual(progress)
    expect(loaded.version).toBe(2)
    expect(isLessonCompleted(loaded, 'pointers-strings')).toBe(true)
    expect(isLessonCompleted(loaded, 'pointers-traversal')).toBe(false)
    expect(getContinueLearningPath(loaded)).toBe('/learn/pointers/strings')
  })

  it.each([
    { sample: 'unknown', stopAt: 'nul' },
    { sample: 'word', stopAt: 'unknown' },
    { sample: 'word' },
    { stopAt: 'nul' },
    { sample: null, stopAt: 'nul' },
    { sample: 'word', stopAt: false },
  ])('normalizes malformed string state while preserving traversal progress: %j', (savedState) => {
    const traversalProgress = {
      guidedRunCompleted: true,
      completedChallengeIds: ['predict-pointer-offset'],
      savedState: { count: 5, mode: 'pointer' },
    }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      lessons: {
        'pointers-traversal': traversalProgress,
        'pointers-strings': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-digit-zero-length'],
          savedState,
        },
      },
      lastVisitedLessonId: 'pointers-strings',
    }))

    expect(isStringPointerSavedState(savedState)).toBe(false)
    const loaded = loadProgress()
    expect(loaded.lessons['pointers-traversal']).toEqual(traversalProgress)
    expect(loaded.lessons['pointers-strings']).toEqual(
      createDefaultLessonProgress('pointers-strings'),
    )
    expect(loaded.lastVisitedLessonId).toBe('pointers-strings')
    expect(isProgressV2(loaded)).toBe(true)
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

  it('resets invalid function state without contaminating legacy loop progress', () => {
    const loopProgress = {
      guidedRunCompleted: true,
      completedChallengeIds: ['zero-to-four'],
      savedState: { start: 2, end: 10, comparator: '<=', step: 2 },
    }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      lessons: {
        'loops-for': loopProgress,
        'functions-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-return-value'],
          savedState: { x: Number.MAX_SAFE_INTEGER, y: 1.5 },
        },
      },
      lastVisitedLessonId: 'functions-basics',
    }))

    const loaded = loadProgress()
    expect(loaded.lessons['loops-for']).toEqual(loopProgress)
    expect(loaded.lessons['functions-basics']).toEqual(
      createDefaultLessonProgress('functions-basics'),
    )
    expect(loaded.lastVisitedLessonId).toBe('functions-basics')
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
    expect(isFunctionSavedState(DEFAULT_FUNCTION_CONFIG)).toBe(true)
    expect(isFunctionSavedState({
      ...DEFAULT_FUNCTION_CONFIG,
      x: FUNCTION_LIMITS.x.max + 1,
    })).toBe(false)
    expect(isFunctionSavedState({
      ...DEFAULT_FUNCTION_CONFIG,
      y: 1.5,
    })).toBe(false)
    expect(isFunctionSavedState({
      ...DEFAULT_FUNCTION_CONFIG,
      x: Number.POSITIVE_INFINITY,
    })).toBe(false)
    expect(isArraySavedState(DEFAULT_ARRAY_CONFIG)).toBe(true)
    expect(isArraySavedState({
      ...DEFAULT_ARRAY_CONFIG,
      index: ARRAY_LIMITS.index.max + 1,
    })).toBe(false)
    expect(isArraySavedState({
      ...DEFAULT_ARRAY_CONFIG,
      newValue: 4.5,
    })).toBe(false)
    expect(isArraySavedState({
      ...DEFAULT_ARRAY_CONFIG,
      newValue: Number.NaN,
    })).toBe(false)
    expect(isPointerSavedState(DEFAULT_POINTER_CONFIG)).toBe(true)
    expect(isPointerSavedState({
      ...DEFAULT_POINTER_CONFIG,
      target: 'null',
    })).toBe(true)
    expect(isPointerSavedState({
      ...DEFAULT_POINTER_CONFIG,
      x: Number.POSITIVE_INFINITY,
    })).toBe(false)
    expect(isPointerSavedState({
      ...DEFAULT_POINTER_CONFIG,
      newValue: 4.5,
    })).toBe(false)
    expect(isSwapSavedState(DEFAULT_SWAP_CONFIG)).toBe(true)
    expect(isSwapSavedState({ ...DEFAULT_SWAP_CONFIG, mode: 'pointer' })).toBe(true)
    expect(isSwapSavedState({ ...DEFAULT_SWAP_CONFIG, mode: 'reference' })).toBe(false)
    for (const x of [Number.NaN, Number.POSITIVE_INFINITY, 4.5, Number.MAX_SAFE_INTEGER]) {
      expect(isSwapSavedState({ ...DEFAULT_SWAP_CONFIG, x })).toBe(false)
    }
    expect(isTraversalSavedState(DEFAULT_TRAVERSAL_CONFIG)).toBe(true)
    expect(isTraversalSavedState({ ...DEFAULT_TRAVERSAL_CONFIG, mode: 'index' }))
      .toBe(true)
    expect(isTraversalSavedState({ ...DEFAULT_TRAVERSAL_CONFIG, count: 0 })).toBe(true)
    expect(isTraversalSavedState({ ...DEFAULT_TRAVERSAL_CONFIG, count: 6 })).toBe(true)
    for (const count of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2.5, 7]) {
      expect(isTraversalSavedState({ ...DEFAULT_TRAVERSAL_CONFIG, count })).toBe(false)
    }
    expect(isTraversalSavedState({ ...DEFAULT_TRAVERSAL_CONFIG, mode: 'invalid' }))
      .toBe(false)

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
      totalLessons: 9,
      completedChallenges: 6,
      totalChallenges: 27,
      percentage: 22,
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
