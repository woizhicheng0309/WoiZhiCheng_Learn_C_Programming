import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LOOP_CONTROL_CHALLENGE_IDS } from '../data/loopControlChallenges'
import { DEFAULT_LOOP_CONTROL_CONFIG } from '../domain/loopControl'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, type ProgressV2 } from '../state'
import { LoopControlLessonPage } from './LoopControlLessonPage'

function renderLesson() {
  return render(<StrictMode><ProgressProvider><MemoryRouter><LoopControlLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
}
function setNumber(label: string, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
}
function predict(value = 12) {
  setNumber('預測最後的 sum', value)
  fireEvent.click(screen.getByRole('button', { name: /提交總和預測/ }))
}
function nextButton() { return screen.getByRole<HTMLButtonElement>('button', { name: '流程控制執行：執行下一步' }) }
function step(times = 1) { for (let index = 0; index < times; index += 1) fireEvent.click(nextButton()) }
function finish() {
  for (let index = 0; index < 100; index += 1) {
    if (nextButton().disabled) return
    step()
  }
  throw new Error('Loop-control program did not reach a terminal step.')
}
function advanceToJump() {
  for (let index = 0; index < 100; index += 1) {
    if (screen.queryByLabelText('C 程式碼，目前執行第 7 行')) return
    step()
  }
  throw new Error('Loop-control program did not reach the jump.')
}
function outputs() {
  return within(screen.getByRole('list', { name: '迴圈內 printf 輸出數列' })).queryAllByRole('listitem').map((item) => Number(item.textContent))
}
function stored(): ProgressV2 { return JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as ProgressV2 }
function syncProgress(value: ProgressV2 | null) {
  if (value === null) window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
  else window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(value))
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
}
beforeEach(() => window.localStorage.clear())

describe('LoopControlLessonPage tracing', () => {
  it('requires a prediction and reveals the final sum only at the summary', () => {
    renderLesson()
    expect(screen.getByRole('heading', { level: 1, name: /離開這個迴圈.*或跳過這一輪/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /流程控制執行：執行下一步/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /提交總和預測/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('請先輸入非負整數')
    predict()
    step(2)
    expect(screen.getByLabelText('目前 i，1')).toBeInTheDocument()
    expect(screen.getByLabelText('目前 sum，0')).toBeInTheDocument()
    expect(screen.queryByText(/實際 sum = 12/)).not.toBeInTheDocument()
    finish()
    expect(outputs()).toEqual([1, 2, 4, 5])
    expect(screen.getByLabelText('迴圈後的總和輸出')).toHaveTextContent('sum = 12')
    expect(screen.getByText(/你預測 12，實際 sum = 12。預測正確/)).toBeInTheDocument()
    expect(screen.getByLabelText('目前 i，離開作用域')).toHaveTextContent('—')
    expect(screen.getByLabelText('目前 sum，離開作用域')).toHaveTextContent('—')
    expect(stored().lessons['loops-break-continue']?.guidedRunCompleted).toBe(true)
  })

  it('continues to the for update and skips the matched value in both sum and output', () => {
    renderLesson()
    predict()
    advanceToJump()
    expect(screen.getByLabelText('目前 i，3')).toBeInTheDocument()
    expect(screen.getByLabelText('目前 sum，3')).toBeInTheDocument()
    expect(outputs()).toEqual([1, 2])
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('跳過本次剩餘工作')
    step()
    expect(screen.getByLabelText('C 程式碼，目前執行第 5 行')).toBeInTheDocument()
    expect(screen.getByLabelText('目前 i，4')).toBeInTheDocument()
    expect(screen.getByLabelText('目前 sum，3')).toBeInTheDocument()
    expect(outputs()).toEqual([1, 2])
    finish()
    expect(outputs()).toEqual([1, 2, 4, 5])
  })

  it('breaks directly to the summary without updating i and hides the for-local variable', () => {
    renderLesson()
    fireEvent.click(screen.getByRole('radio', { name: 'break · 跳出這一層迴圈' }))
    predict(3)
    advanceToJump()
    expect(screen.getByLabelText('目前 i，3')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('C 程式碼，目前執行第 12 行')).toBeInTheDocument()
    expect(screen.getByLabelText('目前 i，離開作用域')).toHaveTextContent('—')
    expect(screen.getByLabelText('目前 sum，3')).toBeInTheDocument()
    expect(outputs()).toEqual([1, 2])
    expect(screen.getByText(/你預測 3，實際 sum = 3。預測正確/)).toBeInTheDocument()
  })

  it.each([
    { mode: 'break', trigger: 1, sum: 0, expected: [] },
    { mode: 'continue', trigger: 1, sum: 14, expected: [2, 3, 4, 5] },
    { mode: 'break', trigger: 5, sum: 10, expected: [1, 2, 3, 4] },
    { mode: 'continue', trigger: 6, sum: 15, expected: [1, 2, 3, 4, 5] },
  ])('handles $mode with trigger $trigger', ({ mode, trigger, sum, expected }) => {
    renderLesson()
    if (mode === 'break') fireEvent.click(screen.getByRole('radio', { name: 'break · 跳出這一層迴圈' }))
    setNumber('命中值 trigger', trigger)
    predict(sum)
    finish()
    expect(outputs()).toEqual(expected)
    expect(screen.getByLabelText('迴圈後的總和輸出')).toHaveTextContent(`sum = ${sum}`)
  })

  it('preserves an invalid local input through challenge progress without saving it', () => {
    renderLesson()
    setNumber('迴圈上限 end', 4)
    setNumber('命中值 trigger', 9)
    expect(screen.queryByRole('spinbutton', { name: '預測最後的 sum' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '迴圈內會依序輸出哪些數字？' }), { target: { value: '1 2' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查 break 輸出' }))
    expect(screen.getByRole('spinbutton', { name: '命中值 trigger' })).toHaveValue(9)
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('trigger')
    expect(outputs()).toEqual([])
    expect(stored().lessons['loops-break-continue']?.savedState).toEqual({ mode: 'continue', end: 4, trigger: 3 })
    expect(stored().lessons['loops-break-continue']?.guidedRunCompleted).toBe(false)
    expect(stored().lessons['loops-break-continue']?.completedChallengeIds).toEqual(['predict-break-output'])
  })

  it('resets the trace and prediction when changing modes', () => {
    renderLesson()
    predict()
    step(5)
    fireEvent.click(screen.getByRole('radio', { name: 'break · 跳出這一層迴圈' }))
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toHaveTextContent('break;')
    expect(outputs()).toEqual([])
    expect(screen.getByRole('spinbutton', { name: '預測最後的 sum' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: '流程控制執行：執行下一步' })).not.toBeInTheDocument()
  })
})

describe('LoopControlLessonPage progress and keyboard controls', () => {
  it('supports playback, pause, speed and resetting', () => {
    vi.useFakeTimers()
    try {
      renderLesson()
      predict()
      fireEvent.click(screen.getByRole('button', { name: '流程控制執行：2 倍速' }))
      fireEvent.click(screen.getByRole('button', { name: '流程控制執行：開始播放' }))
      act(() => { vi.advanceTimersByTime(380) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '流程控制執行：暫停播放' }))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '流程控制執行：回到第一步' }))
      expect(screen.getByLabelText('目前 i，尚未宣告')).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })

  it('completes three independent challenges with keyboard tab navigation and restores them', () => {
    const existing = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { start: 0, end: 5, comparator: '<', step: 1 } }
    syncProgress({ version: 2, lessons: { 'loops-for': existing }, lastVisitedLessonId: 'loops-for' })
    const view = renderLesson()
    fireEvent.change(screen.getByRole('textbox', { name: '迴圈內會依序輸出哪些數字？' }), { target: { value: '1 2 3' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查 break 輸出' }))
    expect(stored().lessons['loops-break-continue']).toBeUndefined()
    fireEvent.change(screen.getByRole('textbox', { name: '迴圈內會依序輸出哪些數字？' }), { target: { value: '1 2' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查 break 輸出' }))
    fireEvent.keyDown(screen.getByRole('tab', { name: /預測 break 前的輸出/ }), { key: 'ArrowRight' })
    setNumber('continue 範例最後的 sum 是多少？', 12)
    fireEvent.click(screen.getByRole('button', { name: '檢查 continue 總和' }))
    fireEvent.keyDown(screen.getByRole('tab', { name: /預測 continue 後的總和/ }), { key: 'End' })
    fireEvent.click(screen.getByRole('radio', { name: '執行更新 i++' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查下一步' }))
    expect(stored().lessons['loops-break-continue']?.completedChallengeIds).toEqual(LOOP_CONTROL_CHALLENGE_IDS)
    expect(stored().lessons['loops-for']).toEqual(existing)
    expect(screen.getByText('你已完成 break 與 continue。')).toBeInTheDocument()
    view.unmount()
    renderLesson()
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
    expect(within(screen.getByRole('tablist', { name: '流程控制學習挑戰' })).getAllByText('已完成')).toHaveLength(3)
  })

  it('synchronizes another tab and clears at the completed frame without recreating progress', () => {
    renderLesson()
    syncProgress({ version: 2, lastVisitedLessonId: 'loops-break-continue', lessons: {
      'loops-break-continue': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { mode: 'break', end: 4, trigger: 2 } },
    } })
    expect(screen.getByRole('radio', { name: 'break · 跳出這一層迴圈' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: '迴圈上限 end' })).toHaveValue(4)
    finish()
    expect(screen.getByLabelText('迴圈後的總和輸出')).toHaveTextContent('sum = 1')
    syncProgress(null)
    expect(screen.getByRole('radio', { name: 'continue · 跳過本次剩餘工作' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: '迴圈上限 end' })).toHaveValue(DEFAULT_LOOP_CONTROL_CONFIG.end)
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '流程控制執行：執行下一步' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  })
})
