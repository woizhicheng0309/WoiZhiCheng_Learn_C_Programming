import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isStringCopySavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { StringCopyLessonPage } from './StringCopyLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><StringCopyLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '字串複製執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 100; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected trace phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
function predict(value = '4') { fireEvent.change(screen.getByRole('textbox', { name: '預測 strlen 長度' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const activeLine = (line: number) => document.querySelector(`.source-code-panel__line.is-active[data-line="${line}"]`) !== null
const destination = () => within(screen.getByRole('list', { name: 'destination 陣列' })).getAllByRole('listitem')
const outputs = () => within(screen.getByRole('list', { name: '字串複製輸出' })).queryAllByRole('listitem').map(item => item.textContent)
beforeEach(() => window.localStorage.clear())

it('unlocks with a nonnegative prediction and reveals length only when strlen executes', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('-1')
  expect(screen.getByRole('alert')).toHaveTextContent('非負整數')
  predict()
  advanceUntil(() => activeLine(6))
  expect(destination().every(cell => cell.textContent?.includes('未初始化'))).toBe(true)
  expect(screen.queryByText(/實際長度/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測 4，實際長度 4。預測正確！')).toBeInTheDocument()
  expect(screen.getByLabelText('目前字串長度')).toHaveTextContent('4')
  expect(screen.getByLabelText('來源陣列大小')).toHaveTextContent('5')
})
it('copies the terminator as the fifth write, then prints a complete string and saves completion', () => {
  renderPage(); predict()
  advanceUntil(() => document.querySelector('[aria-label="destination[4]，空字元"]') !== null)
  expect(destination().map(cell => cell.querySelector('strong')?.textContent)).toEqual(['C', 'O', 'D', 'E', '\\0'])
  expect(screen.getByText('已複製 5 格，包含已寫入的結尾空字元。未初始化的格子用 — 表示，不等於空字元。')).toBeInTheDocument()
  finish()
  expect(outputs()).toEqual(['length=4, capacity=5', 'CODE'])
  expect(destination().every(cell => cell.textContent?.includes('離開作用域'))).toBe(true)
  expect(loadProgress().lessons['arrays-string-copy']?.guidedRunCompleted).toBe(true)
})
it('rejects insufficient capacity without writing or printing the uninitialized destination', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '目的陣列容量' }), { target: { value: '3' } })
  predict(); advanceUntil(() => activeLine(15))
  expect(destination().every(cell => cell.textContent?.includes('未初始化'))).toBe(true)
  expect(screen.getByLabelText('容量判斷')).toHaveTextContent('容量不足')
  expect(screen.getByText(/已複製 0 格/)).toBeInTheDocument()
  finish()
  expect(outputs()).toEqual(['length=4, capacity=3', 'buffer too small'])
  expect(loadProgress().lessons['arrays-string-copy']?.guidedRunCompleted).toBe(true)
})
it('distinguishes an embedded terminator, the array size and untouched spare cells', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '來源字串' }), { target: { value: 'embedded-nul' } })
  fireEvent.change(screen.getByRole('combobox', { name: '目的陣列容量' }), { target: { value: '8' } })
  predict('2'); advanceUntil(() => activeLine(13))
  expect(screen.getByLabelText('目前字串長度')).toHaveTextContent('2')
  expect(screen.getByLabelText('來源陣列大小')).toHaveTextContent('6')
  expect(destination().slice(3).every(cell => cell.textContent?.includes('未初始化'))).toBe(true)
  expect(outputs()).toEqual(['length=2, capacity=8', 'CO'])
})
it('still writes a terminator for an empty string and resets when the sample changes', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '來源字串' }), { target: { value: 'empty' } })
  fireEvent.change(screen.getByRole('combobox', { name: '目的陣列容量' }), { target: { value: '1' } })
  predict('0'); finish()
  expect(outputs()).toEqual(['length=0, capacity=1', '（空字串，只輸出換行）'])
  expect(screen.getByText(/已複製 1 格/)).toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox', { name: '來源字串' }), { target: { value: 'digit-zero' } })
  expect(outputs()).toEqual([])
  expect(activeLine(4)).toBe(true)
  expect(screen.queryByText(/實際長度/)).not.toBeInTheDocument()
})
it('synchronizes saved controls and clears another tab at the final frame without recreating progress', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-string-copy', lessons: {
    'arrays-string-copy': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'empty', capacity: 1 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '來源字串' })).toHaveValue('empty')
  expect(screen.getByRole('combobox', { name: '目的陣列容量' })).toHaveValue('1')
  finish()
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
it('completes all challenges via keyboard tabs and restores the lesson state after reload', () => {
  const view = renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '目的陣列容量' }), { target: { value: '8' } })
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('5')
  fireEvent.keyDown(screen.getByRole('tab', { name: /結尾也要複製/ }), { key: 'ArrowRight' }); solve('5')
  fireEvent.keyDown(screen.getByRole('tab', { name: /四個字元要幾格/ }), { key: 'End' }); solve('2 6')
  expect(screen.getByText('你已完成字串長度與安全複製。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 31, totalChallenges: 93, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '目的陣列容量' })).toHaveValue('8')
})
it('recovers only damaged copy progress while preserving an existing sorting lesson', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['predict-bubble-pass'], savedState: { sample: 'sorted', order: 'ascending', earlyExit: false } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-string-copy', lessons: {
    'arrays-string-copy': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: '__proto__', capacity: 5 } }, 'arrays-bubble-sort': previous,
  } }))
  expect(loadProgress().lessons['arrays-bubble-sort']).toEqual(previous)
  expect(loadProgress().lessons['arrays-string-copy']).toMatchObject({ guidedRunCompleted: false, savedState: { sample: 'word', capacity: 5 } })
  expect(isStringCopySavedState({ sample: 'empty', capacity: 1 })).toBe(true)
  for (const value of [null, [], { sample: 'word', capacity: 4 }, { sample: 'word', capacity: '5' }, { sample: 'constructor', capacity: 5 }]) expect(isStringCopySavedState(value)).toBe(false)
})
it('opens its lazy hash route with the correct document title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/arrays/string-copy'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /內容算長度/ })).toBeInTheDocument()
  expect(document.title).toContain('字串長度與安全複製')
  vi.restoreAllMocks()
})
