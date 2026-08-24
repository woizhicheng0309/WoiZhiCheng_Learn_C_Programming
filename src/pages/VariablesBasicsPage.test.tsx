import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { VARIABLE_CHALLENGE_IDS } from '../data/variableChallenges'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY } from '../state'
import { VariablesBasicsPage } from './VariablesBasicsPage'

function renderPage() {
  return render(
    <ProgressProvider>
      <MemoryRouter>
        <VariablesBasicsPage />
      </MemoryRouter>
    </ProgressProvider>,
  )
}

function submitGuidedPrediction(value = 7) {
  fireEvent.change(
    screen.getByRole('spinbutton', { name: '我預測 printf 會輸出' }),
    { target: { value: String(value) } },
  )
  fireEvent.click(screen.getByRole('button', { name: /提交預測/ }))
}

function step(times = 1) {
  for (let index = 0; index < times; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
  }
}

function setNumber(name: string | RegExp, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name }), {
    target: { value: String(value) },
  })
}

function expressionPanel() {
  return screen.getByRole('heading', { name: '算式與輸出' }).closest('section')!
}

function printfOutput() {
  const label = within(expressionPanel()).getByText('printf 輸出')
  return label.parentElement?.nextElementSibling
}

describe('VariablesBasicsPage guided laboratory', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(0), 0)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('records a prediction, unlocks single-step playback, and reveals the comparison at printf', () => {
    renderPage()

    expect(screen.getByText(/提交上方預測後解鎖/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '執行下一步' })).not.toBeInTheDocument()

    submitGuidedPrediction()

    expect(screen.getByRole('status')).toHaveTextContent('預測已記錄')
    expect(screen.queryByText('預測正確！')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '執行下一步' })).toBeEnabled()

    step(6)
    expect(screen.getByRole('status')).toHaveTextContent('預測正確')
    expect(screen.getByRole('status')).toHaveTextContent('實際是 7')
  })

  it('single-steps through memory changes and resets to the first frame', () => {
    renderPage()
    submitGuidedPrediction()

    expect(screen.getByLabelText('x：尚未宣告')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('x：5')).toBeInTheDocument()
    expect(screen.getByLabelText('y：尚未宣告')).toBeInTheDocument()

    step()
    expect(screen.getByLabelText('y：2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '回到第一步' }))
    expect(screen.getByLabelText('x：尚未宣告')).toBeInTheDocument()
    expect(screen.getByLabelText('y：尚未宣告')).toBeInTheDocument()
  })

  it('clears the old trace when a parameter changes and keeps source, memory, and output synchronized', () => {
    renderPage()
    submitGuidedPrediction()

    step(6)
    expect(printfOutput()).toHaveTextContent('7')

    setNumber('x 的值', 6)

    expect(screen.getByLabelText(/C 程式碼，目前執行第 3 行/)).toHaveTextContent(
      'int x = 6;',
    )
    expect(screen.getByLabelText('x：尚未宣告')).toBeInTheDocument()
    expect(within(expressionPanel()).getByText('尚無輸出')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '回到第一步' })).toBeDisabled()

    step(6)
    expect(printfOutput()).toHaveTextContent('8')
  })

  it('surfaces division by zero and double modulo as distinct blocked executions', () => {
    renderPage()
    submitGuidedPrediction()

    fireEvent.change(screen.getByRole('combobox', { name: '算術運算子' }), {
      target: { value: '/' },
    })
    setNumber('y 的值', 0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    step(4)
    expect(screen.getByRole('alert')).toHaveTextContent('已阻止不合法的運算')
    expect(screen.getByRole('alert')).toHaveTextContent('除數 y 是 0')

    fireEvent.click(screen.getByRole('radio', { name: /double/ }))
    fireEvent.change(screen.getByRole('combobox', { name: '算術運算子' }), {
      target: { value: '%' },
    })
    step(4)

    expect(screen.getByRole('alert')).toHaveTextContent('% 只能用於整數')
    expect(screen.getByLabelText(/C 程式碼，目前執行第 7 行/)).toHaveTextContent(
      'double result',
    )
  })
})

describe('VariablesBasicsPage challenges and V2 progress', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(0), 0)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes prediction, configuration, and diagnosis challenges before completing the lesson', () => {
    renderPage()

    expect(screen.queryByLabelText('5 除以 2 的逐步執行軌跡')).not.toBeInTheDocument()
    setNumber('我預測輸出是', 2)
    fireEvent.click(screen.getByRole('button', { name: '提交並揭曉' }))
    expect(screen.getByText(/答對了.*int 除法/)).toBeInTheDocument()
    expect(screen.getByLabelText('5 除以 2 的逐步執行軌跡')).toHaveTextContent(
      '進入 main',
    )

    fireEvent.click(screen.getByRole('tab', { name: /組合出 14/ }))
    setNumber('x', 7)
    setNumber('y', 7)
    fireEvent.click(screen.getByRole('button', { name: '檢查實際輸出' }))
    expect(screen.getByText(/實際輸出是 14/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /找出錯誤並修好/ }))
    fireEvent.click(screen.getByRole('radio', { name: '除數 y 是 0' }))
    setNumber('第二步：只調整 y', 2)
    fireEvent.click(screen.getByRole('button', { name: '檢查診斷與修正' }))

    expect(screen.getByRole('heading', {
      name: /你已完成變數與運算單元/,
    })).toBeInTheDocument()

    const stored = JSON.parse(
      window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}',
    ) as {
      version?: number
      lastVisitedLessonId?: string
      lessons?: Record<string, { completedChallengeIds: string[] }>
    }
    expect(stored).toMatchObject({
      version: 2,
      lastVisitedLessonId: 'variables-basics',
      lessons: {
        'variables-basics': {
          completedChallengeIds: [...VARIABLE_CHALLENGE_IDS],
        },
      },
    })
  })

  it('supports arrow, End, and Home keys in the challenge tab list', async () => {
    const user = userEvent.setup()
    renderPage()

    const first = screen.getByRole('tab', { name: /先猜，再揭曉/ })
    first.focus()
    await user.keyboard('{ArrowRight}')

    const second = screen.getByRole('tab', { name: /組合出 14/ })
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')
    const third = screen.getByRole('tab', { name: /找出錯誤並修好/ })
    expect(third).toHaveFocus()
    expect(third).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(first).toHaveFocus()
    expect(first).toHaveAttribute('aria-selected', 'true')
  })

  it('focuses the clear confirmation, restores focus on Escape, and clears after confirmation', async () => {
    const user = userEvent.setup()
    renderPage()

    let trigger = screen.getByRole('button', {
      name: /清除這台裝置的學習進度/,
    })
    await user.click(trigger)

    let dialog = screen.getByRole('alertdialog', { name: /確定清除全部進度/ })
    expect(within(dialog).getByRole('button', { name: '確定清除' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    trigger = screen.getByRole('button', {
      name: /清除這台裝置的學習進度/,
    })
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()

    await user.click(trigger)
    dialog = screen.getByRole('alertdialog', { name: /確定清除全部進度/ })
    await user.click(within(dialog).getByRole('button', { name: '確定清除' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: /清除這台裝置的學習進度/,
    })).toHaveFocus()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  })
})
