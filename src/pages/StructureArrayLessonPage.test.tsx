import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isStructureArraySavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { StructureArrayLessonPage } from './StructureArrayLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><StructureArrayLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '結構陣列執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 50; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected structure-array phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
const phase = (value: string) => document.querySelector(`.structure-execution[data-phase="${value}"]`) !== null
const activePart = (value: string) => document.querySelector(`.source-code-panel__part.is-active[data-part="${value}"]`) !== null
function predict(value = '245 2') { fireEvent.change(screen.getByRole('textbox', { name: '預測總分、達標人數' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const slide = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } })
const outputs = () => within(screen.getByRole('list', { name: '結構陣列統計輸出' })).queryAllByRole('listitem').map(item => item.textContent)

beforeEach(() => window.localStorage.clear())

it('selects an element before editing only its score and waits for printf to reveal the result', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.getByLabelText('students[1].score')).toHaveTextContent('—')
  predict('245'); expect(screen.getByRole('alert')).toHaveTextContent('兩個非負整數')
  predict(); advanceUntil(() => phase('initialize-array'))
  expect(screen.getByLabelText('students[1].score')).toHaveTextContent('60')
  expect(screen.getByLabelText('目前總分 total')).toHaveTextContent('—')
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('students[1].score')).toHaveTextContent('70')
  expect(screen.getByLabelText('students[1].id')).toHaveTextContent('12')
  expect(screen.getByLabelText('students[0].score')).toHaveTextContent('80')
  expect(screen.getByLabelText('students[2].score')).toHaveTextContent('95')
  expect(screen.getByLabelText('students[1].score')).toHaveClass('is-written')
  advanceUntil(() => phase('for-init'))
  expect(activePart('for-init')).toBe(true)
  expect(screen.getByLabelText('目前索引 i')).toHaveTextContent('0')
  advanceUntil(() => phase('return-main'))
  expect(outputs()).toEqual(['total=245, passed=2'])
  expect(screen.getByText('你預測 245、2，實際 245、2。預測正確！')).toBeInTheDocument()
  expect(screen.getByLabelText('目前索引 i')).toHaveTextContent('—')
  expect(screen.getByLabelText('目前總分 total')).toHaveTextContent('245')
  finish()
  expect(screen.getByLabelText('students[1].score')).toHaveTextContent('—')
  expect(screen.getByLabelText('目前總分 total')).toHaveTextContent('—')
  expect(loadProgress().lessons['structures-arrays']?.guidedRunCompleted).toBe(true)
})
it('does not reveal the prediction or read a fourth row when i reaches 3', () => {
  renderPage(); predict()
  const index = screen.getByLabelText('目前索引 i')
  advanceUntil(() => phase('for-condition') && index.textContent === '3')
  expect(activePart('for-condition')).toBe(true)
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('3 < 3 → 不成立')
  expect(document.querySelector('.structure-array-table tr[aria-current="true"]')).toBeNull()
  expect(screen.queryByLabelText('students[3].score')).not.toBeInTheDocument()
  expect(outputs()).toEqual([])
  expect(screen.queryByText(/實際 245、2/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(phase('print')).toBe(true)
  expect(index).toHaveTextContent('—')
  expect(outputs()).toEqual(['total=245, passed=2'])
})
it('counts a score exactly at the threshold but skips the increment for a lower score', () => {
  renderPage(); choose('原始成績資料', 'boundary'); choose('要修改的索引', '2'); slide('更新分數', 61); slide('達標門檻', 60)
  predict('180 2'); advanceUntil(() => phase('if-condition'))
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('59 >= 60 → 不成立')
  fireEvent.click(nextButton()); expect(phase('for-update')).toBe(true); expect(activePart('for-update')).toBe(true)
  advanceUntil(() => phase('if-condition'))
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('60 >= 60 → 成立')
  fireEvent.click(nextButton()); expect(phase('count-pass')).toBe(true)
  expect(screen.getByLabelText('目前達標人數 passed')).toHaveTextContent('1')
  finish(); expect(outputs()).toEqual(['total=180, passed=2'])
})
it('supports first and last index updates plus zero and full-score boundaries', () => {
  renderPage(); choose('原始成績資料', 'equal'); choose('要修改的索引', '0'); slide('更新分數', 0); slide('達標門檻', 0)
  predict('120 3'); finish(); expect(outputs()).toEqual(['total=120, passed=3'])
  choose('要修改的索引', '2'); slide('更新分數', 100); slide('達標門檻', 100)
  predict('220 1'); finish(); expect(outputs()).toEqual(['total=220, passed=1'])
})
it('resets an active trace and its prediction when a control changes', () => {
  renderPage(); predict(); advanceUntil(() => phase('add-score'))
  expect(screen.getByLabelText('目前總分 total')).toHaveTextContent('80')
  slide('更新分數', 90)
  expect(phase('prepare')).toBe(true)
  expect(screen.getByLabelText('students[0].score')).toHaveTextContent('—')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '預測總分、達標人數' })).toHaveValue('')
  expect(outputs()).toEqual([])
  predict('265 3'); finish(); expect(outputs()).toEqual(['total=265, passed=3'])
  fireEvent.click(screen.getByRole('button', { name: '恢復預設值' }))
  expect(screen.getByRole('slider', { name: '更新分數' })).toHaveValue('70')
  expect(screen.getByRole('slider', { name: '達標門檻' })).toHaveValue('80')
})
it('completes independent keyboard challenges and restores all four saved controls', () => {
  const view = renderPage()
  choose('原始成績資料', 'boundary'); choose('要修改的索引', '0'); slide('更新分數', 100); slide('達標門檻', 61)
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('2'); expect(loadProgress().lessons['structures-arrays']?.completedChallengeIds).toEqual([])
  solve('1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /先選元素，再選成員/ }), { key: 'ArrowRight' }); solve('245 2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /修改後再統計/ }), { key: 'End' }); solve('2 3')
  expect(screen.getByText('你已完成結構陣列與逐筆統計。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 28, totalChallenges: 84, completedChallenges: 3 })
  expect(loadProgress().lessons['structures-arrays']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '原始成績資料' })).toHaveValue('boundary')
  expect(screen.getByRole('combobox', { name: '要修改的索引' })).toHaveValue('0')
  expect(screen.getByRole('slider', { name: '更新分數' })).toHaveValue('100')
  expect(screen.getByRole('slider', { name: '達標門檻' })).toHaveValue('61')
})
it('synchronizes cross-tab configuration and clearing without recreating progress', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'structures-arrays', lessons: {
    'structures-arrays': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { roster: 'equal', index: 0, score: 60, threshold: 60 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '原始成績資料' })).toHaveValue('equal')
  finish(); expect(outputs()).toEqual(['total=180, passed=3'])
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  expect(screen.getByRole('combobox', { name: '原始成績資料' })).toHaveValue('mixed')
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('structures-arrays')
  expect(loadProgress().lessons['structures-arrays']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed saved settings while retaining a prior structure lesson', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['choose-struct-member'], savedState: { initialization: 'partial', target: 'student', field: 'grade' } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'structures-arrays', lessons: {
    'structures-basics': previous,
    'structures-arrays': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { roster: { toString: null }, index: 0, score: 60, threshold: 60 } },
  } }))
  expect(loadProgress().lessons['structures-basics']).toEqual(previous)
  expect(loadProgress().lessons['structures-arrays']).toMatchObject({ guidedRunCompleted: false, savedState: { roster: 'mixed', index: 1, score: 70, threshold: 80 } })
  expect(isStructureArraySavedState({ roster: 'boundary', index: 2, score: 0, threshold: 100 })).toBe(true)
  for (const value of [null, [], { roster: 'constructor', index: 0, score: 60, threshold: 60 }, { roster: 'mixed', index: 3, score: 60, threshold: 60 }, { roster: 'mixed', index: 0, score: 60, threshold: '60' }]) expect(isStructureArraySavedState(value)).toBe(false)
})
it('opens the lazy hash route with its lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/structures/arrays'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先找到那一筆/ })).toBeInTheDocument()
  expect(document.title).toContain('結構陣列與逐筆統計')
  vi.restoreAllMocks()
})
