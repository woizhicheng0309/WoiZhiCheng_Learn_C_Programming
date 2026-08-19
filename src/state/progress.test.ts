import { DEFAULT_LOOP_CONFIG } from '../domain'
import { CHALLENGE_IDS } from '../data/challenges'
import {
  LEGACY_PROGRESS_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
  clearProgress,
  createDefaultProgress,
  isForLoopLessonCompleted,
  isLessonCompleted,
  isProgressV2,
  loadProgress,
  saveProgress,
  type ProgressV2,
} from './progress'

describe('learning progress storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates an independent default value', () => {
    const first = createDefaultProgress()
    const second = createDefaultProgress()

    expect(first).toEqual({
      version: PROGRESS_VERSION,
      completedLessonIds: [],
      guidedRunCompleted: false,
      completedChallengeIds: [],
      lastConfig: DEFAULT_LOOP_CONFIG,
    })

    first.completedLessonIds.push('variables')
    first.completedChallengeIds.push('zero-to-four')
    first.lastConfig.start = 8
    expect(second.completedLessonIds).toEqual([])
    expect(second.completedChallengeIds).toEqual([])
    expect(second.lastConfig.start).toBe(DEFAULT_LOOP_CONFIG.start)
  })

  it('round-trips valid progress through the versioned key', () => {
    const progress: ProgressV2 = {
      version: 2,
      completedLessonIds: ['variables'],
      guidedRunCompleted: true,
      completedChallengeIds: ['zero-to-four', 'even-two-to-ten'],
      lastConfig: { start: 2, end: 10, comparator: '<=', step: 2 },
    }

    expect(saveProgress(progress)).toBe(true)
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()
    expect(loadProgress()).toEqual(progress)
    expect(loadProgress()).not.toBe(progress)
  })

  it.each([
    ['malformed JSON', '{not json'],
    ['wrong version', JSON.stringify({ version: 3 })],
    [
      'unknown lesson id',
      JSON.stringify({
        ...createDefaultProgress(),
        completedLessonIds: ['unknown'],
      }),
    ],
    [
      'duplicate lesson id',
      JSON.stringify({
        ...createDefaultProgress(),
        completedLessonIds: ['variables', 'variables'],
      }),
    ],
    [
      'unknown challenge id',
      JSON.stringify({
        ...createDefaultProgress(),
        completedChallengeIds: ['unknown'],
      }),
    ],
    [
      'duplicate challenge id',
      JSON.stringify({
        ...createDefaultProgress(),
        completedChallengeIds: ['zero-to-four', 'zero-to-four'],
      }),
    ],
    [
      'out-of-range loop config',
      JSON.stringify({
        ...createDefaultProgress(),
        lastConfig: { ...DEFAULT_LOOP_CONFIG, start: 999 },
      }),
    ],
  ])('falls back safely for %s', (_label, serialized) => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, serialized)

    expect(loadProgress()).toEqual(createDefaultProgress())
  })

  it('migrates version 1 for-loop progress without losing it', () => {
    window.localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 1,
      guidedRunCompleted: true,
      completedChallengeIds: ['zero-to-four'],
      lastConfig: { start: 2, end: 8, comparator: '<', step: 2 },
    }))

    expect(loadProgress()).toEqual({
      version: 2,
      completedLessonIds: [],
      guidedRunCompleted: true,
      completedChallengeIds: ['zero-to-four'],
      lastConfig: { start: 2, end: 8, comparator: '<', step: 2 },
    })
  })

  it('allows a saved zero step because the lab can explain that blocked state', () => {
    const progress = createDefaultProgress()
    progress.lastConfig.step = 0

    expect(isProgressV2(progress)).toBe(true)
    expect(saveProgress(progress)).toBe(true)
    expect(loadProgress().lastConfig.step).toBe(0)
  })

  it('does not throw when storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => {
        throw new DOMException('denied')
      },
      setItem: () => {
        throw new DOMException('denied')
      },
      removeItem: () => {
        throw new DOMException('denied')
      },
    }

    expect(loadProgress(unavailableStorage)).toEqual(createDefaultProgress())
    expect(saveProgress(createDefaultProgress(), unavailableStorage)).toBe(false)
    expect(clearProgress(unavailableStorage)).toBe(false)
    expect(loadProgress(null)).toEqual(createDefaultProgress())
  })

  it('clears both progress versions and leaves unrelated storage alone', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, '{}')
    window.localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, '{}')
    window.localStorage.setItem('another-app', 'keep me')

    expect(clearProgress()).toBe(true)
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem('another-app')).toBe('keep me')
  })

  it('resolves completion for foundation lessons and the for-loop lesson', () => {
    const progress = createDefaultProgress()
    progress.completedLessonIds = ['variables']

    expect(isLessonCompleted(progress, 'variables')).toBe(true)
    expect(isLessonCompleted(progress, 'conditionals')).toBe(false)
    expect(isLessonCompleted(progress, 'functions')).toBe(false)
    expect(isForLoopLessonCompleted(progress)).toBe(false)

    progress.completedChallengeIds = [...CHALLENGE_IDS]
    expect(isForLoopLessonCompleted(progress)).toBe(true)
    expect(isLessonCompleted(progress, 'loops')).toBe(true)
  })
})
