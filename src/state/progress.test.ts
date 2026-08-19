import { DEFAULT_LOOP_CONFIG } from '../domain'
import { CHALLENGE_IDS } from '../data/challenges'
import {
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
  clearProgress,
  createDefaultProgress,
  isForLoopLessonCompleted,
  isProgressV1,
  loadProgress,
  saveProgress,
  type ProgressV1,
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
      guidedRunCompleted: false,
      completedChallengeIds: [],
      lastConfig: DEFAULT_LOOP_CONFIG,
    })

    first.completedChallengeIds.push('zero-to-four')
    first.lastConfig.start = 8
    expect(second.completedChallengeIds).toEqual([])
    expect(second.lastConfig.start).toBe(DEFAULT_LOOP_CONFIG.start)
  })

  it('round-trips valid progress through the versioned key', () => {
    const progress: ProgressV1 = {
      version: 1,
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
    ['wrong version', JSON.stringify({ version: 2 })],
    [
      'unknown challenge id',
      JSON.stringify({
        version: 1,
        guidedRunCompleted: false,
        completedChallengeIds: ['unknown'],
        lastConfig: DEFAULT_LOOP_CONFIG,
      }),
    ],
    [
      'duplicate challenge id',
      JSON.stringify({
        version: 1,
        guidedRunCompleted: false,
        completedChallengeIds: ['zero-to-four', 'zero-to-four'],
        lastConfig: DEFAULT_LOOP_CONFIG,
      }),
    ],
    [
      'out-of-range loop config',
      JSON.stringify({
        version: 1,
        guidedRunCompleted: false,
        completedChallengeIds: [],
        lastConfig: { ...DEFAULT_LOOP_CONFIG, start: 999 },
      }),
    ],
  ])('falls back safely for %s', (_label, serialized) => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, serialized)

    expect(loadProgress()).toEqual(createDefaultProgress())
  })

  it('allows a saved zero step because the lab can explain that blocked state', () => {
    const progress = createDefaultProgress()
    progress.lastConfig.step = 0

    expect(isProgressV1(progress)).toBe(true)
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

  it('clears only the progress key', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, '{}')
    window.localStorage.setItem('another-app', 'keep me')

    expect(clearProgress()).toBe(true)
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem('another-app')).toBe('keep me')
  })

  it('marks the lesson complete only after all three challenge ids are present', () => {
    const progress = createDefaultProgress()
    progress.completedChallengeIds = [...CHALLENGE_IDS]

    expect(isForLoopLessonCompleted(progress)).toBe(true)
    progress.completedChallengeIds.pop()
    expect(isForLoopLessonCompleted(progress)).toBe(false)
  })
})
