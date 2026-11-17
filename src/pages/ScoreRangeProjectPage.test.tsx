import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isScoreRangeSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { ScoreRangeProjectPage } from './ScoreRangeProjectPage'

const renderLesson = () => render(<StrictMode><ProgressProvider><MemoryRouter><ScoreRangeProjectPage /></MemoryRouter></ProgressProvider></StrictMode>)
const slide = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } })
const checkpoint = () => fireEvent.click(screen.getByRole('button', { name: '前往下一個階段' }))
const finish = () => fireEvent.click(screen.getByRole('button', { name: '查看最後結果' }))
const phase = (name: string) => document.querySelector(`.allocation-execution[data-phase="${name}"]`) !== null
function predict(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '預測 begin 與 end' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
}
beforeEach(() => window.localStorage.clear())

it('shows stable sorting, half-open boundaries and all duplicate matches', { timeout: 15000 }, () => {
  renderLesson()
  slide('分數下界（包含）', 80)
  predict('5 2')
  expect(screen.getByRole('alert')).toHaveTextContent('begin 不超過 end')
  predict('2，5')
  for (let i = 0; i < 6; i++) checkpoint()
  expect(phase('sorted')).toBe(true)
  const table = screen.getByRole('table', { name: '區間成績資料表' })
  expect(within(table).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent)).toEqual(['16', '12', '11', '13', '15', '14'])
  checkpoint()
  expect(screen.getByLabelText('區間查詢結果')).toHaveTextContent('begin 2，end —')
  checkpoint()
  expect(screen.getByLabelText('區間查詢結果')).toHaveTextContent('begin 2，end 5，筆數 3')
  expect(screen.queryByText(/預測正確/)).not.toBeInTheDocument()
  finish()
  expect(screen.getByLabelText('成績區間輸出').textContent).toBe('begin=2, end=5, matches=3\n11,80\n13,80\n15,80\n')
  expect(screen.getByRole('link', { name: '下載區間結果' })).toHaveAttribute('href', 'data:text/plain;charset=utf-8,11%2C80%0A13%2C80%0A15%2C80%0A')
  expect(screen.getByText(/預測正確/)).toBeInTheDocument()
  expect(loadProgress().lessons['projects-score-range']?.guidedRunCompleted).toBe(true)
})

it('traces an in-range binary mid and reaches count without reading a seventh row', () => {
  renderLesson()
  fireEvent.click(screen.getByText('選做：全體同分的邊界'))
  fireEvent.click(screen.getByRole('button', { name: '載入同分邊界練習' }))
  slide('分數上界（包含）', 100)
  slide('分數下界（包含）', 76)
  predict('6 6')
  for (let i = 0; i < 6; i++) checkpoint()
  const next = screen.getByRole('button', { name: /執行下一步/ })
  for (let i = 0; i < 4; i++) fireEvent.click(next)
  expect(phase('mid')).toBe(true)
  expect(screen.getByLabelText('搜尋候選範圍')).toHaveTextContent('[0, 6)')
  expect(screen.getByLabelText('搜尋 mid')).toHaveTextContent('3')
  expect(document.querySelector('.source-code-panel__line.is-active')).toHaveTextContent('left + (right - left) / 2')
  checkpoint(); checkpoint(); finish()
  expect(screen.getByLabelText('成績區間輸出')).toHaveTextContent('matches=0')
  expect(screen.getByRole('link', { name: '下載區間結果' })).toHaveAttribute('href', 'data:text/plain;charset=utf-8,')
})

it('runs an empty prefix and resets playback after a configuration change', () => {
  vi.useFakeTimers()
  try {
    renderLesson(); predict('1 5')
    fireEvent.click(screen.getByRole('button', { name: '成績區間執行：開始播放' }))
    act(() => vi.advanceTimersByTime(760))
    slide('有效筆數', 0)
    act(() => vi.advanceTimersByTime(10000))
    expect(phase('prepare')).toBe(true)
    expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
    expect(loadProgress().lessons['projects-score-range']?.guidedRunCompleted).toBe(false)
    predict('0 0'); checkpoint(); checkpoint(); checkpoint(); finish()
    expect(screen.getByLabelText('成績區間輸出')).toHaveTextContent('begin=0, end=0, matches=0')
  } finally { vi.useRealTimers() }
})

it('saves each core challenge independently and restores all chosen controls', () => {
  const view = renderLesson()
  fireEvent.change(screen.getByRole('combobox', { name: '成績資料' }), { target: { value: 'ordered' } })
  slide('有效筆數', 4); slide('分數下界（包含）', 50)
  const solve = (answer: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value: answer } })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  }
  solve('2 4 2')
  expect(loadProgress().lessons['projects-score-range']?.completedChallengeIds).toEqual([])
  solve('2 5 3')
  fireEvent.keyDown(screen.getByRole('tab', { name: /同分紀錄的兩個邊界/ }), { key: 'ArrowRight' }); solve('11 13 15')
  fireEvent.keyDown(screen.getByRole('tab', { name: /同分時保留/ }), { key: 'End' }); solve('0')
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 37, totalChallenges: 111, completedChallenges: 3 })
  view.unmount(); renderLesson()
  expect(screen.getByRole('combobox', { name: '成績資料' })).toHaveValue('ordered')
  expect(screen.getByRole('slider', { name: '有效筆數' })).toHaveValue('4')
  expect(screen.getByRole('slider', { name: '分數下界（包含）' })).toHaveValue('50')
  expect(screen.getByRole('slider', { name: '分數上界（包含）' })).toHaveValue('80')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})

it('synchronizes cross-tab changes and restarts explicitly after clearing', () => {
  renderLesson()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'projects-score-range', lessons: {
    'projects-score-range': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'equal', count: 0, low: 75, high: 75 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '成績資料' })).toHaveValue('equal')
  expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
  act(() => {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY }))
  })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  slide('有效筆數', 0); predict('0 0'); checkpoint(); checkpoint(); checkpoint(); finish()
  expect(loadProgress().lessons['projects-score-range']?.guidedRunCompleted).toBe(true)
})

it('recovers an invalid saved range while retaining the existing gradebook progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['gradebook-lookup-sentinel'], savedState: { dataset: 'empty', outcome: 'success', queryId: 205, updateDuplicate: false } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'projects-score-range', lessons: {
    'projects-gradebook': previous,
    'projects-score-range': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'mixed', count: 6, low: 90, high: 80 } },
  } }))
  expect(loadProgress().lessons['projects-gradebook']).toEqual(previous)
  expect(loadProgress().lessons['projects-score-range']).toMatchObject({ guidedRunCompleted: false, savedState: { sample: 'mixed', count: 6, low: 60, high: 80 } })
  for (const value of [null, [], { sample: { toString: null }, count: 6, low: 0, high: 100 }, { sample: 'mixed', count: '6', low: 0, high: 100 }]) expect(isScoreRangeSavedState(value)).toBe(false)
})
