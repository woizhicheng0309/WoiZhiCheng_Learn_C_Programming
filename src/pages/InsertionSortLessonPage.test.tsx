import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, HashRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, loadProgress, getCourseProgress, isInsertionSortSavedState } from '../state'
import { InsertionSortLessonPage } from './InsertionSortLessonPage'
import App from '../App'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><InsertionSortLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '插入排序執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 200; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected trace phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
function predict(value = '3 4 1 5 2') { fireEvent.change(screen.getByRole('textbox', { name: '預測第一輪陣列' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const values = () => within(screen.getByRole('list', { name: '插入排序元素' })).getAllByRole('listitem').map(item => item.querySelector('strong')?.textContent)
const outputs = () => within(screen.getByRole('list', { name: '插入排序輸出' })).queryAllByRole('listitem').map(item => Number(item.textContent))
const activePart = (id: string) => document.querySelector(`[data-part="${id}"][data-active="true"]`)
beforeEach(() => window.localStorage.clear())

it('requires a prediction and preserves key while moving a value, then short-circuits the negative index', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('3 4')
  expect(screen.getByRole('alert')).toHaveTextContent('五個整數')
  predict()
  advanceUntil(() => document.querySelector('.source-code-panel__line.is-active[data-line="9"]') !== null)
  expect(values()).toEqual(['4', '4', '1', '5', '2'])
  expect(screen.getByLabelText('key，3')).toHaveTextContent('3')
  expect(screen.queryByText(/實際 3、4/)).not.toBeInTheDocument()
  fireEvent.click(nextButton()); fireEvent.click(nextButton())
  expect(screen.getByLabelText('j，-1')).toHaveTextContent('-1')
  expect(activePart('index-guard')).toHaveTextContent('j >= 0')
  expect(activePart('value-compare')).toBeNull()
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('C 程式碼，目前執行第 12 行')).toBeInTheDocument()
  expect(values()).toEqual(['3', '4', '1', '5', '2'])
  fireEvent.click(nextButton())
  expect(screen.getByText(/實際 3、4、1、5、2。預測正確/)).toBeInTheDocument()
})
it('highlights the right-hand comparison only after a successful boundary check and completes sorting', () => {
  renderPage(); predict()
  advanceUntil(() => activePart('value-compare') !== null)
  expect(activePart('value-compare')).toHaveTextContent('values[j] > key')
  expect(activePart('index-guard')).toBeNull()
  finish()
  expect(outputs()).toEqual([1, 2, 3, 4, 5])
  expect(screen.getByText('元素比較：8 次；右移：6 次。')).toBeInTheDocument()
  expect(values()).toEqual(['—', '—', '—', '—', '—'])
  expect(loadProgress().lessons['arrays-insertion-sort']?.guidedRunCompleted).toBe(true)
})
it('sorts duplicates in descending order and resets the trace on direction changes', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '陣列範例' }), { target: { value: 'duplicates' } })
  fireEvent.click(screen.getByRole('radio', { name: '降冪：大到小' }))
  predict('3 1 3 2 1'); finish()
  expect(outputs()).toEqual([3, 3, 2, 1, 1])
  fireEvent.click(screen.getByRole('radio', { name: '升冪：小到大' }))
  expect(outputs()).toEqual([])
  expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
  expect(screen.queryByText(/實際 3、/)).not.toBeInTheDocument()
})
it('performs no right shifts on already sorted ascending data', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '陣列範例' }), { target: { value: 'sorted' } })
  predict('1 2 3 4 5'); finish()
  expect(outputs()).toEqual([1, 2, 3, 4, 5])
  expect(screen.getByText('元素比較：4 次；右移：0 次。')).toBeInTheDocument()
})
it('synchronizes stored configuration and clears progress at the completed frame without recreating it', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-insertion-sort', lessons: {
    'arrays-insertion-sort': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'sorted', order: 'descending' } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '陣列範例' })).toHaveValue('sorted')
  expect(screen.getByRole('radio', { name: '降冪：大到小' })).toBeChecked()
  finish()
  expect(outputs()).toEqual([5, 4, 3, 2, 1])
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
it('completes and reloads all challenges using keyboard tab navigation', () => {
  const view = renderPage()
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('3 4 1 5 2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /預測第一輪插入後/ }), { key: 'ArrowRight' }); solve('0')
  fireEvent.keyDown(screen.getByRole('tab', { name: /負索引與短路判斷/ }), { key: 'End' }); solve('0')
  expect(screen.getByText('你已完成插入排序與右移。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 24, totalChallenges: 72, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})
it('restores a damaged lesson independently and rejects invalid sample or direction enums', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'mixed', order: 'ascending' } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-insertion-sort', lessons: {
    'arrays-insertion-sort': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: '__proto__', order: 'ascending' } }, 'arrays-selection-sort': previous,
  } }))
  expect(loadProgress().lessons['arrays-selection-sort']).toEqual(previous)
  expect(loadProgress().lessons['arrays-insertion-sort']).toMatchObject({ guidedRunCompleted: false, savedState: { sample: 'mixed', order: 'ascending' } })
  expect(isInsertionSortSavedState({ sample: 'duplicates', order: 'descending' })).toBe(true)
  for (const sample of ['bad', '__proto__', null, []]) expect(isInsertionSortSavedState({ sample, order: 'ascending' })).toBe(false)
  expect(isInsertionSortSavedState({ sample: 'mixed', order: 'bad' })).toBe(false)
})
it('opens its hash route with the lesson document title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/arrays/insertion-sort'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先保留 key/ })).toBeInTheDocument()
  expect(document.title).toContain('插入排序與右移')
  vi.restoreAllMocks()
})
