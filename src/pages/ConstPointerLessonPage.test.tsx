import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isConstPointerSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { ConstPointerLessonPage } from './ConstPointerLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><ConstPointerLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'const 指標執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 30; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected const pointer phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
function predict(value = '10 20 20') { fireEvent.change(screen.getByRole('textbox', { name: '預測 x、y、*p' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const activeLine = (line: number) => document.querySelector(`.source-code-panel__line.is-active[data-line="${line}"]`) !== null
const outputs = () => within(screen.getByRole('list', { name: 'const 指標輸出' })).queryAllByRole('listitem').map(item => item.textContent)
beforeEach(() => window.localStorage.clear())

it('shows the permission matrix and distinguishes a pointer rebind from changing the original values', () => {
  renderPage()
  const table = screen.getByRole('table', { name: '初始化 p 之後，哪些賦值操作有效？' })
  expect(within(table).getAllByRole('row')).toHaveLength(5)
  expect(within(table.querySelector('tr.is-selected')!).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['不可以', '可以'])
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('10 20')
  expect(screen.getByRole('alert')).toHaveTextContent('三個整數')
  predict()
  expect(screen.getByLabelText('x 的值')).toHaveTextContent('—')
  expect(screen.getByLabelText('執行階段')).toHaveTextContent('main 尚未開始')
  advanceUntil(() => document.querySelector('[aria-label="p 的指向"]')?.textContent === 'p → x')
  expect(screen.getByLabelText('目前解參照值')).toHaveTextContent('10')
  fireEvent.click(nextButton())
  expect(activeLine(7)).toBe(true)
  expect(screen.getByLabelText('p 的指向')).toHaveTextContent('p → y')
  expect(screen.getByLabelText('x 的值')).toHaveTextContent('10')
  expect(screen.getByLabelText('y 的值')).toHaveTextContent('20')
  expect(screen.queryByText(/實際 10、20、20/)).not.toBeInTheDocument()
  finish()
  expect(outputs()).toEqual(['x=10, y=20, *p=20'])
  expect(screen.getByText('你預測 10、20、20，實際 10、20、20。預測正確！')).toBeInTheDocument()
  expect(screen.getByLabelText('x 的值')).toHaveTextContent('—')
  expect(loadProgress().lessons['pointers-const']?.guidedRunCompleted).toBe(true)
})
it('rejects writing through const int before main and restores that compile-error scenario', () => {
  const view = renderPage()
  choose('準備執行的操作', 'write-through')
  expect(screen.queryByRole('textbox', { name: '預測 x、y、*p' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('x 的值')).toHaveTextContent('—')
  finish()
  expect(screen.getByRole('alert')).toHaveTextContent('不能透過 *p 賦值')
  expect(activeLine(7)).toBe(true)
  expect(screen.getByLabelText('執行階段')).toHaveTextContent('main 尚未開始')
  expect(screen.getByLabelText('x 的值')).toHaveTextContent('—')
  expect(screen.getByLabelText('y 的值')).toHaveTextContent('—')
  expect(screen.getByLabelText('p 的指向')).toHaveTextContent('尚未建立')
  expect(outputs()).toEqual([])
  expect(loadProgress().lessons['pointers-const']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage(); finish()
  expect(screen.getByRole('alert')).toHaveTextContent('不能透過 *p 賦值')
  expect(outputs()).toEqual([])
})
it('allows writing through a fixed pointer to either mutable original', () => {
  renderPage()
  choose('指標宣告', 'pointer-const'); choose('準備執行的操作', 'write-through')
  predict('30 20 30'); advanceUntil(() => activeLine(7))
  expect(screen.getByLabelText('p 的指向')).toHaveTextContent('p → x')
  expect(screen.getByLabelText('x 的值')).toHaveTextContent('30')
  finish()
  expect(outputs()).toEqual(['x=30, y=20, *p=30'])
  choose('初始指向', 'y'); predict('10 30 30'); finish()
  expect(outputs()).toEqual(['x=10, y=30, *p=30'])
})
it('rejects const pointer rebinding and both-const indirect writes, then requires prediction for a legal run', () => {
  renderPage(); choose('指標宣告', 'pointer-const'); finish()
  expect(screen.getByRole('alert')).toHaveTextContent('不能重新指定指向')
  expect(outputs()).toEqual([])
  choose('指標宣告', 'both-const'); choose('準備執行的操作', 'write-through'); finish()
  expect(screen.getByRole('alert')).toHaveTextContent('不能透過 *p 賦值')
  expect(loadProgress().lessons['pointers-const']?.guidedRunCompleted).toBe(false)
  choose('準備執行的操作', 'direct-write')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('30 20 30'); finish()
  expect(outputs()).toEqual(['x=30, y=20, *p=30'])
})
it('allows direct changes to mutable x without making the read-only alias stale', () => {
  renderPage(); choose('指標宣告', 'both-const'); choose('準備執行的操作', 'direct-write')
  predict('30 20 30'); advanceUntil(() => activeLine(7))
  expect(screen.getByLabelText('p 的指向')).toHaveTextContent('p → x')
  expect(screen.getByLabelText('目前解參照值')).toHaveTextContent('30')
  finish()
  expect(outputs()).toEqual(['x=30, y=20, *p=30'])
  choose('初始指向', 'y'); predict('30 20 20'); finish()
  expect(outputs()).toEqual(['x=30, y=20, *p=20'])
})
it('permits both operations for int *p and resets execution from the configured initial target', () => {
  renderPage(); choose('指標宣告', 'mutable'); predict(); finish()
  expect(outputs()).toEqual(['x=10, y=20, *p=20'])
  choose('準備執行的操作', 'write-through')
  expect(outputs()).toEqual([])
  expect(screen.getByLabelText('p 的指向')).toHaveTextContent('尚未建立')
  expect(screen.queryByText(/實際 10、20、20/)).not.toBeInTheDocument()
  predict('30 20 30'); finish()
  expect(outputs()).toEqual(['x=30, y=20, *p=30'])
})
it('completes keyboard challenges and preserves an inspectable compile-error configuration', () => {
  const view = renderPage()
  choose('指標宣告', 'pointer-const'); choose('初始指向', 'y')
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /可改指向，但不可透過它改值/ }), { key: 'ArrowRight' }); solve('30 20 30')
  fireEvent.keyDown(screen.getByRole('tab', { name: /固定指標仍可改值/ }), { key: 'End' }); solve('30')
  expect(screen.getByText('你已完成指標與 const。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 31, totalChallenges: 93, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '指標宣告' })).toHaveValue('pointer-const')
  expect(screen.getByRole('combobox', { name: '初始指向' })).toHaveValue('y')
  finish()
  expect(screen.getByRole('alert')).toHaveTextContent('不能重新指定指向')
  expect(loadProgress().lessons['pointers-const']?.guidedRunCompleted).toBe(false)
})
it('synchronizes another tab, clears at the final step and permits an explicit fresh start', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'pointers-const', lessons: {
    'pointers-const': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { kind: 'pointer-const', operation: 'write-through', target: 'y' } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '初始指向' })).toHaveValue('y')
  finish()
  expect(outputs()).toEqual(['x=10, y=30, *p=30'])
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('pointers-const')
  expect(loadProgress().lessons['pointers-const']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed const state while retaining a valid string comparison lesson', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['find-first-difference'], savedState: { sample: 'empty', reversed: true } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'pointers-const', lessons: {
    'pointers-const': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { kind: { toString: null }, operation: 'rebind', target: 'x' } }, 'arrays-string-comparison': previous,
  } }))
  expect(loadProgress().lessons['arrays-string-comparison']).toEqual(previous)
  expect(loadProgress().lessons['pointers-const']).toMatchObject({ guidedRunCompleted: false, savedState: { kind: 'pointee-const', operation: 'rebind', target: 'x' } })
  expect(isConstPointerSavedState({ kind: 'both-const', operation: 'write-through', target: 'y' })).toBe(true)
  for (const value of [null, [], { kind: 'constructor', operation: 'rebind', target: 'x' }, { kind: 'mutable', operation: 'other', target: 'x' }, { kind: 'mutable', operation: 'rebind', target: 0 }]) expect(isConstPointerSavedState(value)).toBe(false)
})
it('opens the lazy hash route with the const lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/pointers/const'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /限制透過它改值/ })).toBeInTheDocument()
  expect(document.title).toContain('指標與 const')
  vi.restoreAllMocks()
})
