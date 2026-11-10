import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, HashRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, loadProgress, getCourseProgress, isSearchSavedState } from '../state'
import { SearchLessonPage } from './SearchLessonPage'
import App from '../App'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><SearchLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const number = (label: string, value: number) => fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
const next = () => fireEvent.click(screen.getByRole('button', { name: '搜尋執行：執行下一步' }))
function finish() {
  const button = screen.getByRole<HTMLButtonElement>('button', { name: '搜尋執行：執行下一步' })
  for (let i = 0; i < 100; i++) { if (button.disabled) return; fireEvent.click(button) }
  throw new Error('Trace did not finish')
}
function predict(value = 1) { number('預測最後的 found', value); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
beforeEach(() => window.localStorage.clear())

it('requires prediction, compares cells, then reveals the first index only at output', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict()
  for (let i = 0; i < 6; i++) next()
  expect(screen.getByLabelText('目前比較結果')).toHaveTextContent('values[0] = 4，不等於 target = 7')
  expect(screen.queryByText(/實際 found/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('found，-1')).toHaveTextContent('-1')
  finish()
  expect(screen.getByLabelText('搜尋結果輸出')).toHaveTextContent('index = 1')
  expect(screen.getByText(/已比較 2 \/ 5 格/)).toBeInTheDocument()
  expect(screen.getByText(/實際 found = 1。預測正確/)).toBeInTheDocument()
  expect(screen.getByLabelText('found，離開作用域')).toHaveTextContent('—')
  expect(within(screen.getByRole('list', { name: 'values 元素' })).getAllByRole('listitem').every(item => item.querySelector('strong')?.textContent === '—')).toBe(true)
  expect(loadProgress().lessons['arrays-search']?.guidedRunCompleted).toBe(true)
})
it('records the last match and resets the trace on strategy change', () => {
  renderPage()
  fireEvent.click(screen.getByRole('radio', { name: /最後一筆：/ }))
  predict(3); finish()
  expect(screen.getByLabelText('搜尋結果輸出')).toHaveTextContent('index = 3')
  expect(screen.getByText(/已比較 5 \/ 5 格/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /第一筆：/ }))
  expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
  expect(screen.queryByText(/實際 found/)).not.toBeInTheDocument()
})
it('accepts a -1 prediction for a missing target without using it as an array index', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: '試試找不到的 9' }))
  predict(-1); finish()
  expect(screen.getByLabelText('搜尋結果輸出')).toHaveTextContent('index = -1')
  expect(screen.getByText(/實際 found = -1。預測正確/)).toBeInTheDocument()
  expect(screen.getByLabelText('i，不在作用域')).toHaveTextContent('—')
})
it('keeps an invalid target local through a challenge update and stops without saving it', () => {
  renderPage()
  number('目標值 target', 4); number('目標值 target', 16)
  number('你的答案', 1); fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  expect(screen.getByRole('spinbutton', { name: '目標值 target' })).toHaveValue(16)
  finish()
  expect(screen.getByRole('alert')).toHaveTextContent('-5 到 15')
  expect(loadProgress().lessons['arrays-search']).toMatchObject({ savedState: { target: 4, mode: 'first' }, guidedRunCompleted: false, completedChallengeIds: ['predict-first-match'] })
})
it('synchronizes another tab and clears progress at the terminal frame without rewriting it', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-search', lessons: {
    'arrays-search': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { mode: 'last', target: 2 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('spinbutton', { name: '目標值 target' })).toHaveValue(2)
  expect(screen.getByRole('radio', { name: /最後一筆：/ })).toBeChecked()
  finish()
  expect(screen.getByLabelText('搜尋結果輸出')).toHaveTextContent('index = 2')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
it('completes all three challenges, including the negative sentinel, and restores them', () => {
  const view = renderPage()
  const solve = (value: number) => { number('你的答案', value); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve(1)
  fireEvent.keyDown(screen.getByRole('tab', { name: /第一筆相符的索引/ }), { key: 'ArrowRight' }); solve(3)
  fireEvent.keyDown(screen.getByRole('tab', { name: /最後一筆相符的索引/ }), { key: 'End' }); solve(-1)
  expect(screen.getByText('你已完成線性搜尋與提前結束。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 32, totalChallenges: 96, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})
it('recovers a damaged lesson without losing older progress and validates boundaries', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { n: 4 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-search', lessons: {
    'arrays-search': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { mode: 'bad', target: 7 } }, 'functions-recursion': previous,
  } }))
  expect(loadProgress().lessons['functions-recursion']).toEqual(previous)
  expect(loadProgress().lessons['arrays-search']).toMatchObject({ guidedRunCompleted: false, savedState: { mode: 'first', target: 7 } })
  for (const target of [-5, 15]) expect(isSearchSavedState({ mode: 'last', target })).toBe(true)
  for (const target of [NaN, Infinity, -6, 16, 0.5, '7']) expect(isSearchSavedState({ mode: 'first', target })).toBe(false)
})
it('opens the lesson route with its own document title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/arrays/search'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /找到一筆就停/ })).toBeInTheDocument()
  expect(document.title).toContain('線性搜尋與提前結束')
  vi.restoreAllMocks()
})
