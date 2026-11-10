import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { MemoryOwnershipLessonPage } from './MemoryOwnershipLessonPage'

const renderLesson = () => render(<StrictMode><ProgressProvider><MemoryRouter><MemoryOwnershipLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const phase = (name: string) => document.querySelector(`.allocation-execution[data-phase="${name}"]`) !== null
function goTo(name: string) {
  const button = screen.getByRole<HTMLButtonElement>('button', { name: '記憶體所有權執行：執行下一步' })
  for (let i = 0; i < 32 && !phase(name) && !button.disabled; i++) fireEvent.click(button)
  expect(phase(name)).toBe(true)
}
function predict(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '預測釋放者與 view 狀態' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
}
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
beforeEach(() => window.localStorage.clear())

it('shows handoff, free and separate alias clearing during the guided run', { timeout: 20000 }, () => {
  renderLesson()
  predict('4 3')
  expect(screen.getByRole('alert')).toHaveTextContent('釋放者代碼')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('2 3')
  goTo('copy-pointer')
  expect(screen.getByLabelText('source.data 指向')).toHaveTextContent('→ A')
  expect(screen.getByLabelText('destination.data 指向')).toHaveTextContent('→ A')
  expect(screen.getByLabelText('目前釋放責任')).toHaveTextContent('source')
  goTo('clear-source')
  expect(screen.getByLabelText('source.data 指向')).toHaveTextContent('NULL')
  expect(screen.getByLabelText('目前釋放責任')).toHaveTextContent('destination')
  goTo('free')
  expect(document.querySelector('.source-code-panel__line.is-active')).toHaveTextContent('free(buffer->data);')
  expect(screen.getByLabelText('destination.data 指向')).toHaveTextContent('失效')
  expect(screen.getByLabelText('view 指向')).toHaveTextContent('失效')
  expect(screen.getByLabelText('釋放函式參數')).toHaveTextContent('&destination')
  expect(screen.queryByLabelText('區塊 A 資料值')).not.toBeInTheDocument()
  goTo('clear-owner')
  expect(screen.getByLabelText('destination.data 指向')).toHaveTextContent('NULL')
  expect(screen.getByLabelText('view 指向')).toHaveTextContent('失效')
  expect(screen.queryByText(/預測正確/)).not.toBeInTheDocument()
  goTo('clear-view')
  expect(screen.getByLabelText('view 指向')).toHaveTextContent('NULL')
  goTo('done')
  expect(screen.getByLabelText('記憶體所有權輸出')).toHaveTextContent('value=42, released_by=destination')
  expect(screen.getByText(/預測正確/)).toBeInTheDocument()
  expect(loadProgress().lessons['memory-ownership']?.guidedRunCompleted).toBe(true)
})

it('shows the handled allocator failure before borrow or release', () => {
  renderLesson()
  choose('配置情境', 'failure')
  predict('0，0')
  goTo('done')
  expect(screen.getByLabelText('區塊 A 狀態')).toHaveTextContent('未配置')
  expect(screen.getByLabelText('free 呼叫次數')).toHaveTextContent('0 次')
  expect(screen.getByLabelText('記憶體所有權輸出')).toHaveTextContent('allocation failed')
  expect(screen.getByText(/預測正確/)).toBeInTheDocument()
})

it('saves settings and all three separate challenge completions', () => {
  const view = renderLesson()
  choose('所有權策略', 'retain')
  choose('配置情境', 'failure')
  fireEvent.change(screen.getByRole('slider', { name: '寫入的資料值' }), { target: { value: '0' } })
  const submit = (value: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  }
  submit('1')
  expect(loadProgress().lessons['memory-ownership']?.completedChallengeIds).toEqual([])
  submit('2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /交接完成後/ }), { key: 'ArrowRight' })
  submit('3')
  fireEvent.keyDown(screen.getByRole('tab', { name: /持有欄位清空後/ }), { key: 'End' })
  submit('1 0')
  expect(screen.getByText('你已完成記憶體所有權、借用與釋放。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 34, totalChallenges: 102, completedChallenges: 3 })
  view.unmount()
  renderLesson()
  expect(screen.getByRole('combobox', { name: '配置情境' })).toHaveValue('failure')
  expect(screen.getByRole('combobox', { name: '所有權策略' })).toHaveValue('retain')
  expect(screen.getByRole('slider', { name: '寫入的資料值' })).toHaveValue('0')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})

it('restores saved settings from another tab and keeps cleared progress cleared', () => {
  renderLesson()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'memory-ownership', lessons: {
    'memory-ownership': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { strategy: 'retain', outcome: 'success', value: 7 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '所有權策略' })).toHaveValue('retain')
  expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
  act(() => {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY }))
  })
  expect(screen.getByRole('combobox', { name: '所有權策略' })).toHaveValue('transfer')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
