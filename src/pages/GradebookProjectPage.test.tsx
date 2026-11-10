import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { GradebookProjectPage } from './GradebookProjectPage'

const renderLesson = () => render(<StrictMode><ProgressProvider><MemoryRouter><GradebookProjectPage /></MemoryRouter></ProgressProvider></StrictMode>)
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const checkpoint = () => fireEvent.click(screen.getByRole('button', { name: '前往下一個判定' }))
const finish = () => fireEvent.click(screen.getByRole('button', { name: '查看最後結果' }))
function predict(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '預測用量與查詢結果' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
}
beforeEach(() => window.localStorage.clear())

it('loads the table, highlights a query comparison, and downloads the closed report', { timeout: 15000 }, () => {
  renderLesson()
  predict('5 1')
  expect(screen.getByRole('alert')).toHaveTextContent('0 到 4')
  predict('4，1')
  for (let index = 0; index < 7; index++) checkpoint()
  expect(screen.getByLabelText('資料表計數')).toHaveTextContent('用量 4／4、無效 1、重複 1、滿表 1')
  const next = screen.getByRole('button', { name: /執行下一步/ })
  for (let index = 0; index < 4; index++) fireEvent.click(next)
  expect(screen.getByLabelText('目前搜尋位置')).toHaveTextContent('查詢 205，比較索引 0')
  expect(within(screen.getByRole('table', { name: '成績資料表' })).getByRole('row', { name: '0 101 75' })).toHaveClass('is-active')
  checkpoint()
  expect(screen.getByLabelText('查詢索引')).toHaveTextContent('1')
  expect(screen.queryByRole('link', { name: '下載 lookup.txt' })).not.toBeInTheDocument()
  finish()
  expect(screen.getByRole('link', { name: '下載 lookup.txt' })).toHaveAttribute('href', 'data:text/plain;charset=utf-8,205%2C90%0A')
  expect(screen.getByText(/預測正確/)).toBeInTheDocument()
  expect(loadProgress().lessons['projects-gradebook']?.guidedRunCompleted).toBe(true)
})

it('shows optional updates in the lookup and keeps a failed report unavailable for download', () => {
  renderLesson()
  fireEvent.click(screen.getByText('選做：比較更新重複紀錄'))
  fireEvent.click(screen.getByLabelText('更新同編號的既有紀錄'))
  choose('查詢編號', '101')
  choose('I/O 情境', 'report-close-failure')
  predict('4 0')
  for (let index = 0; index < 8; index++) checkpoint()
  finish()
  expect(screen.getByLabelText('報告內容')).toHaveTextContent('101,99')
  expect(screen.getByLabelText('報告檔狀態')).toHaveTextContent('關閉回報錯誤')
  expect(screen.queryByRole('link', { name: '下載 lookup.txt' })).not.toBeInTheDocument()
})

it('completes only the three core challenges and restores the chosen data and query', () => {
  const view = renderLesson()
  choose('成績檔', 'sparse')
  choose('查詢編號', '330')
  const submit = (value: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  }
  submit('4 1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /陣列滿了/ }), { key: 'ArrowRight' })
  submit('1 0')
  fireEvent.keyDown(screen.getByRole('tab', { name: /滿表時先檢查/ }), { key: 'End' })
  submit('2')
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 36, totalChallenges: 108, completedChallenges: 3 })
  view.unmount()
  renderLesson()
  expect(screen.getByRole('combobox', { name: '成績檔' })).toHaveValue('sparse')
  expect(screen.getByRole('combobox', { name: '查詢編號' })).toHaveValue('330')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})

it('restores saved settings across tabs and resets when progress is cleared', () => {
  renderLesson()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'projects-gradebook', lessons: {
    'projects-gradebook': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: 'empty', outcome: 'success', queryId: 9999, updateDuplicate: true } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '成績檔' })).toHaveValue('empty')
  expect(screen.getByRole('checkbox', { name: '更新同編號的既有紀錄' })).toBeChecked()
  act(() => {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY }))
  })
  expect(screen.getByRole('combobox', { name: '成績檔' })).toHaveValue('mixed')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
