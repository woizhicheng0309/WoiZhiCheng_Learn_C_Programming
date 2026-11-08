import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, HashRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, loadProgress, getCourseProgress, isSelectionSortSavedState } from '../state'
import { SelectionSortLessonPage } from './SelectionSortLessonPage'
import App from '../App'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><SelectionSortLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '排序執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 200; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected trace phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
function predict(value = '1 4 5 2 3') { fireEvent.change(screen.getByRole('textbox', { name: '預測第一輪陣列' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
function cells() { return within(screen.getByRole('list', { name: '排序元素' })).getAllByRole('listitem') }
const values = () => cells().map(item => item.querySelector('strong')?.textContent)
const outputs = () => within(screen.getByRole('list', { name: '排序輸出' })).queryAllByRole('listitem').map(item => Number(item.textContent))
beforeEach(() => window.localStorage.clear())

it('requires a five-number prediction and reveals only the first-pass arrangement when that pass ends', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('1 2')
  expect(screen.getByRole('alert')).toHaveTextContent('五個整數')
  predict()
  advanceUntil(() => screen.queryByLabelText('C 程式碼，目前執行第 13 行') !== null)
  expect(screen.queryByText(/實際 1、4/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('temp，4')).toHaveTextContent('4')
  fireEvent.click(nextButton())
  expect(values()).toEqual(['1', '1', '5', '2', '3'])
  expect(screen.getByLabelText('temp，4')).toHaveTextContent('4')
  fireEvent.click(nextButton())
  expect(values()).toEqual(['1', '4', '5', '2', '3'])
  advanceUntil(() => screen.queryByLabelText('C 程式碼，目前執行第 17 行') !== null)
  expect(screen.getByText(/實際 1、4、5、2、3。預測正確/)).toBeInTheDocument()
  expect(cells()[0]).toHaveTextContent('已放好')
  expect(cells()[1]).toHaveTextContent('尚未放好')
})
it('sorts the full array, counts only element comparisons and persists guided completion', () => {
  renderPage(); predict(); finish()
  expect(outputs()).toEqual([1, 2, 3, 4, 5])
  expect(screen.getByText('元素比較：10 次；完成交換：3 次。')).toBeInTheDocument()
  expect(values()).toEqual(['—', '—', '—', '—', '—'])
  expect(loadProgress().lessons['arrays-selection-sort']?.guidedRunCompleted).toBe(true)
})
it('resets on direction change and sorts duplicate values in descending order', () => {
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
it('recognizes no-swap passes without skipping comparisons on sorted input', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '陣列範例' }), { target: { value: 'sorted' } })
  predict('1 2 3 4 5'); finish()
  expect(outputs()).toEqual([1, 2, 3, 4, 5])
  expect(screen.getByText('元素比較：10 次；完成交換：0 次。')).toBeInTheDocument()
})
it('synchronizes another tab and clears at the final frame without recreating progress', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-selection-sort', lessons: {
    'arrays-selection-sort': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'sorted', order: 'descending' } },
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
it('completes and restores all three challenges using keyboard tab navigation', () => {
  const view = renderPage()
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /第一輪候選的位置/ }), { key: 'ArrowRight' }); solve('1 4 5 2 3')
  fireEvent.keyDown(screen.getByRole('tab', { name: /預測第一輪交換後/ }), { key: 'End' }); solve('10')
  expect(screen.getByText('你已完成選擇排序與交換。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 19, totalChallenges: 57, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})
it('recovers damaged sorting state independently and rejects invalid enum keys', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { target: 15, count: 7 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-selection-sort', lessons: {
    'arrays-selection-sort': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: '__proto__', order: 'ascending' } }, 'arrays-binary-search': previous,
  } }))
  expect(loadProgress().lessons['arrays-binary-search']).toEqual(previous)
  expect(loadProgress().lessons['arrays-selection-sort']).toMatchObject({ guidedRunCompleted: false, savedState: { sample: 'mixed', order: 'ascending' } })
  expect(isSelectionSortSavedState({ sample: 'duplicates', order: 'descending' })).toBe(true)
  for (const sample of ['bad', '__proto__', 'constructor', null, []]) expect(isSelectionSortSavedState({ sample, order: 'ascending' })).toBe(false)
})
it('opens the hash route with its own title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/arrays/selection-sort'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /每輪選一個/ })).toBeInTheDocument()
  expect(document.title).toContain('選擇排序與交換')
  vi.restoreAllMocks()
})
