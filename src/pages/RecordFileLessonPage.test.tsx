import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { RecordFileLessonPage } from './RecordFileLessonPage'

const renderLesson = () => render(<StrictMode><ProgressProvider><MemoryRouter><RecordFileLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const nextRecord = () => fireEvent.click(screen.getByRole('button', { name: '前往下一筆判定' }))
const finish = () => fireEvent.click(screen.getByRole('button', { name: '查看最後結果' }))
function predict(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '預測合法、拒絕、寫入筆數' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
}
beforeEach(() => window.localStorage.clear())

it('jumps through decisions and offers the confirmed output bytes only after execution', { timeout: 12000 }, () => {
  renderLesson()
  predict('3 4')
  expect(screen.getByRole('alert')).toHaveTextContent('三個非負整數')
  predict('3，4，2')
  nextRecord()
  expect(screen.getByLabelText('Record 資料')).toHaveTextContent('10,80')
  expect(screen.getByLabelText('輸出檔狀態')).toHaveTextContent('等待關檔')
  expect(screen.queryByRole('link', { name: '下載 selected.txt' })).not.toBeInTheDocument()
  for (let index = 1; index < 7; index++) nextRecord()
  expect(screen.getByRole('table', { name: '逐筆判定' })).toHaveTextContent('合法，低於門檻')
  expect(screen.getByRole('table', { name: '逐筆判定' })).toHaveTextContent('拒絕：尾端資料')
  finish()
  const download = screen.getByRole('link', { name: '下載 selected.txt' })
  expect(download).toHaveAttribute('download', 'selected.txt')
  expect(download).toHaveAttribute('href', 'data:text/plain;charset=utf-8,10%2C80%0A15%2C100%0A')
  expect(screen.getByText(/預測正確/)).toBeInTheDocument()
  expect(loadProgress().lessons['files-record-filter']?.guidedRunCompleted).toBe(true)
})

it('retains the simulated preview and withholds download when output close fails', () => {
  renderLesson()
  choose('輸入資料', 'boundary')
  choose('I/O 情境', 'close-failure')
  predict('3 1 1')
  for (let index = 0; index < 4; index++) nextRecord()
  finish()
  expect(screen.getByLabelText('輸出檔狀態')).toHaveTextContent('關閉回報錯誤')
  expect(screen.getByLabelText('輸出檔內容')).toHaveTextContent('3,100')
  expect(screen.getByLabelText('多欄程式輸出')).toHaveTextContent('I/O failed')
  expect(screen.queryByRole('link', { name: '下載 selected.txt' })).not.toBeInTheDocument()
})

it('saves controls and challenge completions separately from other lessons', () => {
  const view = renderLesson()
  choose('輸入資料', 'boundary')
  choose('I/O 情境', 'output-open-failure')
  fireEvent.change(screen.getByRole('slider', { name: '分數門檻' }), { target: { value: '0' } })
  const submit = (value: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  }
  submit('1')
  expect(loadProgress().lessons['files-record-filter']?.completedChallengeIds).toEqual([])
  submit('3')
  fireEvent.keyDown(screen.getByRole('tab', { name: /分數讀得到/ }), { key: 'ArrowRight' })
  submit('3 1 2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /合法筆數和寫入筆數/ }), { key: 'End' })
  submit('2')
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 36, totalChallenges: 108, completedChallenges: 3 })
  view.unmount()
  renderLesson()
  expect(screen.getByRole('combobox', { name: '輸入資料' })).toHaveValue('boundary')
  expect(screen.getByRole('combobox', { name: 'I/O 情境' })).toHaveValue('output-open-failure')
  expect(screen.getByRole('slider', { name: '分數門檻' })).toHaveValue('0')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})

it('replays remote settings and clears execution state with cross-tab progress removal', () => {
  renderLesson()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-record-filter', lessons: {
    'files-record-filter': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: 'empty', outcome: 'success', minimumScore: 7 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '輸入資料' })).toHaveValue('empty')
  expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
  act(() => {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY }))
  })
  expect(screen.getByRole('combobox', { name: '輸入資料' })).toHaveValue('mixed')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
