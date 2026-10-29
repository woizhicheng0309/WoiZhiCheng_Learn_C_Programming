import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TRAVERSAL_CHALLENGE_IDS } from '../data/traversalChallenges'
import { DEFAULT_TRAVERSAL_CONFIG } from '../domain/traversal'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, type ProgressV2 } from '../state'
import { PointerTraversalLessonPage } from './PointerTraversalLessonPage'

function renderLesson() {
  return render(<StrictMode><ProgressProvider><MemoryRouter><PointerTraversalLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
}
function setCount(value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name: '要讀取的元素數量 count' }), { target: { value: String(value) } })
}
function predict(value = '4 7 2 9 5') {
  fireEvent.change(screen.getByRole('textbox', { name: '預測 printf 的完整輸出' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: /提交.*預測/ }))
}
function nextButton() { return screen.getByRole<HTMLButtonElement>('button', { name: '走訪執行：執行下一步' }) }
function step(times = 1) { for (let index = 0; index < times; index += 1) fireEvent.click(nextButton()) }
function finish() {
  for (let index = 0; index < 100; index += 1) { if (nextButton().disabled) return; step() }
  throw new Error('Traversal did not reach a terminal step.')
}
function stored(): ProgressV2 {
  return JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as ProgressV2
}

beforeEach(() => window.localStorage.clear())

describe('PointerTraversalLessonPage step-by-step execution', () => {
  it('separates positioning from actual reads and keeps p and i distinct between increments', () => {
    renderLesson()
    expect(screen.getByRole('heading', { level: 1, name: /同一排資料.*讓指標帶你走一遍/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '走訪執行：執行下一步' })).not.toBeInTheDocument()
    predict()
    step(2)
    expect(screen.getByLabelText('指標 p，scores + 0')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'scores[0]，4，p 指向這格' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: /目前讀取/ })).not.toBeInTheDocument()
    step(3)
    expect(screen.getByLabelText('C 程式碼，目前執行第 7 行')).toHaveTextContent('printf("%d ", *p)')
    expect(screen.getByRole('listitem', { name: 'scores[0]，4，目前讀取' })).toBeInTheDocument()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('4')
    step()
    expect(screen.getByLabelText('指標 p，scores + 1')).toBeInTheDocument()
    expect(screen.getByLabelText('迴圈變數 i，0')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'scores[1]，7，p 指向這格' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: /目前讀取/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('4')
  })

  it('reveals the normalized full output only at completion and distinguishes the tail position', () => {
    renderLesson()
    predict(' 4   7  2 9 5 ')
    for (let index = 0; index < 100 && !screen.queryByLabelText('條件 i 小於 5，false'); index += 1) step()
    expect(screen.getByLabelText('條件 i 小於 5，false')).toBeInTheDocument()
    expect(screen.getByLabelText('迴圈變數 i，離開迴圈作用域')).toBeInTheDocument()
    expect(screen.getByLabelText('指標 p，scores + 5')).toHaveTextContent('p 保存尾後位置的位址')
    expect(screen.getByLabelText('scores + 5，尾後位置，不是陣列元素，不可解參照')).toHaveTextContent('—')
    expect(screen.getByRole('list', { name: 'scores 的五個元素' }).querySelectorAll('[role="listitem"]')).toHaveLength(5)
    expect(screen.getByText('預測已記錄。走訪結束後再比對完整輸出。')).toBeInTheDocument()
    finish()
    expect(screen.getByText(/你預測「4 7 2 9 5」，實際「4 7 2 9 5」。預測正確/)).toBeInTheDocument()
    expect(stored().lessons['pointers-traversal']?.guidedRunCompleted).toBe(true)
    expect(screen.getByRole('listitem', { name: 'scores[4]，離開作用域' })).toHaveTextContent('—')
  })

  it('accepts wrong predictions, and index mode produces the same values without a pointer', () => {
    renderLesson()
    predict('9 5')
    finish()
    expect(screen.getByText(/你預測「9 5」，實際「4 7 2 9 5」/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '索引走訪：scores[i]' }))
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toHaveTextContent('printf("%d ", scores[i])')
    expect(screen.queryByLabelText(/指標 p，/)).not.toBeInTheDocument()
    finish()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('4 7 2 9 5')
  })

  it('allows an explicitly submitted blank prediction when count is zero', () => {
    renderLesson()
    setCount(0)
    expect(screen.getByRole('button', { name: '提交空輸出或預測' })).toBeInTheDocument()
    predict('')
    finish()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('（無輸出）')
    expect(screen.getByText(/你預測「無輸出」，實際「無輸出」。預測正確/)).toBeInTheDocument()
    expect(stored().lessons['pointers-traversal']?.guidedRunCompleted).toBe(true)
  })

  it('validates prediction syntax and resets all execution state when the count changes', () => {
    renderLesson()
    predict('')
    expect(screen.getByRole('alert')).toHaveTextContent('請以空白分隔整數')
    predict('4,7,2,9,5')
    expect(screen.queryByRole('button', { name: '走訪執行：執行下一步' })).not.toBeInTheDocument()
    predict()
    step(5)
    setCount(2)
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('尚無輸出')
    expect(screen.getByRole('textbox', { name: '預測 printf 的完整輸出' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: '走訪執行：執行下一步' })).not.toBeInTheDocument()
    expect(stored().lessons['pointers-traversal']?.savedState).toEqual({ count: 2, mode: 'pointer' })
    predict('4 7')
    finish()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('4 7')
  })

  it('blocks a sixth pointer read before dereferencing one-past and restores that playable scenario', () => {
    const view = renderLesson()
    setCount(6)
    expect(screen.queryByRole('textbox', { name: '預測 printf 的完整輸出' })).not.toBeInTheDocument()
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('不可解參照')
    expect(screen.getByLabelText('C 程式碼，目前執行第 7 行')).toBeInTheDocument()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('4 7 2 9 5')
    expect(screen.getByLabelText('指標 p，scores + 5')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'scores 的五個元素' }).querySelectorAll('[role="listitem"]')).toHaveLength(5)
    expect(screen.queryByRole('listitem', { name: /目前讀取/ })).not.toBeInTheDocument()
    expect(stored().lessons['pointers-traversal']?.guidedRunCompleted).toBe(false)
    expect(stored().lessons['pointers-traversal']?.savedState).toEqual({ count: 6, mode: 'pointer' })
    view.unmount()
    renderLesson()
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('沒有第六筆值')
    expect(stored().lessons['pointers-traversal']?.guidedRunCompleted).toBe(false)
  })

  it('also stops an index-mode sixth read and marks the same boundary without inventing an element', () => {
    renderLesson()
    fireEvent.click(screen.getByRole('radio', { name: '索引走訪：scores[i]' }))
    setCount(6)
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('scores[5] 超出合法索引')
    expect(screen.getByLabelText('scores + 5，尾後位置，不是陣列元素，不可解參照')).toHaveClass('is-pointed')
    expect(screen.queryByLabelText(/指標 p，/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('走訪程式輸出')).toHaveTextContent('4 7 2 9 5')
  })

  it('blocks invalid counts without overwriting the last valid saved state', () => {
    renderLesson()
    setCount(3)
    setCount(7)
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('走訪次數必須介於 0 到 6')
    expect(screen.getByRole('listitem', { name: 'scores[0]，尚未建立' })).toBeInTheDocument()
    expect(stored().lessons['pointers-traversal']?.savedState).toEqual({ count: 3, mode: 'pointer' })
  })

  it('supports speed, play, pause and returning to the first step', () => {
    vi.useFakeTimers()
    try {
      renderLesson()
      predict()
      fireEvent.click(screen.getByRole('button', { name: '走訪執行：2 倍速' }))
      fireEvent.click(screen.getByRole('button', { name: '走訪執行：開始播放' }))
      act(() => { vi.advanceTimersByTime(380) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '走訪執行：暫停播放' }))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '走訪執行：回到第一步' }))
      expect(screen.getByRole('listitem', { name: 'scores[0]，尚未建立' })).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})

describe('PointerTraversalLessonPage progress', () => {
  it('evaluates three challenges and restores completion while preserving other lessons', () => {
    const existing = { guidedRunCompleted: true, completedChallengeIds: ['predict-value-swap'], savedState: { x: 5, y: 9, mode: 'value' } }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lessons: { 'pointers-swap': existing }, lastVisitedLessonId: 'pointers-swap' }))
    const view = renderLesson()
    predict()
    fireEvent.change(screen.getByRole('spinbutton', { name: '預測 *(p + 2) 的值' }), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查位移答案' }))
    expect(stored().lessons['pointers-traversal']).toBeUndefined()
    fireEvent.change(screen.getByRole('spinbutton', { name: '預測 *(p + 2) 的值' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查位移答案' }))
    expect(nextButton()).toBeEnabled()
    fireEvent.keyDown(screen.getByRole('tab', { name: /預測指標偏移讀到的值/ }), { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('radio', { name: '一個 int 元素，也就是 sizeof(*p) bytes' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查前進單位' }))
    fireEvent.click(screen.getByRole('tab', { name: /區分尾端下一格與合法元素/ }))
    fireEvent.click(screen.getByRole('radio', { name: '可以形成這個指標，但不可解參照' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查尾後邊界' }))
    expect(stored().lessons['pointers-traversal']?.completedChallengeIds).toEqual(TRAVERSAL_CHALLENGE_IDS)
    expect(stored().lessons['pointers-traversal']?.savedState).toEqual(DEFAULT_TRAVERSAL_CONFIG)
    expect(stored().lessons['pointers-swap']).toEqual(existing)
    view.unmount()
    renderLesson()
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
    expect(within(screen.getByRole('tablist', { name: '走訪學習挑戰' })).getAllByText('已完成')).toHaveLength(3)
  })

  it('synchronizes saved mode and count from another tab, including the sixth-read scenario', () => {
    renderLesson()
    predict()
    step(5)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2, lastVisitedLessonId: 'pointers-traversal', lessons: {
        'pointers-traversal': { guidedRunCompleted: false, completedChallengeIds: [], savedState: { count: 6, mode: 'index' } },
      },
    }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByRole('radio', { name: '索引走訪：scores[i]' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: '要讀取的元素數量 count' })).toHaveValue(6)
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('scores[5] 超出合法索引')
  })

  it('resets a running prediction when progress is cleared externally', () => {
    renderLesson()
    predict()
    step(5)
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '預測 printf 的完整輸出' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: '走訪執行：執行下一步' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('completes after another tab visits another lesson, then resets without recreating cleared progress', () => {
    renderLesson()
    predict()
    step(5)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ ...stored(), lastVisitedLessonId: 'loops-for' }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    finish()
    expect(stored().lessons['pointers-traversal']?.guidedRunCompleted).toBe(true)
    expect(stored().lastVisitedLessonId).toBe('loops-for')
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '走訪執行：執行下一步' })).not.toBeInTheDocument()
  })
})
