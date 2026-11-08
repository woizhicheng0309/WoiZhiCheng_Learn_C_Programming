import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, HashRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, loadProgress, getCourseProgress, isBinarySearchSavedState } from '../state'
import { BinarySearchLessonPage } from './BinarySearchLessonPage'
import App from '../App'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><BinarySearchLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const number = (label: string, value: number) => fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
const next = () => fireEvent.click(screen.getByRole('button', { name: '二分搜尋執行：執行下一步' }))
function finish() {
  const button = screen.getByRole<HTMLButtonElement>('button', { name: '二分搜尋執行：執行下一步' })
  for (let i = 0; i < 100; i++) { if (button.disabled) return; fireEvent.click(button) }
  throw new Error('Trace did not finish')
}
function predict(value = 5) { number('預測最後的 found', value); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
beforeEach(() => window.localStorage.clear())

it('locks playback, shrinks the candidate interval, and reveals the result at printf', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict()
  for (let i = 0; i < 9; i++) next()
  expect(screen.getByLabelText('mid，3')).toHaveTextContent('3')
  expect(screen.getByLabelText('目前搜尋區間')).toHaveTextContent('[0, 6]')
  expect(screen.queryByText(/實際 found/)).not.toBeInTheDocument()
  for (let i = 0; i < 3; i++) next()
  expect(screen.getByLabelText('left，4')).toHaveTextContent('4')
  expect(screen.getByLabelText('目前搜尋區間')).toHaveTextContent('[4, 6]')
  finish()
  expect(screen.getByLabelText('二分搜尋結果')).toHaveTextContent('index = 5')
  expect(screen.getByText(/已檢查 2 個中點/)).toBeInTheDocument()
  expect(screen.getByText(/實際 found = 5。預測正確/)).toBeInTheDocument()
  expect(screen.getByLabelText('mid，不在作用域')).toHaveTextContent('—')
  expect(loadProgress().lessons['arrays-binary-search']?.guidedRunCompleted).toBe(true)
})
it('does not inspect or access any cell for an empty search interval', () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: '空搜尋區間' }))
  predict(-1)
  for (let i = 0; i < 7; i++) next()
  expect(screen.getByLabelText('目前搜尋區間')).toHaveTextContent('[0, -1]：空區間')
  expect(within(screen.getByRole('list', { name: '二分搜尋元素' })).queryByText('mid')).not.toBeInTheDocument()
  finish()
  expect(screen.getByLabelText('二分搜尋結果')).toHaveTextContent('index = -1')
  expect(screen.getByText(/已檢查 0 個中點/)).toBeInTheDocument()
})
it('limits the searchable prefix even when a target exists later in the physical array', () => {
  renderPage()
  number('搜尋格數 n', 5); predict(-1)
  next(); next(); next(); next()
  const cells = within(screen.getByRole('list', { name: '二分搜尋元素' })).getAllByRole('listitem')
  expect(cells[5]).toHaveTextContent('15範圍外')
  finish()
  expect(screen.getByLabelText('二分搜尋結果')).toHaveTextContent('index = -1')
  number('搜尋格數 n', 7)
  expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
  expect(screen.queryByText(/實際 found/)).not.toBeInTheDocument()
})
it('retains an invalid local count through challenge progress without saving it', () => {
  renderPage()
  number('搜尋格數 n', 3); number('搜尋格數 n', 8)
  number('你的答案', 3); fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  expect(screen.getByRole('spinbutton', { name: '搜尋格數 n' })).toHaveValue(8)
  finish()
  expect(screen.getByRole('alert')).toHaveTextContent('count 必須是 0 到 7')
  expect(loadProgress().lessons['arrays-binary-search']).toMatchObject({ savedState: { target: 15, count: 3 }, guidedRunCompleted: false, completedChallengeIds: ['predict-first-mid'] })
})
it('synchronizes another tab and does not recreate progress after clearing at the final frame', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-binary-search', lessons: {
    'arrays-binary-search': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { target: 9, count: 4 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('spinbutton', { name: '搜尋格數 n' })).toHaveValue(4)
  finish()
  expect(screen.getByLabelText('二分搜尋結果')).toHaveTextContent('index = 3')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
it('completes and reloads all three challenges including the negative sentinel', () => {
  const view = renderPage()
  const solve = (value: number) => { number('你的答案', value); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve(3)
  fireEvent.keyDown(screen.getByRole('tab', { name: /找出第一個中點/ }), { key: 'ArrowRight' }); solve(4)
  fireEvent.keyDown(screen.getByRole('tab', { name: /更新左邊界/ }), { key: 'End' }); solve(-1)
  expect(screen.getByText('你已完成二分搜尋與區間縮小。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 29, totalChallenges: 87, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})
it('recovers invalid stored state independently and validates both numeric boundaries', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { target: 7, mode: 'first' } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-binary-search', lessons: {
    'arrays-binary-search': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { target: 15, count: 8 } }, 'arrays-search': previous,
  } }))
  expect(loadProgress().lessons['arrays-search']).toEqual(previous)
  expect(loadProgress().lessons['arrays-binary-search']).toMatchObject({ guidedRunCompleted: false, savedState: { target: 15, count: 7 } })
  expect(isBinarySearchSavedState({ target: -5, count: 0 })).toBe(true)
  expect(isBinarySearchSavedState({ target: 25, count: 7 })).toBe(true)
  for (const count of [-1, 8, 0.5, NaN, Infinity, '7']) expect(isBinarySearchSavedState({ target: 15, count })).toBe(false)
})
it('opens the hash route with its lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/arrays/binary-search'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先看中點/ })).toBeInTheDocument()
  expect(document.title).toContain('二分搜尋與區間縮小')
  vi.restoreAllMocks()
})
