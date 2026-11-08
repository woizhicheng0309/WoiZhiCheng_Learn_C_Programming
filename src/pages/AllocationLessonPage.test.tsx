import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isAllocationSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { AllocationLessonPage } from './AllocationLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><AllocationLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '動態記憶體執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 60; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected allocation phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
const phase = (value: string) => document.querySelector(`.allocation-execution[data-phase="${value}"]`) !== null
const activeLine = (line: number) => document.querySelector(`.source-code-panel__line.is-active[data-line="${line}"]`) !== null
function predict(value = '18') { fireEvent.change(screen.getByRole('textbox', { name: /預測 (sum 的輸出|main 回傳值)/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const slide = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } })
const outputs = () => within(screen.getByRole('list', { name: '動態記憶體輸出' })).queryAllByRole('listitem').map(item => item.textContent)
beforeEach(() => window.localStorage.clear())

it('shows unknown malloc elements until each is written before being read', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('配置元素[0]')).not.toBeInTheDocument()
  predict('18 0'); expect(screen.getByRole('alert')).toHaveTextContent('一個非負整數')
  predict(); advanceUntil(() => phase('allocate'))
  expect(screen.getByLabelText('指標 p')).toHaveTextContent('→ 配置區塊')
  expect(screen.getByLabelText('配置元素[0]')).toHaveTextContent('未初始化')
  expect(screen.getByLabelText('配置元素[1]')).toHaveTextContent('未初始化')
  expect(screen.getByLabelText('目前 sum')).toHaveTextContent('—')
  advanceUntil(() => phase('initialize-cell'))
  expect(screen.getByLabelText('配置元素[0]')).toHaveTextContent('5')
  expect(screen.getByLabelText('配置元素[1]')).toHaveTextContent('未初始化')
  expect(screen.getByLabelText('目前 sum')).toHaveTextContent('0')
  fireEvent.click(nextButton()); expect(screen.getByLabelText('目前 sum')).toHaveTextContent('5')
  advanceUntil(() => phase('for-condition') && document.querySelector('[aria-label="目前 i"]')?.textContent === '3')
  expect(outputs()).toEqual([])
  expect(screen.queryByText(/實際 18/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測 18，實際 18。預測正確！')).toBeInTheDocument()
  expect(screen.getByLabelText('目前 i')).toHaveTextContent('—')
  expect(outputs()).toEqual(['sum=18'])
})
it('does not retain readable cells after free and separates pointer clearing from release', () => {
  renderPage(); predict(); advanceUntil(() => phase('print-sum'))
  expect(screen.getByLabelText('配置元素[2]')).toHaveTextContent('7')
  fireEvent.click(nextButton()); expect(phase('free')).toBe(true); expect(activeLine(17)).toBe(true)
  expect(screen.getByLabelText('配置區塊')).toHaveTextContent('已釋放')
  expect(screen.getByLabelText('指標 p')).toHaveTextContent('失效（不可讀取）')
  for (const index of [0, 1, 2]) expect(screen.getByLabelText(`配置元素[${index}]`)).toHaveTextContent('不可存取')
  fireEvent.click(nextButton()); expect(activeLine(18)).toBe(true)
  expect(screen.getByLabelText('指標 p')).toHaveTextContent('NULL')
  finish()
  expect(screen.getByLabelText('指標 p')).toHaveTextContent('—')
  expect(screen.getByLabelText('目前 sum')).toHaveTextContent('—')
  expect(screen.getByLabelText('main 回傳值')).toHaveTextContent('0')
  expect(outputs()).toEqual(['sum=18'])
  expect(loadProgress().lessons['memory-allocation']?.guidedRunCompleted).toBe(true)
})
it('starts calloc int elements at zero while preserving the same explicit initialization and sum', () => {
  renderPage(); choose('配置函式', 'calloc'); predict(); advanceUntil(() => phase('allocate'))
  expect(screen.getByLabelText('C 程式碼，目前執行第 6 行')).toHaveTextContent('calloc((size_t)count, sizeof *p)')
  for (const index of [0, 1, 2]) expect(screen.getByLabelText(`配置元素[${index}]`)).toHaveTextContent('0')
  advanceUntil(() => phase('initialize-cell'))
  expect(screen.getByLabelText('配置元素[0]')).toHaveTextContent('5')
  expect(screen.getByLabelText('配置元素[1]')).toHaveTextContent('0')
  finish(); expect(outputs()).toEqual(['sum=18'])
})
it('handles failure without creating elements or sum and reveals its return value only on return', () => {
  renderPage(); choose('配置結果（模擬情境）', 'failure')
  expect(screen.getByRole('slider', { name: '寫入起始值' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: '預測 main 回傳值' })).toBeInTheDocument()
  predict('1'); advanceUntil(() => phase('check-allocation'))
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('p == NULL → 成立')
  expect(screen.getByLabelText('指標 p')).toHaveTextContent('NULL')
  expect(screen.queryByLabelText('配置元素[0]')).not.toBeInTheDocument()
  expect(screen.getByLabelText('目前 sum')).toHaveTextContent('—')
  fireEvent.click(nextButton()); expect(activeLine(8)).toBe(true)
  expect(outputs()).toEqual(['allocation failed'])
  expect(screen.queryByText(/實際 1/)).not.toBeInTheDocument()
  fireEvent.click(nextButton()); expect(activeLine(9)).toBe(true)
  expect(screen.getByText('你預測 1，實際 1。預測正確！')).toBeInTheDocument()
  finish()
  expect(screen.getByLabelText('配置區塊')).toHaveTextContent('配置失敗')
  expect(screen.getByLabelText('main 回傳值')).toHaveTextContent('1')
  expect(loadProgress().lessons['memory-allocation']?.guidedRunCompleted).toBe(true)
})
it('supports one zero-valued element and the maximum count and starting value', () => {
  renderPage(); slide('元素數量 count', 1); slide('寫入起始值', 0)
  predict('0'); finish(); expect(outputs()).toEqual(['sum=0'])
  expect(screen.getByText('你預測 0，實際 0。預測正確！')).toBeInTheDocument()
  slide('元素數量 count', 5); slide('寫入起始值', 20)
  predict('100'); finish(); expect(outputs()).toEqual(['sum=110'])
  expect(screen.getByText(/你預測 100，實際 110/)).toHaveTextContent('起始值加上索引')
})
it('resets the trace and switches prediction meaning when the outcome changes', () => {
  renderPage(); predict(); advanceUntil(() => phase('accumulate'))
  choose('配置結果（模擬情境）', 'failure')
  expect(phase('prepare')).toBe(true)
  expect(screen.queryByLabelText('配置元素[0]')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '預測 main 回傳值' })).toHaveValue('')
  expect(outputs()).toEqual([])
  predict('1'); finish()
  fireEvent.click(screen.getByRole('button', { name: '恢復預設值' }))
  expect(screen.getByRole('combobox', { name: '配置結果（模擬情境）' })).toHaveValue('success')
  expect(screen.getByRole('textbox', { name: '預測 sum 的輸出' })).toHaveValue('')
})
it('completes independent keyboard challenges and restores all settings without a fake guided run', () => {
  const view = renderPage()
  choose('配置函式', 'calloc'); slide('元素數量 count', 5); slide('寫入起始值', 20); choose('配置結果（模擬情境）', 'failure')
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('1'); expect(loadProgress().lessons['memory-allocation']?.completedChallengeIds).toEqual([])
  solve('2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /配置成功還需要初始化/ }), { key: 'ArrowRight' }); solve('18')
  fireEvent.keyDown(screen.getByRole('tab', { name: /逐格寫入再加總/ }), { key: 'End' }); solve('3')
  expect(screen.getByText('你已完成動態記憶體配置與釋放。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 31, totalChallenges: 93, completedChallenges: 3 })
  expect(loadProgress().lessons['memory-allocation']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '配置函式' })).toHaveValue('calloc')
  expect(screen.getByRole('combobox', { name: '配置結果（模擬情境）' })).toHaveValue('failure')
  expect(screen.getByRole('slider', { name: '元素數量 count' })).toHaveValue('5')
  expect(screen.getByRole('slider', { name: '寫入起始值' })).toHaveValue('20')
})
it('synchronizes another tab and clearing without recreating progress until a restart', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'memory-allocation', lessons: {
    'memory-allocation': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { allocator: 'calloc', outcome: 'success', count: 1, start: 0 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '配置函式' })).toHaveValue('calloc')
  finish(); expect(outputs()).toEqual(['sum=0'])
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('memory-allocation')
  expect(loadProgress().lessons['memory-allocation']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed allocation state and retains prior structure-pointer progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['choose-structure-arrow'], savedState: { syntax: 'dereference', initialTarget: 'first', target: 'null', aliasScore: 95, pointedScore: 70 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'memory-allocation', lessons: {
    'structures-pointers': previous,
    'memory-allocation': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { allocator: { toString: null }, outcome: 'success', count: 3, start: 5 } },
  } }))
  expect(loadProgress().lessons['structures-pointers']).toEqual(previous)
  expect(loadProgress().lessons['memory-allocation']).toMatchObject({ guidedRunCompleted: false, savedState: { allocator: 'malloc', outcome: 'success', count: 3, start: 5 } })
  expect(isAllocationSavedState({ allocator: 'calloc', outcome: 'failure', count: 5, start: 20 })).toBe(true)
  for (const value of [null, [], { allocator: 'constructor', outcome: 'success', count: 3, start: 5 }, { allocator: 'malloc', outcome: 'success', count: 0, start: 5 }, { allocator: 'malloc', outcome: 'failure', count: 3, start: '5' }]) expect(isAllocationSavedState(value)).toBe(false)
})
it('opens its lazy hash route with the chapter-eight lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/memory/allocation'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先取得空間/ })).toBeInTheDocument()
  expect(document.title).toContain('動態記憶體配置與釋放')
  vi.restoreAllMocks()
})
