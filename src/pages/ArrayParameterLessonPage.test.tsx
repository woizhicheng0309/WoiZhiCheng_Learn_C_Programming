import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isArrayParameterSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { ArrayParameterLessonPage } from './ArrayParameterLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><ArrayParameterLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '陣列參數執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 100; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected trace phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
function predict(value = '13') { fireEvent.change(screen.getByRole('textbox', { name: '預測 process 回傳值' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const activeLine = (line: number) => document.querySelector(`.source-code-panel__line.is-active[data-line="${line}"]`) !== null
const cells = () => within(screen.getByRole('list', { name: '共用 scores 陣列' })).getAllByRole('listitem')
const values = () => cells().map(cell => cell.querySelector('strong')?.textContent)
const outputs = () => within(screen.getByRole('list', { name: '陣列參數輸出' })).queryAllByRole('listitem').map(item => item.textContent)
beforeEach(() => window.localStorage.clear())

it('separates binding, return and caller assignment while keeping both scopes visible correctly', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('13.0')
  expect(screen.getByRole('alert')).toHaveTextContent('請輸入一個整數')
  predict(); advanceUntil(() => activeLine(3))
  expect(screen.getByLabelText('main 呼叫框架')).toHaveTextContent('等待 process 回傳')
  expect(screen.getByLabelText('items 的指向')).toHaveTextContent('items → scores[0]（同一陣列）')
  expect(screen.getByLabelText('main 的 count')).toHaveTextContent('3')
  expect(screen.getByLabelText('process 的 count')).toHaveTextContent('3')
  expect(screen.getByLabelText('main 的 answer')).toHaveTextContent('—')
  expect(values()).toEqual(['4', '7', '2', '9', '5'])
  advanceUntil(() => activeLine(9))
  expect(screen.getByLabelText('已傳回的值')).toHaveTextContent('13。main 尚未完成賦值')
  expect(screen.queryByText(/實際回傳 13/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(activeLine(15)).toBe(true)
  expect(screen.getByText('你預測 13，實際回傳 13。預測正確！')).toBeInTheDocument()
  expect(screen.getByLabelText('main 的 answer')).toHaveTextContent('13')
  expect(screen.getByLabelText('process 的 sum')).toHaveTextContent('—')
  expect(screen.getByLabelText('items 的指向')).toHaveTextContent('不在作用域')
  expect(values()).toEqual(['4', '7', '2', '9', '5'])
})
it('modifies the actual caller array before returning and keeps the unprocessed tail unchanged', () => {
  renderPage()
  fireEvent.click(screen.getByRole('radio', { name: '每格加 2，再加總' }))
  predict('19'); advanceUntil(() => activeLine(6))
  expect(values()).toEqual(['6', '7', '2', '9', '5'])
  expect(screen.getByLabelText('main 呼叫框架')).toHaveTextContent('等待 process 回傳')
  expect(screen.getByLabelText('process 的 sum')).toHaveTextContent('0')
  expect(cells()[3]).toHaveTextContent('process 不處理')
  finish()
  expect(outputs()).toEqual(['answer=19', '6', '9', '4', '9', '5'])
  expect(values()).toEqual(['—', '—', '—', '—', '—'])
  expect(loadProgress().lessons['pointers-array-parameters']?.guidedRunCompleted).toBe(true)
})
it('reads only the selected prefix while leaving every original element unchanged', () => {
  renderPage(); predict(); finish()
  expect(outputs()).toEqual(['answer=13', '4', '7', '2', '9', '5'])
  expect(screen.getByText(/process 已加總 3 格、寫入 0 格/)).toBeInTheDocument()
})
it('accepts count zero and returns zero without writing an element', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '傳入的 count' }), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('radio', { name: '每格加 2，再加總' }))
  predict('0'); finish()
  expect(outputs()).toEqual(['answer=0', '4', '7', '2', '9', '5'])
  expect(screen.getByText(/process 已加總 0 格、寫入 0 格/)).toBeInTheDocument()
})
it('processes all five cells without reading the loop index after it reaches five', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '傳入的 count' }), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('radio', { name: '每格加 2，再加總' }))
  predict('37'); advanceUntil(() => document.querySelector('[aria-label="process 的 i，5"]') !== null)
  expect(cells()).toHaveLength(5)
  expect(document.querySelector('.array-parameter-memory [aria-current="step"]')).toBeNull()
  finish()
  expect(outputs()).toEqual(['answer=37', '6', '9', '4', '11', '7'])
})
it('supports negative return values and resets the trace when the function behavior changes', () => {
  renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '陣列範例' }), { target: { value: 'mixed' } })
  predict('-3'); finish()
  expect(outputs()).toEqual(['answer=-3', '-4', '2', '-1', '3', '-2'])
  expect(screen.getByText('你預測 -3，實際回傳 -3。預測正確！')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: '每格加 2，再加總' }))
  expect(outputs()).toEqual([])
  expect(activeLine(12)).toBe(true)
  expect(screen.queryByText(/實際回傳/)).not.toBeInTheDocument()
  finish()
  expect(outputs()).toEqual(['answer=3', '-2', '4', '1', '3', '-2'])
})
it('completes keyboard challenges independently and restores saved controls after reload', () => {
  const view = renderPage()
  fireEvent.change(screen.getByRole('combobox', { name: '傳入的 count' }), { target: { value: '0' } })
  fireEvent.change(screen.getByRole('combobox', { name: '陣列範例' }), { target: { value: 'zeros' } })
  fireEvent.click(screen.getByRole('radio', { name: '每格加 2，再加總' }))
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('13')
  fireEvent.keyDown(screen.getByRole('tab', { name: /只加總指定範圍/ }), { key: 'ArrowRight' }); solve('6 9 4 9 5')
  fireEvent.keyDown(screen.getByRole('tab', { name: /呼叫端陣列也改變/ }), { key: 'End' }); solve('2')
  expect(screen.getByText('你已完成陣列作為函式參數。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 29, totalChallenges: 87, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '傳入的 count' })).toHaveValue('0')
  expect(screen.getByRole('combobox', { name: '陣列範例' })).toHaveValue('zeros')
  expect(screen.getByRole('radio', { name: '每格加 2，再加總' })).toBeChecked()
})
it('synchronizes another tab and clears at the final frame without recreating progress', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'pointers-array-parameters', lessons: {
    'pointers-array-parameters': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'mixed', count: 2, mode: 'read-only' } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '傳入的 count' })).toHaveValue('2')
  expect(screen.getByRole('combobox', { name: '陣列範例' })).toHaveValue('mixed')
  finish()
  expect(outputs()[0]).toBe('answer=-2')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('pointers-array-parameters')
  expect(loadProgress().lessons['pointers-array-parameters']?.guidedRunCompleted).toBe(true)
})
it('recovers only invalid array-parameter state and retains an earlier string lesson', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['count-copy-characters'], savedState: { sample: 'empty', capacity: 1 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'pointers-array-parameters', lessons: {
    'pointers-array-parameters': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: { toString: null }, count: 3, mode: 'modify' } }, 'arrays-string-copy': previous,
  } }))
  expect(loadProgress().lessons['arrays-string-copy']).toEqual(previous)
  expect(loadProgress().lessons['pointers-array-parameters']).toMatchObject({ guidedRunCompleted: false, savedState: { sample: 'positive', count: 3, mode: 'read-only' } })
  expect(isArrayParameterSavedState({ sample: 'zeros', count: 0, mode: 'modify' })).toBe(true)
  for (const value of [null, [], { sample: 'positive', count: 6, mode: 'modify' }, { sample: 'positive', count: '3', mode: 'modify' }, { sample: 'constructor', count: 3, mode: 'read-only' }]) expect(isArrayParameterSavedState(value)).toBe(false)
})
it('opens the lazy hash route and applies its lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/pointers/array-parameters'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /陣列交給函式/ })).toBeInTheDocument()
  expect(document.title).toContain('陣列作為函式參數')
  vi.restoreAllMocks()
})
