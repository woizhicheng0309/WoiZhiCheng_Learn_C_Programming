import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isDynamicRecordsSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { DynamicRecordsProjectPage } from './DynamicRecordsProjectPage'
const renderLesson = () => render(<StrictMode><ProgressProvider><MemoryRouter><DynamicRecordsProjectPage /></MemoryRouter></ProgressProvider></StrictMode>)
const checkpoint = () => fireEvent.click(screen.getByRole('button', { name: '前往下一個階段' }))
const finish = () => fireEvent.click(screen.getByRole('button', { name: '查看最後結果' }))
const phase = (name: string) => document.querySelector(`.allocation-execution[data-phase="${name}"]`) !== null
const setFailure = (value: number) => fireEvent.change(screen.getByRole('combobox', { name: '注入配置失敗' }), { target: { value: String(value) } })
const setCount = (value: number) => fireEvent.change(screen.getByRole('slider', { name: '加入筆數' }), { target: { value: String(value) } })
function predict(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '預測 used 與 capacity' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
}
beforeEach(() => window.localStorage.clear())

it('shows used separately from capacity, uninitialized spare slots, and final cleanup', { timeout: 15000 }, () => {
  renderLesson(); predict('9 8')
  expect(screen.getByRole('alert')).toHaveTextContent('0 到 8')
  predict('6，8')
  for (let i = 0; i < 6; i++) checkpoint()
  expect(phase('appended')).toBe(true)
  expect(screen.getByLabelText('有效筆數')).toHaveTextContent('6')
  expect(screen.getByLabelText('配置容量')).toHaveTextContent('8')
  expect(screen.getByLabelText('配置嘗試次數')).toHaveTextContent('3')
  const table = screen.getByRole('table', { name: '動態配置資料表' })
  expect(within(table).getAllByRole('row')).toHaveLength(9)
  expect(within(table).getAllByText('未初始化，不可讀取')).toHaveLength(2)
  expect(screen.queryByText(/預測正確/)).not.toBeInTheDocument()
  checkpoint(); expect(screen.getByText(/預測正確/)).toBeInTheDocument()
  checkpoint(); expect(phase('reset')).toBe(true)
  expect(screen.getByLabelText('清單指標')).toHaveTextContent('NULL')
  expect(screen.getByLabelText('配置容量')).toHaveTextContent('0')
  expect(screen.getByLabelText('最後釋放區塊數')).toHaveTextContent('1')
  finish()
  expect(screen.getByLabelText('動態紀錄輸出').textContent).toBe('used=6, capacity=8\n101,75\n205,90\n330,0\n444,88\n509,100\n610,60\n')
  expect(screen.getByLabelText('程式回傳值')).toHaveTextContent('0')
  expect(loadProgress().lessons['projects-dynamic-records']?.guidedRunCompleted).toBe(true)
})

it('keeps the original allocation on failure and stops before writing the pending record', () => {
  renderLesson(); setFailure(2); predict('2 2'); checkpoint(); checkpoint()
  const next = screen.getByRole('button', { name: /執行下一步/ })
  for (let i = 0; i < 20 && !phase('check'); i++) fireEvent.click(next)
  expect(phase('check')).toBe(true)
  expect(screen.getByLabelText('暫存指標')).toHaveTextContent('NULL')
  expect(screen.getByLabelText('清單指標')).toHaveTextContent('B1')
  expect(screen.getByLabelText('有效筆數')).toHaveTextContent('2')
  expect(document.querySelector('.source-code-panel__line.is-active')).toHaveTextContent('if (temp == NULL) return 0;')
  checkpoint(); checkpoint(); checkpoint(); finish()
  expect(screen.getByLabelText('動態紀錄輸出').textContent).toBe('append failed at index=2\nused=2, capacity=2\n101,75\n205,90\n')
  expect(screen.getByLabelText('最後釋放區塊數')).toHaveTextContent('1')
  expect(screen.getByLabelText('程式回傳值')).toHaveTextContent('1')
})

it.each([0, 1])('cleans up with no live allocation for count %i', count => {
  renderLesson(); setCount(count); setFailure(1); predict('0 0')
  if (count) checkpoint()
  checkpoint(); checkpoint(); finish()
  expect(screen.getByLabelText('最後釋放區塊數')).toHaveTextContent('0')
  expect(screen.getByLabelText('動態紀錄輸出')).toHaveTextContent('used=0, capacity=0')
  expect(loadProgress().lessons['projects-dynamic-records']?.guidedRunCompleted).toBe(true)
})

it('resets playback on strategy change and restores selected controls on reload', () => {
  vi.useFakeTimers()
  try {
    const view = renderLesson(); predict('6 8')
    fireEvent.click(screen.getByRole('button', { name: '動態紀錄執行：開始播放' }))
    act(() => vi.advanceTimersByTime(760))
    fireEvent.click(screen.getByText('選做：比較逐筆擴充與容量加倍'))
    fireEvent.change(screen.getByRole('combobox', { name: '擴充策略' }), { target: { value: 'exact' } })
    act(() => vi.advanceTimersByTime(10000))
    expect(phase('prepare')).toBe(true)
    expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
    expect(loadProgress().lessons['projects-dynamic-records']?.guidedRunCompleted).toBe(false)
    setCount(3); setFailure(3)
    fireEvent.change(screen.getByRole('combobox', { name: '紀錄資料' }), { target: { value: 'equal' } })
    view.unmount(); renderLesson()
    expect(screen.getByRole('combobox', { name: '紀錄資料' })).toHaveValue('equal')
    expect(screen.getByRole('slider', { name: '加入筆數' })).toHaveValue('3')
    expect(screen.getByRole('combobox', { name: '注入配置失敗' })).toHaveValue('3')
    fireEvent.click(screen.getByText('選做：比較逐筆擴充與容量加倍'))
    expect(screen.getByRole('combobox', { name: '擴充策略' })).toHaveValue('exact')
    predict('2 2'); checkpoint(); checkpoint(); checkpoint(); checkpoint(); checkpoint(); finish()
    expect(screen.getByLabelText('配置嘗試次數')).toHaveTextContent('3')
    expect(screen.getByLabelText('動態紀錄輸出')).toHaveTextContent('11,80')
    expect(screen.getByLabelText('動態紀錄輸出')).not.toHaveTextContent('13,80')
  } finally { vi.useRealTimers() }
})

it('saves independent core challenges and supports keyboard tab navigation', () => {
  renderLesson()
  function solve(answer: string) {
    fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value: answer } })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  }
  solve('6 6 6'); expect(loadProgress().lessons['projects-dynamic-records']?.completedChallengeIds ?? []).toEqual([])
  solve('6 8 3')
  fireEvent.keyDown(screen.getByRole('tab', { name: /六筆資料/ }), { key: 'ArrowRight' }); solve('2 2 0')
  fireEvent.keyDown(screen.getByRole('tab', { name: /擴充失敗/ }), { key: 'End' }); solve('6 2 1')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 38, totalChallenges: 114, completedChallenges: 3 })
})

it('synchronizes changed settings, clears feedback across tabs, and restarts explicitly', () => {
  renderLesson()
  fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value: '6 8 3' } })
  fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'projects-dynamic-records', lessons: {
    'projects-dynamic-records': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'equal', count: 0, growth: 'exact', failAt: 1 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('slider', { name: '加入筆數' })).toHaveValue('0')
  expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /你的答案/ })).toHaveValue('')
  expect(screen.queryByText(/答對了/)).not.toBeInTheDocument()
  setCount(0); predict('0 0'); checkpoint(); checkpoint(); finish()
  expect(loadProgress().lessons['projects-dynamic-records']?.guidedRunCompleted).toBe(true)
})

it('rejects malformed new settings without losing existing lesson progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['score-range-empty-endpoint'], savedState: { sample: 'equal', count: 0, low: 75, high: 75 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'projects-dynamic-records', lessons: {
    'projects-score-range': previous,
    'projects-dynamic-records': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'mixed', count: 9, growth: 'double', failAt: 0 } },
  } }))
  expect(loadProgress().lessons['projects-score-range']).toEqual(previous)
  expect(loadProgress().lessons['projects-dynamic-records']).toMatchObject({ guidedRunCompleted: false, savedState: { sample: 'mixed', count: 6, growth: 'double', failAt: 0 } })
  for (const value of [null, [], { sample: { toString: null }, count: 6, growth: 'double', failAt: 0 }, { sample: 'mixed', count: 6, growth: 'double', failAt: '2' }]) expect(isDynamicRecordsSavedState(value)).toBe(false)
})
