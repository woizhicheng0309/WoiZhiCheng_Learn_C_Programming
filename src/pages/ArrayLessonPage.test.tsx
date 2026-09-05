import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ARRAY_CHALLENGE_IDS } from '../data/arrayChallenges'
import { ProgressProvider } from '../hooks/useLearningProgress'
import {
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
  type ProgressV2,
} from '../state'
import { ArrayLessonPage } from './ArrayLessonPage'

function renderLesson() {
  return render(
    <ProgressProvider>
      <MemoryRouter initialEntries={['/learn/arrays/basics']}>
        <ArrayLessonPage />
      </MemoryRouter>
    </ProgressProvider>,
  )
}

function setNumber(name: string | RegExp, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name }), {
    target: { value: String(value) },
  })
}

function submitGuidedPrediction(value = 2) {
  setNumber('我預測 selected 會收到', value)
  fireEvent.click(screen.getByRole('button', { name: /提交預測/ }))
}

function step(times = 1) {
  for (let index = 0; index < times; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: /執行下一步/ }))
  }
}

function storedProgress(): ProgressV2 {
  return JSON.parse(
    window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}',
  ) as ProgressV2
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ArrayLessonPage guided array trace', () => {
  it('introduces indexes and keeps playback locked until a prediction is submitted', () => {
    renderLesson()

    expect(screen.getByRole('heading', {
      name: /把一排資料放進陣列.*從 index 0 找到每一格/,
    })).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: /scores\[2\] 在改寫前是多少/,
    })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '提交上方預測後解鎖播放與單步控制',
    )
    expect(screen.queryByRole('button', { name: /執行下一步/ }))
      .not.toBeInTheDocument()
  })

  it('reveals the prediction at the read step, then preserves the copy while writing', () => {
    renderLesson()
    submitGuidedPrediction()

    expect(screen.getByText('預測已記錄。')).toBeInTheDocument()
    expect(screen.queryByText('預測正確！')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/C 程式碼，目前執行第 3 行/))
      .toHaveTextContent('int main(void)')

    step(4)
    expect(screen.getByLabelText(/C 程式碼，目前執行第 6 行/))
      .toHaveTextContent('selected = scores[index]')
    expect(screen.getByLabelText('scores 索引 2，值 2，目前讀取'))
      .toBeInTheDocument()
    expect(screen.getByText('預測正確！')).toBeInTheDocument()

    step()
    expect(screen.getByLabelText(/C 程式碼，目前執行第 7 行/))
      .toHaveTextContent('scores[index] = 10')
    expect(screen.getByLabelText('scores 索引 2，值 10，目前寫入'))
      .toBeInTheDocument()
    const selectedCell = screen.getByText('selected').closest('.arrays-scalar-cell')
    expect(selectedCell).not.toBeNull()
    expect(selectedCell).toHaveTextContent('2')

    step()
    const outputPanel = screen.getByText('printf 輸出').closest('.arrays-console')
    expect(outputPanel).not.toBeNull()
    expect(within(outputPanel as HTMLElement).getByText('2 -> 10'))
      .toBeInTheDocument()

    step(2)
    const memoryCells = within(
      screen.getByRole('list', { name: 'scores 的五個元素' }),
    ).getAllByRole('listitem')
    expect(memoryCells).toHaveLength(5)
    for (const cell of memoryCells) {
      expect(cell).toHaveAccessibleName(/已離開作用域/)
      expect(cell).not.toHaveAccessibleName(/值 -?\d+/)
      expect(cell).toHaveTextContent('—')
    }
  })

  it('keeps a typed out-of-bounds index and stops before the unsafe read', () => {
    renderLesson()

    setNumber('index 的值', 5)

    expect(screen.getByRole('spinbutton', { name: 'index 的值' })).toHaveValue(5)
    expect(screen.queryByRole('slider', { name: 'index 的值滑桿' }))
      .not.toBeInTheDocument()
    expect(screen.getByText(/已保留 5；超出滑桿範圍 0–4/))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()

    step(4)
    expect(screen.getByLabelText(/C 程式碼，目前執行第 6 行/))
      .toHaveTextContent('selected = scores[index]')
    expect(screen.getByRole('alert')).toHaveTextContent('合法索引只有 0 到 4')
    expect(screen.queryByLabelText(/scores 索引 4，目前讀取/))
      .not.toBeInTheDocument()
    expect(storedProgress().lessons['arrays-basics']).toBeUndefined()
    expect(storedProgress().lastVisitedLessonId).toBe('arrays-basics')
  })

  it('announces every unlocked phase for screen-reader users', () => {
    renderLesson()
    submitGuidedPrediction()

    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toHaveTextContent('進入 main')
    step()
    expect(liveRegion).toHaveTextContent('宣告 scores')
    step()
    expect(liveRegion).toHaveTextContent('初始化陣列')
  })

  it('stores only the arrays lesson state and accepts a typed negative new value', async () => {
    const user = userEvent.setup()
    const existing: ProgressV2 = {
      version: PROGRESS_VERSION,
      lessons: {
        'functions-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-return-value'],
          savedState: { x: 6, y: 2 },
        },
      },
      lastVisitedLessonId: 'functions-basics',
    }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(existing))
    renderLesson()

    setNumber('index 的值', 4)
    const newValueInput = screen.getByRole('spinbutton', { name: 'newValue 的值' })
    await user.clear(newValueInput)
    await user.type(newValueInput, '-8')
    fireEvent.blur(newValueInput)

    expect(newValueInput).toHaveValue(-8)
    expect(storedProgress().lessons['arrays-basics']?.savedState)
      .toEqual({ index: 4, newValue: -8 })
    expect(storedProgress().lessons['functions-basics'])
      .toEqual(existing.lessons['functions-basics'])
    expect(storedProgress().lastVisitedLessonId).toBe('arrays-basics')
  })

  it('restores saved state and an unlocked guided run after reload', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: PROGRESS_VERSION,
      lessons: {
        'arrays-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: [],
          savedState: { index: 1, newValue: 42 },
        },
      },
      lastVisitedLessonId: 'arrays-basics',
    } satisfies ProgressV2))

    renderLesson()

    expect(screen.getByRole('spinbutton', { name: 'index 的值' })).toHaveValue(1)
    expect(screen.getByRole('spinbutton', { name: 'newValue 的值' })).toHaveValue(42)
    expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
  })

  it('synchronizes array configuration changed by another tab', async () => {
    renderLesson()

    const nextProgress: ProgressV2 = {
      version: PROGRESS_VERSION,
      lessons: {
        'arrays-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: [],
          savedState: { index: 4, newValue: 99 },
        },
      },
      lastVisitedLessonId: 'arrays-basics',
    }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROGRESS_STORAGE_KEY,
        newValue: JSON.stringify(nextProgress),
      }))
    })

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'index 的值' })).toHaveValue(4)
      expect(screen.getByRole('spinbutton', { name: 'newValue 的值' })).toHaveValue(99)
      expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
    })
  })

  it('completes all three challenges and shows the completion banner', () => {
    renderLesson()

    fireEvent.change(screen.getByRole('spinbutton', { name: '你的答案' }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))

    fireEvent.click(screen.getByRole('tab', { name: /把指定元素改成 10/ }))
    setNumber('寫入 scores[3] 的新值', ARRAY_TARGET_FOR_TEST)
    fireEvent.click(screen.getByRole('button', { name: /執行改寫並檢查/ }))

    fireEvent.click(screen.getByRole('tab', { name: /辨識合法索引與越界/ }))
    fireEvent.click(screen.getByRole('radio', { name: '越界索引，不可以讀取' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查邊界' }))

    expect(storedProgress().lessons['arrays-basics']?.completedChallengeIds)
      .toEqual(ARRAY_CHALLENGE_IDS)
    expect(screen.getByText('你已完成陣列、索引與字串。')).toBeInTheDocument()
    expect(screen.getByText(/越界存取是未定義行為/)).toBeInTheDocument()
  })

  it('shows the null terminator as the fifth char-array cell', () => {
    renderLesson()

    expect(screen.getByRole('heading', { name: /字串.*char 陣列/ }))
      .toBeInTheDocument()
    expect(screen.getByRole('img', { name: /4 是字串終止空字元/ }))
      .toHaveTextContent('\\0[4]結尾')
  })

  it('supports Escape cancellation and returns focus to the clear trigger', async () => {
    renderLesson()
    const clearButton = screen.getByRole('button', { name: '清除全部學習進度' })
    clearButton.focus()
    fireEvent.click(clearButton)

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).not.toHaveAttribute('aria-modal')
    expect(screen.getByRole('button', { name: '確定清除' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '清除全部學習進度' }))
        .toHaveFocus()
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

const ARRAY_TARGET_FOR_TEST = 10
