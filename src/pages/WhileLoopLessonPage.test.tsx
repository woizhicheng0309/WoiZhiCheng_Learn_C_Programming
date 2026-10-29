import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WHILE_CHALLENGE_IDS } from '../data/whileChallenges'
import { DEFAULT_WHILE_CONFIG } from '../domain/whileLoops'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, type ProgressV2 } from '../state'
import { WhileLoopLessonPage } from './WhileLoopLessonPage'

function renderLesson() { return render(<StrictMode><ProgressProvider><MemoryRouter><WhileLoopLessonPage /></MemoryRouter></ProgressProvider></StrictMode>) }
function doMode() { fireEvent.click(screen.getByRole('radio', { name: 'do…while · 先執行本體' })) }
function setNumber(label: string, value: number) { fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } }) }
function predict(value = 3) { setNumber('預測本體執行次數', value); fireEvent.click(screen.getByRole('button', { name: /提交迴圈預測/ })) }
function nextButton() { return screen.getByRole<HTMLButtonElement>('button', { name: 'while 執行：執行下一步' }) }
function step(times = 1) { for (let index = 0; index < times; index += 1) fireEvent.click(nextButton()) }
function finish() {
  for (let index = 0; index < 400; index += 1) { if (nextButton().disabled) return; step() }
  throw new Error('While program did not reach a terminal step.')
}
function outputs() { return within(screen.getByRole('list', { name: 'printf 輸出數列' })).queryAllByRole('listitem').map((item) => Number(item.textContent)) }
function stored(): ProgressV2 { return JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as ProgressV2 }

beforeEach(() => window.localStorage.clear())

describe('WhileLoopLessonPage execution order', () => {
  it('requires a prediction, then synchronizes condition, body, update and output', () => {
    renderLesson()
    expect(screen.getByRole('heading', { level: 1, name: /先問條件.*或先做一次/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'while 執行：執行下一步' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /提交迴圈預測/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('請先輸入非負整數')
    predict(4)
    step(2)
    expect(screen.getByLabelText('條件判斷，true')).toHaveTextContent('0 < 3')
    expect(outputs()).toEqual([])
    expect(screen.getByLabelText('本體已執行 0 次')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'while 的執行順序' })).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
    step()
    expect(screen.getByLabelText('條件判斷，本步未判斷')).toHaveTextContent('—')
    expect(screen.getByLabelText('本體已執行 1 次')).toBeInTheDocument()
    expect(outputs()).toEqual([0])
    step()
    expect(screen.getByLabelText('目前 i，1')).toBeInTheDocument()
    expect(screen.getByLabelText('條件判斷，本步未判斷')).toBeInTheDocument()
    expect(screen.queryByText(/你預測 4 次，實際執行/)).not.toBeInTheDocument()
    finish()
    expect(outputs()).toEqual([0, 1, 2])
    expect(screen.getByText(/你預測 4 次，實際執行 3 次/)).toBeInTheDocument()
    expect(screen.getByLabelText('目前 i，離開作用域')).toHaveTextContent('—')
    expect(stored().lessons['loops-while-do-while']?.guidedRunCompleted).toBe(true)
  })

  it('executes zero while bodies when the first condition is false', () => {
    renderLesson()
    fireEvent.click(screen.getByRole('button', { name: '一開始條件不成立' }))
    predict(0)
    step(2)
    expect(screen.getByLabelText('條件判斷，false')).toHaveTextContent('5 < 3')
    expect(screen.getByLabelText('目前 i，5')).toBeInTheDocument()
    expect(screen.getByLabelText('本體已執行 0 次')).toBeInTheDocument()
    finish()
    expect(outputs()).toEqual([])
    expect(screen.getByText('（無輸出）')).toBeInTheDocument()
    expect(screen.getByText(/你預測 0 次，實際執行 0 次。預測正確/)).toBeInTheDocument()
  })

  it('does the first body and update before any do-while comparison, then compares the new i', () => {
    renderLesson()
    doMode()
    fireEvent.click(screen.getByRole('button', { name: '一開始條件不成立' }))
    expect(screen.getByRole('radio', { name: 'do…while · 先執行本體' })).toBeChecked()
    predict(1)
    step(2)
    expect(screen.getByLabelText('C 程式碼，目前執行第 6 行')).toBeInTheDocument()
    expect(screen.getByLabelText('條件判斷，本步未判斷')).toBeInTheDocument()
    expect(screen.queryByLabelText('條件判斷，false')).not.toBeInTheDocument()
    expect(screen.getByLabelText('本體已執行 1 次')).toBeInTheDocument()
    expect(outputs()).toEqual([5])
    step()
    expect(screen.getByLabelText('目前 i，6')).toBeInTheDocument()
    expect(screen.getByLabelText('條件判斷，本步未判斷')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('C 程式碼，目前執行第 8 行')).toBeInTheDocument()
    expect(screen.getByLabelText('條件判斷，false')).toHaveTextContent('6 < 3')
    expect(screen.getByText('預測已記錄。程式正常結束後再比對執行次數。')).toBeInTheDocument()
    finish()
    expect(screen.getByText(/你預測 1 次，實際執行 1 次。預測正確/)).toBeInTheDocument()
  })

  it.each(['while', 'do-while'])('runs the descending preset in %s while preserving the chosen mode', (mode) => {
    renderLesson()
    if (mode === 'do-while') doMode()
    fireEvent.click(screen.getByRole('button', { name: '倒數走訪' }))
    expect(screen.getByRole('spinbutton', { name: '更新值 step' })).toHaveValue(-1)
    expect(screen.getByRole('combobox', { name: '比較運算子' })).toHaveValue('>')
    predict(3)
    finish()
    expect(outputs()).toEqual([3, 2, 1])
    expect(stored().lessons['loops-while-do-while']?.savedState).toEqual({ mode, start: 3, end: 0, comparator: '>', step: -1 })
  })

  it.each([
    { mode: 'while', expected: [] }, { mode: 'do-while', expected: [0] },
  ])('blocks unchanged updates only after an actual true condition in $mode and restores the scenario', ({ mode, expected }) => {
    const view = renderLesson()
    if (mode === 'do-while') doMode()
    fireEvent.click(screen.getByRole('button', { name: '更新值不變' }))
    expect(screen.queryByRole('spinbutton', { name: '預測本體執行次數' })).not.toBeInTheDocument()
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('0')
    expect(outputs()).toEqual(expected)
    expect(screen.getByLabelText(`本體已執行 ${expected.length} 次`)).toBeInTheDocument()
    expect(stored().lessons['loops-while-do-while']?.guidedRunCompleted).toBe(false)
    expect(stored().lessons['loops-while-do-while']?.savedState?.step).toBe(0)
    view.unmount()
    renderLesson()
    expect(nextButton()).toBeEnabled()
    finish()
    expect(outputs()).toEqual(expected)
    expect(stored().lessons['loops-while-do-while']?.guidedRunCompleted).toBe(false)
  })

  it.each([
    { mode: 'while', bodies: 0, expected: [] }, { mode: 'do-while', bodies: 1, expected: [5] },
  ])('allows step zero when the actual condition is false in $mode', ({ mode, bodies, expected }) => {
    renderLesson()
    if (mode === 'do-while') doMode()
    fireEvent.click(screen.getByRole('button', { name: '一開始條件不成立' }))
    setNumber('更新值 step', 0)
    predict(bodies)
    finish()
    expect(outputs()).toEqual(expected)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(stored().lessons['loops-while-do-while']?.guidedRunCompleted).toBe(true)
  })

  it('resets output and prediction on a mode change, supports <=, and saves only valid integer controls', () => {
    renderLesson()
    predict()
    step(3)
    doMode()
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toHaveTextContent('do {')
    expect(outputs()).toEqual([])
    expect(screen.getByRole('spinbutton', { name: '預測本體執行次數' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: 'while 執行：執行下一步' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: '比較運算子' }), { target: { value: '<=' } })
    predict(4)
    finish()
    expect(outputs()).toEqual([0, 1, 2, 3])
    setNumber('起始值 start', 8)
    setNumber('起始值 start', 0.5)
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('start 必須是有限整數')
    expect(stored().lessons['loops-while-do-while']?.savedState).toEqual({ mode: 'do-while', start: 8, end: 3, comparator: '<=', step: 1 })
  })

  it('stops an update that moves away from the bound without inventing a complete prediction', () => {
    renderLesson()
    setNumber('更新值 step', -1)
    expect(screen.queryByRole('spinbutton', { name: '預測本體執行次數' })).not.toBeInTheDocument()
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('方向')
    expect(outputs()).toEqual([])
    expect(stored().lessons['loops-while-do-while']?.savedState?.step).toBe(-1)
    expect(stored().lessons['loops-while-do-while']?.guidedRunCompleted).toBe(false)
  })

  it('supports play, pause, speed and resetting to the first step', () => {
    vi.useFakeTimers()
    try {
      renderLesson()
      predict()
      fireEvent.click(screen.getByRole('button', { name: 'while 執行：2 倍速' }))
      fireEvent.click(screen.getByRole('button', { name: 'while 執行：開始播放' }))
      act(() => { vi.advanceTimersByTime(380) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'while 執行：暫停播放' }))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'while 執行：回到第一步' }))
      expect(screen.getByLabelText('目前 i，尚未宣告')).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})

describe('WhileLoopLessonPage persisted progress', () => {
  it('completes three independent challenges and restores progress', () => {
    const existing = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { start: 0, end: 5, comparator: '<', step: 1 } }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lessons: { 'loops-for': existing }, lastVisitedLessonId: 'loops-for' }))
    const view = renderLesson()
    predict()
    setNumber('while 本體會執行幾次？', 1)
    fireEvent.click(screen.getByRole('button', { name: '檢查 while 答案' }))
    expect(stored().lessons['loops-while-do-while']).toBeUndefined()
    setNumber('while 本體會執行幾次？', 0)
    fireEvent.click(screen.getByRole('button', { name: '檢查 while 答案' }))
    expect(nextButton()).toBeEnabled()
    fireEvent.keyDown(screen.getByRole('tab', { name: /預測 while 的零次執行/ }), { key: 'ArrowRight' })
    setNumber('do…while 本體會執行幾次？', 1)
    fireEvent.click(screen.getByRole('button', { name: '檢查 do…while 答案' }))
    fireEvent.click(screen.getByRole('tab', { name: /找出讓迴圈前進的更新/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'i++; · 每次增加 1' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查更新方式' }))
    expect(stored().lessons['loops-while-do-while']?.completedChallengeIds).toEqual(WHILE_CHALLENGE_IDS)
    expect(stored().lessons['loops-for']).toEqual(existing)
    view.unmount()
    renderLesson()
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
    expect(within(screen.getByRole('tablist', { name: 'while 學習挑戰' })).getAllByText('已完成')).toHaveLength(3)
  })

  it('loads a blocked saved config from another tab and resets when that progress is cleared', () => {
    renderLesson()
    predict()
    step(3)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'loops-while-do-while', lessons: {
      'loops-while-do-while': { guidedRunCompleted: false, completedChallengeIds: [], savedState: { ...DEFAULT_WHILE_CONFIG, mode: 'do-while', step: 0 } },
    } }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByRole('radio', { name: 'do…while · 先執行本體' })).toBeChecked()
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    finish()
    expect(outputs()).toEqual([0])
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByRole('radio', { name: 'while · 先判斷條件' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: '預測本體執行次數' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: 'while 執行：執行下一步' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('can finish after another tab visits another lesson, then clear without recreating completion', () => {
    renderLesson()
    predict()
    step(3)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ ...stored(), lastVisitedLessonId: 'loops-for' }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    finish()
    expect(stored().lessons['loops-while-do-while']?.guidedRunCompleted).toBe(true)
    expect(stored().lastVisitedLessonId).toBe('loops-for')
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'while 執行：執行下一步' })).not.toBeInTheDocument()
  })
})
