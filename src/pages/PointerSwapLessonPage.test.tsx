import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SWAP_CHALLENGE_IDS } from '../data/swapChallenges'
import { DEFAULT_SWAP_CONFIG } from '../domain/swap'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, type ProgressV2 } from '../state'
import { PointerSwapLessonPage } from './PointerSwapLessonPage'

function renderLesson() {
  return render(<StrictMode><ProgressProvider><MemoryRouter><PointerSwapLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
}
function setNumber(label: string, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
}
function predict(x = 5, y = 9) {
  setNumber('預測 main 最後的 x', x)
  setNumber('預測 main 最後的 y', y)
  fireEvent.click(screen.getByRole('button', { name: /提交交換預測/ }))
}
function pointerMode() {
  fireEvent.click(screen.getByRole('radio', { name: '傳入位址：swap(&x, &y)' }))
}
function step(times = 1) {
  for (let index = 0; index < times; index += 1) fireEvent.click(screen.getByRole('button', { name: '交換執行：執行下一步' }))
}
function stored(): ProgressV2 {
  return JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as ProgressV2
}
function saveLesson(overrides = {}) {
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
    version: 2, lastVisitedLessonId: 'pointers-swap', lessons: {
      'pointers-swap': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { ...DEFAULT_SWAP_CONFIG, ...overrides } },
    },
  }))
}

beforeEach(() => window.localStorage.clear())

describe('PointerSwapLessonPage guided comparison', () => {
  it('requires two integer predictions and waits until printf to reveal the result', () => {
    renderLesson()
    expect(screen.getByRole('heading', { level: 1, name: /交換的是副本.*還是原本的變數/ })).toBeInTheDocument()
    expect(screen.getByText(/C 一律以值傳遞/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '交換執行：執行下一步' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /提交交換預測/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('請先輸入兩個整數')
    predict(9, 5)
    expect(screen.getByText('預測已記錄。等 main 執行 printf 後揭曉。')).toBeInTheDocument()
    step(8)
    expect(screen.getByLabelText('C 程式碼，目前執行第 7 行')).toBeInTheDocument()
    expect(screen.queryByText(/main 實際 x =/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('尚無輸出')
    step()
    expect(screen.getByText(/你預測 x = 9、y = 5；main 實際 x = 5、y = 9/)).toBeInTheDocument()
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('5 9')
  })

  it('changes only a and b in value mode while main waits, then retires local variables', () => {
    renderLesson()
    predict()
    step(4)
    expect(screen.getByLabelText('main 記憶體，暫停，等待 swap 回來')).toBeInTheDocument()
    expect(screen.getByLabelText('swap 的 a，5')).toBeInTheDocument()
    expect(screen.getByLabelText('swap 的 b，9')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('swap 的 temp，5')).toHaveClass('is-changed')
    step()
    expect(screen.getByLabelText('swap 的 a，9')).toHaveClass('is-changed')
    expect(screen.getByLabelText('main 的 x，5')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('swap 的 b，5')).toHaveClass('is-changed')
    expect(screen.getByLabelText('main 的 y，9')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('main 記憶體，執行中')).toBeInTheDocument()
    expect(screen.getByLabelText('swap 記憶體，已回傳，區域變數離開作用域')).toBeInTheDocument()
    expect(screen.getByLabelText('swap 的 temp，離開作用域')).toHaveTextContent('—')
    step(3)
    expect(stored().lessons['pointers-swap']?.guidedRunCompleted).toBe(true)
    expect(screen.getByLabelText('main 的 x，離開作用域')).toHaveTextContent('—')
    expect(screen.getByRole('button', { name: '交換執行：執行下一步' })).toBeDisabled()
  })

  it('writes caller variables through copied addresses without changing a and b', () => {
    renderLesson()
    pointerMode()
    predict(9, 5)
    expect(screen.getByLabelText('C 程式碼，目前執行第 9 行')).toHaveTextContent('swap(&x, &y)')
    step(4)
    expect(screen.getByLabelText('swap 的 a，&x')).toHaveTextContent('位址的副本')
    expect(screen.getByLabelText('swap 的 b，&y')).toHaveTextContent('位址的副本')
    step(2)
    expect(screen.getByLabelText('C 程式碼，目前執行第 5 行')).toHaveTextContent('*a = *b;')
    expect(screen.getByLabelText('main 的 x，9')).toHaveClass('is-changed')
    expect(screen.getByLabelText('main 的 y，9')).toBeInTheDocument()
    expect(screen.getByLabelText('swap 的 temp，5')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('main 的 y，5')).toHaveClass('is-changed')
    expect(screen.getByLabelText('swap 的 a，&x')).toBeInTheDocument()
    expect(screen.getByLabelText('swap 的 b，&y')).toBeInTheDocument()
    step(2)
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('9 5')
    expect(screen.getByText(/預測正確！/)).toBeInTheDocument()
  })

  it('resets code, memory, output and prediction when switching modes or editing values', () => {
    renderLesson()
    predict()
    step(9)
    pointerMode()
    expect(screen.getByLabelText('C 程式碼，目前執行第 9 行')).toHaveTextContent('void swap(int *a, int *b)')
    expect(screen.getByLabelText('main 的 x，尚未建立')).toBeInTheDocument()
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('尚無輸出')
    expect(screen.getByRole('spinbutton', { name: '預測 main 最後的 x' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: '交換執行：執行下一步' })).not.toBeInTheDocument()
    setNumber('x 的初始值', -8)
    expect(stored().lessons['pointers-swap']?.savedState).toEqual({ x: -8, y: 9, mode: 'pointer' })
    predict(9, -8)
    step(9)
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('9 -8')
  })

  it('restores saved pointer settings and allows a completed guide to explore another mode', () => {
    saveLesson({ x: -8, y: 17, mode: 'pointer' })
    const view = renderLesson()
    expect(screen.getByRole('radio', { name: '傳入位址：swap(&x, &y)' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: 'x 的初始值' })).toHaveValue(-8)
    expect(screen.getByRole('spinbutton', { name: 'y 的初始值' })).toHaveValue(17)
    step(9)
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('17 -8')
    fireEvent.click(screen.getByRole('radio', { name: '傳入整數值：swap(x, y)' }))
    step(9)
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('-8 17')
    view.unmount()
    renderLesson()
    expect(screen.getByRole('radio', { name: '傳入整數值：swap(x, y)' })).toBeChecked()
  })

  it('blocks invalid input before creating variables and preserves the last valid settings', () => {
    renderLesson()
    setNumber('x 的初始值', -8)
    setNumber('x 的初始值', 2.5)
    step()
    expect(screen.getByRole('alert')).toHaveTextContent('x 必須是有限整數')
    expect(screen.getByLabelText('main 的 x，尚未建立')).toBeInTheDocument()
    expect(stored().lessons['pointers-swap']?.savedState).toEqual({ x: -8, y: 9, mode: 'value' })
  })

  it('advances at the selected speed, pauses and resets the execution', () => {
    vi.useFakeTimers()
    try {
      renderLesson()
      predict()
      fireEvent.click(screen.getByRole('button', { name: '交換執行：2 倍速' }))
      fireEvent.click(screen.getByRole('button', { name: '交換執行：開始播放' }))
      act(() => { vi.advanceTimersByTime(380) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 10 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '交換執行：暫停播放' }))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 10 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '交換執行：回到第一步' }))
      expect(screen.getByLabelText('main 的 x，尚未建立')).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})

describe('PointerSwapLessonPage independent progress', () => {
  it('checks three challenges, keeps other lessons intact and restores completion', () => {
    const existing = { guidedRunCompleted: true, completedChallengeIds: ['predict-pointer-read'], savedState: { x: 5, y: 9, newValue: 12, target: 'x' } }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lessons: { 'pointers-basics': existing }, lastVisitedLessonId: 'pointers-basics' }))
    const view = renderLesson()
    predict()
    setNumber('值交換後 main 的 x', 9)
    setNumber('值交換後 main 的 y', 5)
    fireEvent.click(screen.getByRole('button', { name: '檢查值交換答案' }))
    expect(stored().lessons['pointers-swap']).toBeUndefined()
    setNumber('值交換後 main 的 x', 5)
    setNumber('值交換後 main 的 y', 9)
    fireEvent.click(screen.getByRole('button', { name: '檢查值交換答案' }))
    expect(screen.getByRole('button', { name: '交換執行：執行下一步' })).toBeEnabled()
    fireEvent.keyDown(screen.getByRole('tab', { name: /預測整數副本交換後的輸出/ }), { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('radio', { name: 'swap(&x, &y) · 傳入位址' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查呼叫方式' }))
    fireEvent.click(screen.getByRole('tab', { name: /為什麼交換需要 temp/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'x = 9，y = 9 · 原本的 5 已遺失' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查 temp 判斷' }))
    expect(stored().lessons['pointers-swap']?.completedChallengeIds).toEqual(SWAP_CHALLENGE_IDS)
    expect(stored().lessons['pointers-basics']).toEqual(existing)
    view.unmount()
    renderLesson()
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
    expect(within(screen.getByRole('tablist', { name: '交換學習挑戰' })).getAllByText('已完成')).toHaveLength(3)
  })

  it('applies configuration changes from another tab and resets the trace', () => {
    renderLesson()
    predict()
    step(7)
    saveLesson({ mode: 'pointer', x: -8, y: 17 })
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByRole('radio', { name: '傳入位址：swap(&x, &y)' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: 'x 的初始值' })).toHaveValue(-8)
    expect(screen.getByLabelText('C 程式碼，目前執行第 9 行')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '預測 main 最後的 x' })).toHaveValue(null)
    step(9)
    expect(screen.getByLabelText('交換程式輸出')).toHaveTextContent('17 -8')
  })

  it('clears a default unsaved prediction and its running trace when progress is removed externally', () => {
    renderLesson()
    predict()
    step(6)
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByLabelText('C 程式碼，目前執行第 9 行')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '預測 main 最後的 x' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: '交換執行：執行下一步' })).not.toBeInTheDocument()
    expect(screen.queryByText(/預測已記錄/)).not.toBeInTheDocument()
  })

  it('does not recreate completed guided progress while reacting to an external clear', () => {
    renderLesson()
    predict()
    step(11)
    expect(stored().lessons['pointers-swap']?.guidedRunCompleted).toBe(true)
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByLabelText('C 程式碼，目前執行第 9 行')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '交換執行：執行下一步' })).not.toBeInTheDocument()
  })

  it('still completes this run when another tab visits a different lesson', () => {
    renderLesson()
    predict()
    step(4)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ ...stored(), lastVisitedLessonId: 'loops-for' }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    step(7)
    expect(stored().lessons['pointers-swap']?.guidedRunCompleted).toBe(true)
    expect(stored().lastVisitedLessonId).toBe('loops-for')
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByLabelText('C 程式碼，目前執行第 9 行')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '交換執行：執行下一步' })).not.toBeInTheDocument()
  })
})
