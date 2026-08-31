import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FUNCTION_CHALLENGE_IDS } from '../data/functionChallenges'
import { DEFAULT_LOOP_CONFIG } from '../domain'
import { ProgressProvider } from '../hooks/useLearningProgress'
import {
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
  type ProgressV2,
} from '../state'
import { FunctionLessonPage } from './FunctionLessonPage'

function renderLesson() {
  return render(
    <ProgressProvider>
      <MemoryRouter initialEntries={['/learn/functions/basics']}>
        <FunctionLessonPage />
      </MemoryRouter>
    </ProgressProvider>,
  )
}

function seedProgress(progress: ProgressV2) {
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

function readStoredProgress(): ProgressV2 {
  return JSON.parse(
    window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}',
  ) as ProgressV2
}

function setNumber(name: string | RegExp, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name }), {
    target: { value: String(value) },
  })
}

function submitGuidedPrediction(value = 7) {
  setNumber('我預測 answer 最後會是', value)
  fireEvent.click(screen.getByRole('button', { name: /提交預測/ }))
}

function step(times = 1) {
  for (let index = 0; index < times; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: /執行下一步/ }))
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('FunctionLessonPage guided call trace', () => {
  it('introduces the lesson with playback locked behind a prediction', () => {
    renderLesson()

    expect(screen.getByRole('heading', {
      name: /把工作交給函式.*再把答案帶回 main/,
    })).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: /先別按播放.*add 會回傳多少/,
    })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '提交上方預測後解鎖播放與單步控制',
    )
    expect(screen.queryByRole('button', { name: /執行下一步/ }))
      .not.toBeInTheDocument()
  })

  it('unlocks single-step playback and follows main into add, return, and printf', () => {
    renderLesson()
    submitGuidedPrediction()

    expect(screen.getByText('預測已記錄。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
    expect(screen.getByLabelText(/C 程式碼，目前執行第 8 行/))
      .toHaveTextContent('int main(void)')
    expect(screen.getByText('main 執行中')).toBeInTheDocument()

    step(3)
    expect(screen.getByLabelText(/C 程式碼，目前執行第 11 行/))
      .toHaveTextContent('int answer = add(x, y);')
    expect(screen.getByText(/add\(4, 3\) 建立 add 框架/)).toBeInTheDocument()

    step()
    expect(screen.getByLabelText(/C 程式碼，目前執行第 3 行/))
      .toHaveTextContent('int add(int a, int b)')
    expect(screen.getByText('add 執行中')).toBeInTheDocument()
    expect(screen.getAllByText(
      /兩個參數都會在函式本體開始執行前完成宣告與初始化/,
    )).toHaveLength(2)
    expect(screen.getAllByText(
      /x 的值 4 與 y 的值 3 同時複製給參數 a、b/,
    )).toHaveLength(2)

    step(3)
    expect(screen.getByLabelText(/C 程式碼，目前執行第 5 行/))
      .toHaveTextContent('return result;')
    expect(screen.getByText('return 7 回到 main')).toBeInTheDocument()

    step(2)
    expect(screen.getByLabelText(/C 程式碼，目前執行第 12 行/))
      .toHaveTextContent('printf')
    const outputPanel = screen.getByText('printf 輸出').closest('.functions-console')
    expect(outputPanel).not.toBeNull()
    expect(within(outputPanel as HTMLElement).getByText('7')).toBeInTheDocument()
    expect(screen.getByText('預測正確！')).toBeInTheDocument()
    expect(screen.getByText(/add 實際回傳 7/)).toBeInTheDocument()
  })

  it('saves x and y only to functions-basics without changing loop state', () => {
    const existingLoopProgress = {
      guidedRunCompleted: true,
      completedChallengeIds: [] as string[],
      savedState: { ...DEFAULT_LOOP_CONFIG },
    }
    seedProgress({
      version: PROGRESS_VERSION,
      lessons: { 'loops-for': existingLoopProgress },
      lastVisitedLessonId: 'loops-for',
    })
    renderLesson()

    setNumber('x 的值', 12)
    setNumber('y 的值', -4)

    const saved = readStoredProgress()
    expect(saved.lessons['functions-basics']).toMatchObject({
      savedState: { x: 12, y: -4 },
    })
    expect(saved.lessons['loops-for']).toEqual(existingLoopProgress)
    expect(saved.lastVisitedLessonId).toBe('functions-basics')
  })

  it('accepts a negative number typed through the empty and minus-sign drafts', async () => {
    const user = userEvent.setup()
    renderLesson()
    const input = screen.getByRole('spinbutton', { name: 'x 的值' })

    await user.clear(input)
    await user.type(input, '-4')

    expect(input).toHaveValue(-4)
    expect(readStoredProgress().lessons['functions-basics'])
      .toMatchObject({ savedState: { x: -4, y: 3 } })
  })

  it('announces every single-step phase, not only printf and completion', () => {
    const { container } = renderLesson()
    submitGuidedPrediction()
    const liveRegion = container.querySelector('[aria-live="polite"]')

    expect(liveRegion).toHaveTextContent('進入 main')
    step(4)
    expect(liveRegion).toHaveTextContent('綁定參數 a、b')
    expect(liveRegion).toHaveTextContent('兩個參數都會在函式本體開始執行前')
  })

  it('synchronizes function arguments and clearing from another tab', async () => {
    renderLesson()
    submitGuidedPrediction()

    const external: ProgressV2 = {
      version: PROGRESS_VERSION,
      lessons: {
        'functions-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: [],
          savedState: { x: 9, y: -2 },
        },
      },
      lastVisitedLessonId: 'functions-basics',
    }
    seedProgress(external)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROGRESS_STORAGE_KEY,
        newValue: JSON.stringify(external),
        storageArea: window.localStorage,
      }))
    })

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'x 的值' })).toHaveValue(9)
      expect(screen.getByRole('spinbutton', { name: 'y 的值' })).toHaveValue(-2)
    })
    expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()

    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PROGRESS_STORAGE_KEY,
        newValue: null,
        storageArea: window.localStorage,
      }))
    })

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'x 的值' })).toHaveValue(4)
      expect(screen.getByRole('spinbutton', { name: 'y 的值' })).toHaveValue(3)
      expect(screen.queryByRole('button', { name: /執行下一步/ }))
        .not.toBeInTheDocument()
    })
  })
})

describe('FunctionLessonPage challenges and progress', () => {
  it('shows corrective feedback for every challenge, then completes the lesson', () => {
    renderLesson()

    setNumber('add 的回傳值', 6)
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
    expect(within(screen.getByRole('tabpanel')).getByRole('status'))
      .toHaveTextContent('再沿著呼叫流程想一次')

    setNumber('add 的回傳值', 7)
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
    expect(within(screen.getByRole('tabpanel')).getByRole('status'))
      .toHaveTextContent('答對了')

    fireEvent.click(screen.getByRole('tab', { name: /設定引數得到 10/ }))
    fireEvent.click(screen.getByRole('button', { name: '檢查回傳與輸出' }))
    expect(within(screen.getByRole('tabpanel')).getByRole('status'))
      .toHaveTextContent('實際回傳值還不是 10')

    setNumber('x 引數', 7)
    fireEvent.click(screen.getByRole('button', { name: '檢查回傳與輸出' }))
    expect(within(screen.getByRole('tabpanel')).getByRole('status'))
      .toHaveTextContent('add(7, 3) 回傳 10')

    fireEvent.click(screen.getByRole('tab', { name: /誰還在 main 的作用域/ }))
    fireEvent.click(screen.getByRole('radio', { name: /result/ }))
    fireEvent.click(screen.getByRole('button', { name: '檢查作用域' }))
    expect(within(screen.getByRole('tabpanel')).getByRole('status'))
      .toHaveTextContent('a、b 與區域變數 result 都不能由 main 直接讀取')

    fireEvent.click(screen.getByRole('radio', { name: /answer/ }))
    fireEvent.click(screen.getByRole('button', { name: '檢查作用域' }))
    expect(within(screen.getByRole('tabpanel')).getByRole('status'))
      .toHaveTextContent('answer 宣告在 main 裡')

    expect(screen.getByRole('heading', {
      name: /你已完成函式、參數與回傳值單元/,
    })).toBeInTheDocument()
    expect(readStoredProgress().lessons['functions-basics'])
      .toMatchObject({ completedChallengeIds: [...FUNCTION_CHALLENGE_IDS] })
  })

  it('reloads saved function arguments, unlocked playback, and challenge progress', () => {
    seedProgress({
      version: PROGRESS_VERSION,
      lessons: {
        'functions-basics': {
          guidedRunCompleted: true,
          completedChallengeIds: ['predict-return-value'],
          savedState: { x: -6, y: 11 },
        },
      },
      lastVisitedLessonId: 'functions-basics',
    })
    renderLesson()

    expect(screen.getByRole('spinbutton', { name: 'x 的值' })).toHaveValue(-6)
    expect(screen.getByRole('spinbutton', { name: 'y 的值' })).toHaveValue(11)
    expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
    expect(screen.getByRole('tab', { name: /預測 add 的回傳值/ }))
      .toHaveTextContent('已完成')
    expect(screen.getByRole('tab', { name: /設定引數得到 10/ }))
      .toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('1/3')
  })

  it('keeps saved progress until the learner confirms clearing it', async () => {
    renderLesson()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', {
      name: /清除這台裝置的學習進度/,
    }))
    let dialog = screen.getByRole('alertdialog', { name: /確定清除全部進度/ })
    expect(dialog).not.toHaveAttribute('aria-modal')
    expect(within(dialog).getByRole('button', { name: '確定清除' })).toHaveFocus()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()
    await waitFor(() => expect(screen.getByRole('button', {
      name: /清除這台裝置的學習進度/,
    })).toHaveFocus())

    fireEvent.click(screen.getByRole('button', {
      name: /清除這台裝置的學習進度/,
    }))
    dialog = screen.getByRole('alertdialog', { name: /確定清除全部進度/ })
    fireEvent.click(within(dialog).getByRole('button', { name: '確定清除' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(
      '提交上方預測後解鎖播放與單步控制',
    )
  })
})
