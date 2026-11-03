import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, HashRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, loadProgress, getCourseProgress, isRecursionSavedState } from '../state'
import { RecursionLessonPage } from './RecursionLessonPage'
import App from '../App'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><RecursionLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const number = (label: string, value: number) => fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
const next = () => fireEvent.click(screen.getByRole('button', { name: '遞迴執行：執行下一步' }))
function finish() {
  for (let i = 0; i < 100; i++) {
    if (screen.getByRole<HTMLButtonElement>('button', { name: '遞迴執行：執行下一步' }).disabled) return
    next()
  }
  throw new Error('Trace did not finish')
}
function predict(value = 24) { number('預測回傳值', value); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const stack = () => within(screen.getByRole('list', { name: 'factorial 呼叫框架' })).queryAllByRole('listitem')
beforeEach(() => window.localStorage.clear())

it('locks playback, builds separate frames, then unwinds and reveals the answer in main', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict()
  for (let i = 0; i < 30 && stack().length < 4; i++) next()
  expect(stack()).toHaveLength(4)
  expect(stack()[0]).toHaveTextContent('factorial(1)')
  expect(stack()[3]).toHaveTextContent('factorial(4)')
  expect(screen.queryByText(/實際回傳/)).not.toBeInTheDocument()
  finish()
  expect(stack()).toHaveLength(0)
  expect(screen.getByText(/實際回傳 24。預測正確/)).toBeInTheDocument()
  expect(screen.getByLabelText('answer，離開作用域')).toHaveTextContent('—')
  expect(within(screen.getByRole('list', { name: '遞迴輸出' })).getByText('24')).toBeInTheDocument()
  expect(loadProgress().lessons['functions-recursion']?.guidedRunCompleted).toBe(true)
})
it('returns one immediately for zero and resets playback after changing n', () => {
  renderPage()
  number('起始值 n', 0); predict(1); finish()
  expect(screen.getByText(/實際回傳 1。預測正確/)).toBeInTheDocument()
  number('起始值 n', 3)
  expect(stack()).toHaveLength(0)
  expect(screen.getByLabelText('C 程式碼，目前執行第 12 行')).toBeInTheDocument()
  expect(screen.queryByText(/實際回傳/)).not.toBeInTheDocument()
})
it('preserves invalid input locally through challenge progress without persisting it', () => {
  renderPage()
  number('起始值 n', 3); number('起始值 n', 7)
  number('你的答案', 6); fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  expect(screen.getByRole('spinbutton', { name: '起始值 n' })).toHaveValue(7)
  finish()
  expect(screen.getByRole('alert')).toHaveTextContent('0 到 6')
  expect(loadProgress().lessons['functions-recursion']).toMatchObject({ savedState: { n: 3 }, guidedRunCompleted: false, completedChallengeIds: ['predict-factorial'] })
})
it('synchronizes another tab and clears completed playback without recreating progress', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'functions-recursion', lessons: {
    'functions-recursion': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { n: 2 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('spinbutton', { name: '起始值 n' })).toHaveValue(2)
  finish()
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
it('completes three challenges and preserves them across reload', () => {
  const view = renderPage()
  number('你的答案', 6); fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  fireEvent.click(screen.getByRole('tab', { name: /理解 factorial/ }))
  number('你的答案', 1); fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  fireEvent.click(screen.getByRole('tab', { name: /找出最先回傳/ }))
  number('你的答案', 1); fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  expect(screen.getByText('你已完成遞迴與呼叫堆疊。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 15, totalChallenges: 45, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})
it('recovers invalid saved state independently', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { choice: 2, mode: 'with-break' } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'functions-recursion', lessons: {
    'functions-recursion': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { n: 7 } }, 'conditionals-switch': previous,
  } }))
  expect(loadProgress().lessons['conditionals-switch']).toEqual(previous)
  expect(loadProgress().lessons['functions-recursion']).toMatchObject({ guidedRunCompleted: false, savedState: { n: 4 } })
  for (const n of [NaN, Infinity, -1, 7, 2.5, '2']) expect(isRecursionSavedState({ n })).toBe(false)
})
it('opens the hash route with its own title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/functions/recursion'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先往下一層/ })).toBeInTheDocument()
  expect(document.title).toContain('遞迴與呼叫堆疊')
  vi.restoreAllMocks()
})
