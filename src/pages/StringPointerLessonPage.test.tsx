import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { STRING_POINTER_CHALLENGE_IDS } from '../data/stringPointerChallenges'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, type ProgressV2 } from '../state'
import { StringPointerLessonPage } from './StringPointerLessonPage'

function renderLesson() {
  return render(<StrictMode><ProgressProvider><MemoryRouter><StringPointerLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
}
function sample(value: string) { fireEvent.change(screen.getByRole('combobox', { name: '字串內容' }), { target: { value } }) }
function stopAt(value: string) { fireEvent.change(screen.getByRole('combobox', { name: '停止條件' }), { target: { value } }) }
function predict(value = 4) {
  fireEvent.change(screen.getByRole('spinbutton', { name: '預測最後的 length' }), { target: { value: String(value) } })
  fireEvent.click(screen.getByRole('button', { name: /提交長度預測/ }))
}
function nextButton() { return screen.getByRole<HTMLButtonElement>('button', { name: '字串執行：執行下一步' }) }
function step(times = 1) { for (let index = 0; index < times; index += 1) fireEvent.click(nextButton()) }
function finish() {
  for (let index = 0; index < 100; index += 1) { if (nextButton().disabled) return; step() }
  throw new Error('String-pointer program did not reach a terminal step.')
}
function output() { return screen.getByLabelText('putchar 已輸出的字元') }
function stored(): ProgressV2 { return JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as ProgressV2 }

beforeEach(() => window.localStorage.clear())

describe('StringPointerLessonPage character execution', () => {
  it('introduces distinct ASCII characters, and comparison reads do not emit or count a character', () => {
    renderLesson()
    expect(screen.getByRole('heading', { level: 1, name: /字串在哪裡結束/ })).toBeInTheDocument()
    expect(screen.getAllByText(/字串終止字元/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '字串執行：執行下一步' })).not.toBeInTheDocument()
    predict()
    step(4)
    expect(screen.getByRole('listitem', { name: 'text[0]，C，比較讀取' })).toHaveClass('is-comparing')
    expect(screen.getByLabelText('while 條件，true')).toHaveTextContent("目前讀到 'C'")
    expect(output()).toHaveTextContent('尚無輸出')
    expect(screen.getByLabelText('累計 length，0')).toBeInTheDocument()
    step()
    expect(screen.getByRole('listitem', { name: 'text[0]，C，輸出讀取' })).toHaveClass('is-emitting')
    expect(output().textContent).toBe('C')
    expect(screen.getByLabelText('累計 length，0')).toBeInTheDocument()
    step(2)
    expect(screen.getByLabelText('指標 p，text + 1')).toBeInTheDocument()
    expect(screen.getByLabelText('累計 length，1')).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: /比較讀取|輸出讀取/ })).not.toBeInTheDocument()
  })

  it('reads the final NUL in the condition, stops before emitting it, then prints length', () => {
    renderLesson()
    predict()
    for (let index = 0; index < 100 && !screen.queryByLabelText('while 條件，false'); index += 1) step()
    expect(screen.getByRole('listitem', { name: 'text[4]，\\0，字串終止字元，比較讀取' })).toBeInTheDocument()
    expect(output().textContent).toBe('CODE')
    expect(screen.getByLabelText('累計 length，4')).toBeInTheDocument()
    expect(screen.getByLabelText('printf 的 length')).toHaveTextContent('尚未輸出')
    expect(screen.getByText('預測已記錄。輸出 length 時再比對結果。')).toBeInTheDocument()
    expect(screen.getByLabelText('指標 p，text + 4')).toBeInTheDocument()
    step()
    expect(screen.getByLabelText('printf 的 length')).toHaveTextContent('4')
    expect(screen.getByText(/你預測 4，實際 length = 4。預測正確/)).toBeInTheDocument()
    finish()
    expect(stored().lessons['pointers-strings']?.guidedRunCompleted).toBe(true)
    expect(screen.getByRole('listitem', { name: 'text[0]，離開作用域' })).toHaveTextContent('—')
  })

  it.each([
    { id: 'digit-zero', answer: 4, emitted: 'C0DE', cells: 5 },
    { id: 'embedded-nul', answer: 2, emitted: 'CO', cells: 6 },
  ])('handles $id without losing the underlying character array', ({ id, answer, emitted, cells }) => {
    renderLesson()
    sample(id)
    predict(answer)
    step()
    expect(within(screen.getByRole('list', { name: 'text 的字元陣列' })).getAllByRole('listitem')).toHaveLength(cells)
    if (id === 'digit-zero') expect(screen.getByRole('listitem', { name: 'text[1]，0，數字零' })).toHaveTextContent('ASCII 48')
    else expect(screen.getByRole('listitem', { name: 'text[3]，D' })).toBeInTheDocument()
    finish()
    expect(output().textContent).toBe(emitted)
    expect(screen.getByLabelText('printf 的 length')).toHaveTextContent(String(answer))
    expect(screen.getByText(new RegExp(`你預測 ${answer}，實際 length = ${answer}。預測正確`))).toBeInTheDocument()
  })

  it('unlocks the wrong-sentinel controls, blocks before one-past reads and restores the scenario', () => {
    const view = renderLesson()
    stopAt('digit-zero')
    expect(screen.queryByRole('spinbutton', { name: '預測最後的 length' })).not.toBeInTheDocument()
    expect(output()).toHaveTextContent('尚無輸出')
    expect(nextButton()).toBeEnabled()
    finish()
    expect(screen.getByRole('alert')).toHaveTextContent('未定義行為')
    expect(screen.getByLabelText('C 程式碼，目前執行第 7 行')).toBeInTheDocument()
    expect(screen.getByLabelText('指標 p，text + 5')).toBeInTheDocument()
    expect(screen.getByLabelText('text + 5，尾後位置，不是字元，不可解參照')).toHaveTextContent('—')
    expect(screen.queryByRole('listitem', { name: /比較讀取|輸出讀取/ })).not.toBeInTheDocument()
    expect(output().textContent).toBe('CODE\\0')
    expect(screen.getByLabelText('累計 length，5')).toBeInTheDocument()
    expect(screen.getByLabelText('printf 的 length')).toHaveTextContent('尚未輸出')
    expect(screen.getByText(/代表實際輸出的不可見 NUL，不是反斜線與 0 兩個字元/)).toBeInTheDocument()
    expect(stored().lessons['pointers-strings']?.guidedRunCompleted).toBe(false)
    expect(stored().lessons['pointers-strings']?.savedState).toEqual({ sample: 'word', stopAt: 'digit-zero' })
    view.unmount()
    renderLesson()
    expect(nextButton()).toBeEnabled()
    finish()
    expect(output().textContent).toBe('CODE\\0')
    expect(stored().lessons['pointers-strings']?.guidedRunCompleted).toBe(false)
  })

  it('makes both emitted NUL bytes visible in the deliberately wrong embedded-NUL traversal', () => {
    renderLesson()
    sample('embedded-nul')
    stopAt('digit-zero')
    finish()
    expect(output().textContent).toBe('CO\\0DE\\0')
    expect(screen.getByLabelText('累計 length，6')).toBeInTheDocument()
    expect(screen.getByLabelText('指標 p，text + 6')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('printf 的 length')).toHaveTextContent('尚未輸出')
  })

  it('treats the digit-zero sentinel in C0DE as a defined early stop with length one', () => {
    renderLesson()
    sample('digit-zero')
    stopAt('digit-zero')
    expect(screen.getByRole('spinbutton', { name: '預測最後的 length' })).toBeInTheDocument()
    predict(1)
    for (let index = 0; index < 100 && !screen.queryByLabelText('while 條件，false'); index += 1) step()
    expect(screen.getByRole('listitem', { name: 'text[1]，0，數字零，比較讀取' })).toBeInTheDocument()
    expect(output().textContent).toBe('C')
    expect(screen.getByLabelText('累計 length，1')).toBeInTheDocument()
    finish()
    expect(screen.getByLabelText('printf 的 length')).toHaveTextContent('1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(stored().lessons['pointers-strings']?.guidedRunCompleted).toBe(true)
  })

  it('validates predictions, permits wrong guesses and resets config changes without stale output', () => {
    renderLesson()
    fireEvent.click(screen.getByRole('button', { name: /提交長度預測/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('請先輸入非負整數')
    predict(9)
    step(5)
    sample('digit-zero')
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toHaveTextContent('char text[] = "C0DE"')
    expect(output()).toHaveTextContent('尚無輸出')
    expect(screen.getByRole('spinbutton', { name: '預測最後的 length' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: '字串執行：執行下一步' })).not.toBeInTheDocument()
    predict(9)
    finish()
    expect(screen.getByText(/你預測 9，實際 length = 4/)).toBeInTheDocument()
    stopAt('digit-zero')
    expect(nextButton()).toBeEnabled()
    finish()
    expect(output().textContent).toBe('C')
  })

  it('supports play, pause, speed selection and resetting the trace', () => {
    vi.useFakeTimers()
    try {
      renderLesson()
      predict()
      fireEvent.click(screen.getByRole('button', { name: '字串執行：2 倍速' }))
      fireEvent.click(screen.getByRole('button', { name: '字串執行：開始播放' }))
      act(() => { vi.advanceTimersByTime(380) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '字串執行：暫停播放' }))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(screen.getByLabelText('C 程式碼，目前執行第 4 行')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '字串執行：回到第一步' }))
      expect(screen.getByRole('listitem', { name: 'text[0]，尚未建立' })).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})

describe('StringPointerLessonPage progress', () => {
  it('completes and restores three challenges without changing progress in other lessons', () => {
    const existing = { guidedRunCompleted: true, completedChallengeIds: ['choose-pointer-step'], savedState: { count: 5, mode: 'pointer' } }
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lessons: { 'pointers-traversal': existing }, lastVisitedLessonId: 'pointers-traversal' }))
    const view = renderLesson()
    predict()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'C0DE 的字串長度' }), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查字串長度' }))
    expect(stored().lessons['pointers-strings']).toBeUndefined()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'C0DE 的字串長度' }), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查字串長度' }))
    expect(nextButton()).toBeEnabled()
    fireEvent.keyDown(screen.getByRole('tab', { name: /預測包含 0 的字串長度/ }), { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('radio', { name: "'\\0' · NUL（ASCII 0）" }))
    fireEvent.click(screen.getByRole('button', { name: '檢查終止字元' }))
    fireEvent.click(screen.getByRole('tab', { name: /辨識中途的空字元/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'CO · 在第一個 NUL 停止' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查內嵌 NUL' }))
    expect(stored().lessons['pointers-strings']?.completedChallengeIds).toEqual(STRING_POINTER_CHALLENGE_IDS)
    expect(stored().lessons['pointers-traversal']).toEqual(existing)
    view.unmount()
    renderLesson()
    expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
    expect(within(screen.getByRole('tablist', { name: '字串指標學習挑戰' })).getAllByText('已完成')).toHaveLength(3)
  })

  it('applies blocked saved settings from another tab and keeps playback available', () => {
    renderLesson()
    predict()
    step(5)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'pointers-strings', lessons: {
      'pointers-strings': { guidedRunCompleted: false, completedChallengeIds: [], savedState: { sample: 'embedded-nul', stopAt: 'digit-zero' } },
    } }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByRole('combobox', { name: '字串內容' })).toHaveValue('embedded-nul')
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '預測最後的 length' })).not.toBeInTheDocument()
    finish()
    expect(output().textContent).toBe('CO\\0DE\\0')
  })

  it('clears an unsaved prediction and trace after progress is removed externally', () => {
    renderLesson()
    predict()
    step(5)
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '預測最後的 length' })).toHaveValue(null)
    expect(screen.queryByRole('button', { name: '字串執行：執行下一步' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('can finish while another tab visits another lesson, then clear without recreating completed progress', () => {
    renderLesson()
    predict()
    step(5)
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ ...stored(), lastVisitedLessonId: 'loops-for' }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    finish()
    expect(stored().lessons['pointers-strings']?.guidedRunCompleted).toBe(true)
    expect(stored().lastVisitedLessonId).toBe('loops-for')
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '字串執行：執行下一步' })).not.toBeInTheDocument()
  })
})
