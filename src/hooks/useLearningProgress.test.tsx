import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  ProgressProvider,
  useLearningProgress,
} from './useLearningProgress'
import {
  PROGRESS_STORAGE_KEY,
  createDefaultLessonProgress,
  createDefaultProgress,
  saveProgress,
} from '../state'

function ProgressConsumer({ label }: { label: string }) {
  const {
    getLessonProgress,
    markChallengeCompleted,
    visitLesson,
  } = useLearningProgress()
  const lesson = getLessonProgress('variables-basics')
  return (
    <section>
      <output aria-label={`${label}-count`}>
        {lesson.completedChallengeIds.length}
      </output>
      <button
        type="button"
        onClick={() => markChallengeCompleted(
          'variables-basics',
          'predict-int-division',
        )}
      >
        {label}-complete
      </button>
      <button
        type="button"
        onClick={() => visitLesson('variables-basics')}
      >
        {label}-visit
      </button>
    </section>
  )
}

describe('ProgressProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shares one progress state with every consumer on the page', () => {
    render(
      <ProgressProvider>
        <ProgressConsumer label="first" />
        <ProgressConsumer label="second" />
      </ProgressProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'first-complete' }))
    expect(screen.getByLabelText('first-count')).toHaveTextContent('1')
    expect(screen.getByLabelText('second-count')).toHaveTextContent('1')

    const stored = JSON.parse(
      window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}',
    ) as { lessons?: Record<string, { completedChallengeIds: string[] }> }
    expect(stored.lessons?.['variables-basics'].completedChallengeIds)
      .toEqual(['predict-int-division'])
  })

  it('synchronizes progress when another tab writes the V2 storage key', () => {
    render(
      <ProgressProvider>
        <ProgressConsumer label="tab" />
      </ProgressProvider>,
    )

    const external = createDefaultProgress()
    external.lessons['variables-basics'] = {
      ...createDefaultLessonProgress('variables-basics'),
      completedChallengeIds: ['predict-int-division', 'make-fourteen'],
    }
    expect(saveProgress(external)).toBe(true)

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROGRESS_STORAGE_KEY,
        newValue: JSON.stringify(external),
        storageArea: window.localStorage,
      }))
    })

    expect(screen.getByLabelText('tab-count')).toHaveTextContent('2')
  })

  it('rejects unknown challenges without corrupting the lesson', () => {
    function InvalidUpdate() {
      const { getLessonProgress, markChallengeCompleted } =
        useLearningProgress()
      return (
        <button
          type="button"
          onClick={() => markChallengeCompleted('variables-basics', 'unknown')}
        >
          {getLessonProgress('variables-basics').completedChallengeIds.length}
        </button>
      )
    }

    render(
      <ProgressProvider>
        <InvalidUpdate />
      </ProgressProvider>,
    )
    const button = screen.getByRole('button', { name: '0' })
    fireEvent.click(button)
    expect(button).toHaveTextContent('0')
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('requires a single provider instead of silently creating local copies', () => {
    expect(() => render(<ProgressConsumer label="orphan" />)).toThrow(
      'useLearningProgress 必須在 ProgressProvider 內使用。',
    )
  })
})
