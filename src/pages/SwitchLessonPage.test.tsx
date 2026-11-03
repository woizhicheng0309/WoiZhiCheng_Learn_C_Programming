import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, HashRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, loadProgress, getCourseProgress, isSwitchSavedState } from '../state'
import { SwitchLessonPage } from './SwitchLessonPage'
import App from '../App'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><SwitchLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const number = (label: string, value: number) => fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
function finish() {
  for (let i = 0; i < 30; i++) {
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'switch 執行：執行下一步' })
    if (button.disabled) return
    fireEvent.click(button)
  }
  throw new Error('Trace did not finish')
}
const outputs = () => within(screen.getByRole('list', { name: 'printf 輸出行' })).queryAllByRole('listitem').map(item => item.textContent)
beforeEach(() => window.localStorage.clear())

it('locks playback until prediction, then reveals the result at Done and persists completion', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  number('預測區塊內輸出行數', 1)
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
  expect(screen.queryByText(/實際 1 行/)).not.toBeInTheDocument()
  finish()
  expect(outputs()).toEqual(['Coffee', 'Done'])
  expect(screen.getByText(/實際 1 行。預測正確/)).toBeInTheDocument()
  expect(screen.getByLabelText('choice，離開作用域')).toHaveTextContent('—')
  expect(loadProgress().lessons['conditionals-switch']?.guidedRunCompleted).toBe(true)
})
it('flows from case 1 into default without replacing its selected entry', () => {
  renderPage()
  number('選擇值 choice', 1)
  fireEvent.click(screen.getByRole('radio', { name: /省略 break/ }))
  number('預測區塊內輸出行數', 3)
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
  finish()
  expect(outputs()).toEqual(['Tea', 'Coffee', 'Water', 'Done'])
  expect(screen.getByText('匹配的入口').nextElementSibling).toHaveTextContent('case 1')
})
it('keeps invalid inputs local and resets completed playback when progress is cleared externally', () => {
  renderPage()
  number('選擇值 choice', 4)
  number('選擇值 choice', 5)
  finish()
  expect(screen.getByRole('alert')).toHaveTextContent('0 到 4')
  expect(loadProgress().lessons['conditionals-switch']?.savedState?.choice).toBe(4)
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.getByRole('spinbutton', { name: '選擇值 choice' })).toHaveValue(2)
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
it('completes the three challenges and validates persisted configuration', () => {
  renderPage()
  const solve = (answer: string) => {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: answer } })
    fireEvent.click(screen.getByRole('button', { name: '檢查輸出' }))
  }
  solve('Coffee Done')
  fireEvent.click(screen.getByRole('tab', { name: /省略 break 的輸出/ }))
  solve('Tea Coffee Water Done')
  fireEvent.click(screen.getByRole('tab', { name: /沒有 case 命中/ }))
  solve('Water Done')
  expect(screen.getByText('你已完成 switch、case 與 break。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 17, totalChallenges: 51, completedChallenges: 3 })
  expect(isSwitchSavedState({ choice: 2, mode: 'with-break' })).toBe(true)
  expect(isSwitchSavedState({ choice: '2', mode: 'with-break' })).toBe(false)
})
it('opens the hash route with the correct document title', async () => {
  window.location.hash = '#/learn/conditionals/switch'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /選好入口/ })).toBeInTheDocument()
  expect(document.title).toContain('switch、case 與 break')
})

it('synchronizes another tab and does not recreate progress when clearing at the final frame', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'conditionals-switch', lessons: {
    'conditionals-switch': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { choice: 1, mode: 'fall-through' } },
  } }))
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.getByRole('spinbutton', { name: '選擇值 choice' })).toHaveValue(1)
  finish()
  expect(outputs()).toEqual(['Tea', 'Coffee', 'Water', 'Done'])
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})

it('recovers damaged switch progress without dropping valid existing lessons', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { start: 0, end: 5, comparator: '<', step: 1 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'conditionals-switch', lessons: {
    'conditionals-switch': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { choice: 99, mode: 'with-break' } },
    'loops-for': previous,
  } }))
  expect(loadProgress().lessons['loops-for']).toEqual(previous)
  expect(loadProgress().lessons['conditionals-switch']).toMatchObject({ guidedRunCompleted: false, savedState: { choice: 2, mode: 'with-break' } })
})
