import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { POINTER_CHALLENGE_IDS } from '../data/pointerChallenges'
import { DEFAULT_POINTER_CONFIG } from '../domain/pointers'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, type ProgressV2 } from '../state'
import { PointerLessonPage } from './PointerLessonPage'

function renderLesson() {
  return render(<ProgressProvider><MemoryRouter><PointerLessonPage /></MemoryRouter></ProgressProvider>)
}
function setNumber(label: string, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
}
function predict(value = 5) {
  setNumber('我預測 selected 會收到', value)
  fireEvent.click(screen.getByRole('button', { name: /提交預測/ }))
}
function step(times = 1) {
  for (let index = 0; index < times; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: '指標執行：執行下一步' }))
  }
}
function savedProgress(): ProgressV2 {
  return JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as ProgressV2
}

beforeEach(() => window.localStorage.clear())

describe('PointerLessonPage guided execution', () => {
  it('requires an integer prediction and reveals the result only at the read step', () => {
    renderLesson()
    expect(screen.getByRole('heading', { level: 1, name: /指標、位址與間接存取/ })).toBeInTheDocument()
    expect(screen.getByText(/位址是教學示意/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /指標執行：執行下一步/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /提交預測/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('請先輸入一個整數')
    predict(9)
    expect(screen.getByText(/預測已記錄/)).toBeInTheDocument()
    expect(screen.queryByText(/實際讀到 5/)).not.toBeInTheDocument()
    step(2)
    expect(screen.getByLabelText('指標 p，0x1000')).toHaveTextContent('指向 x')
    step()
    expect(screen.getByText(/你猜 9，實際讀到 5/)).toBeInTheDocument()
    expect(screen.getByLabelText('C 程式碼，目前執行第 7 行')).toHaveTextContent('selected = *p;')
    expect(screen.getByLabelText('selected，5')).toBeInTheDocument()
  })

  it('writes through p to x while preserving the address, y and selected', () => {
    renderLesson()
    predict()
    step(4)
    expect(screen.getByLabelText('x，12，p 指向這格')).toHaveTextContent('寫入')
    expect(screen.getByLabelText('y，9')).toBeInTheDocument()
    expect(screen.getByLabelText('selected，5')).toBeInTheDocument()
    expect(screen.getByLabelText('指標 p，0x1000')).toBeInTheDocument()
    expect(screen.getByLabelText('指標程式輸出')).toHaveTextContent('尚無輸出')
    step()
    expect(screen.getByLabelText('指標程式輸出')).toHaveTextContent('5 -> 12')
    step(2)
    expect(savedProgress().lessons['pointers-basics']?.guidedRunCompleted).toBe(true)
    expect(screen.getByLabelText('x，離開作用域')).toHaveTextContent('—')
    expect(screen.getByLabelText('selected，離開作用域')).toHaveTextContent('—')
    expect(screen.getByRole('button', { name: '指標執行：執行下一步' })).toBeDisabled()
  })

  it('follows y after changing the target, then resets the trace when parameters change', () => {
    renderLesson()
    fireEvent.change(screen.getByRole('combobox', { name: 'p 要指向哪裡？' }), { target: { value: 'y' } })
    setNumber('newValue 的值', -8)
    predict(9)
    step(4)
    expect(screen.getByLabelText('y，-8，p 指向這格')).toBeInTheDocument()
    expect(screen.getByLabelText('x，5')).toBeInTheDocument()
    expect(screen.getByLabelText('selected，9')).toBeInTheDocument()
    expect(screen.getByLabelText('指標 p，0x1004')).toBeInTheDocument()
    setNumber('x 的值', 6)
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /指標執行：執行下一步/ })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '我預測 selected 會收到' })).toHaveValue(null)
    expect(screen.getByLabelText('指標程式輸出')).toHaveTextContent('尚無輸出')
    expect(savedProgress().lessons['pointers-basics']?.savedState).toEqual({ x: 6, y: 9, newValue: -8, target: 'y' })
  })

  it('automatically unlocks NULL and stops before dereferencing without completing the run', () => {
    renderLesson()
    fireEvent.change(screen.getByRole('combobox', { name: 'p 要指向哪裡？' }), { target: { value: 'null' } })
    expect(screen.queryByRole('spinbutton', { name: '我預測 selected 會收到' })).not.toBeInTheDocument()
    step(3)
    expect(screen.getByRole('alert')).toHaveTextContent('p 是 NULL，不能解參照')
    expect(screen.getByLabelText('指標 p，NULL')).toHaveTextContent('沒有指向有效物件')
    expect(screen.getByLabelText('selected，尚未宣告')).toBeInTheDocument()
    expect(screen.getByLabelText('指標程式輸出')).toHaveTextContent('尚無輸出')
    expect(screen.getByRole('button', { name: '指標執行：執行下一步' })).toBeDisabled()
    expect(savedProgress().lessons['pointers-basics']?.guidedRunCompleted).toBe(false)
  })

  it('keeps a saved NULL scenario playable after reload', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2, lastVisitedLessonId: 'pointers-basics', lessons: {
        'pointers-basics': { guidedRunCompleted: false, completedChallengeIds: [], savedState: { ...DEFAULT_POINTER_CONFIG, target: 'null' } },
      },
    }))
    renderLesson()
    expect(screen.getByRole('combobox', { name: 'p 要指向哪裡？' })).toHaveValue('null')
    step(3)
    expect(screen.getByRole('alert')).toHaveTextContent('不能解參照')
  })

  it('stops invalid integer input and leaves the last valid saved configuration intact', () => {
    renderLesson()
    setNumber('newValue 的值', 8)
    setNumber('newValue 的值', 2.5)
    expect(screen.getByRole('spinbutton', { name: 'newValue 的值' })).toHaveValue(2.5)
    step()
    expect(screen.getByRole('alert')).toHaveTextContent('newValue 必須是有限整數')
    expect(screen.getByLabelText('x，尚未宣告')).toBeInTheDocument()
    expect(savedProgress().lessons['pointers-basics']?.savedState).toEqual({ ...DEFAULT_POINTER_CONFIG, newValue: 8 })
  })

  it('can play, pause, change speed and reset the synced panels', () => {
    vi.useFakeTimers()
    try {
      renderLesson()
      predict()
      fireEvent.click(screen.getByRole('button', { name: '指標執行：2 倍速' }))
      fireEvent.click(screen.getByRole('button', { name: '指標執行：開始播放' }))
      act(() => { vi.advanceTimersByTime(380) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 5 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '指標執行：暫停播放' }))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 5 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '指標執行：回到第一步' }))
      expect(screen.getByLabelText('x，尚未宣告')).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})

describe('PointerLessonPage challenge progress', () => {
  it('evaluates all three challenges, preserves other lessons and restores completion on reload', () => {
    const existing = { guidedRunCompleted: true, completedChallengeIds: ['predict-index-read'], savedState: { index: 2, newValue: 10 } }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2, lessons: { 'arrays-basics': existing }, lastVisitedLessonId: 'arrays-basics',
    }))
    const view = renderLesson()
    predict()
    const challengeTabs = screen.getByRole('tablist', { name: '指標學習挑戰' })
    setNumber('預測 *p 的輸出', 9)
    fireEvent.click(screen.getByRole('button', { name: '檢查讀取答案' }))
    expect(savedProgress().lessons['pointers-basics']).toBeUndefined()
    setNumber('預測 *p 的輸出', 5)
    fireEvent.click(screen.getByRole('button', { name: '檢查讀取答案' }))
    expect(screen.getByRole('button', { name: '指標執行：執行下一步' })).toBeEnabled()
    fireEvent.keyDown(within(challengeTabs).getAllByRole('tab')[0], { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: /透過指標把 y 改成 12/ })).toHaveAttribute('aria-selected', 'true')
    setNumber('要透過 *p 寫入的新值', 12)
    fireEvent.click(screen.getByRole('button', { name: '檢查改寫結果' }))
    fireEvent.click(screen.getByRole('tab', { name: /判斷 NULL 能否解參照/ }))
    fireEvent.click(screen.getByRole('radio', { name: '可以，會讀到 0' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查安全判斷' }))
    expect(savedProgress().lessons['pointers-basics']?.completedChallengeIds).toHaveLength(2)
    fireEvent.click(screen.getByRole('radio', { name: '不可以，NULL 沒有指向有效物件' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查安全判斷' }))
    expect(savedProgress().lessons['pointers-basics']?.completedChallengeIds).toEqual(POINTER_CHALLENGE_IDS)
    expect(savedProgress().lessons['arrays-basics']).toEqual(existing)
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
    view.unmount()
    renderLesson()
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('3/3')
    expect(within(screen.getByRole('tablist', { name: '指標學習挑戰' })).getAllByText('已完成')).toHaveLength(3)
  })

  it('responds to updated saved config and guided progress from another browser tab', () => {
    renderLesson()
    predict()
    step(3)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2, lastVisitedLessonId: 'pointers-basics', lessons: {
        'pointers-basics': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { ...DEFAULT_POINTER_CONFIG, target: 'y', y: 17 } },
      },
    }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByRole('spinbutton', { name: 'y 的值' })).toHaveValue(17)
    expect(screen.getByRole('combobox', { name: 'p 要指向哪裡？' })).toHaveValue('y')
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '指標執行：執行下一步' })).toBeEnabled()
    step(3)
    expect(screen.getByLabelText('selected，17')).toBeInTheDocument()
  })

  it('resets an unsaved in-progress prediction when another tab clears all progress', () => {
    renderLesson()
    predict()
    step(3)
    expect(screen.getByLabelText('selected，5')).toBeInTheDocument()
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '我預測 selected 會收到' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: '指標執行：執行下一步' })).not.toBeInTheDocument()
    expect(screen.queryByText(/你猜 5，實際讀到 5/)).not.toBeInTheDocument()
  })
})
