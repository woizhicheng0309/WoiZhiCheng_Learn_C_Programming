import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isStringComparisonSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { StringComparisonLessonPage } from './StringComparisonLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><StringComparisonLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '字串比較執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 100; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected comparison phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
function predict(value = 'positive') { fireEvent.change(screen.getByRole('combobox', { name: '預測 strcmp 結果符號' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const activeLine = (line: number) => document.querySelector(`.source-code-panel__line.is-active[data-line="${line}"]`) !== null
const activePart = (id: string) => document.querySelector(`[data-part="${id}"][data-active="true"]`)
const cells = (name: string) => within(screen.getByRole('list', { name: name + ' 字元陣列' })).getAllByRole('listitem')
const outputs = () => within(screen.getByRole('list', { name: '字串比較輸出' })).queryAllByRole('listitem').map(item => item.textContent)
const sample = (value: string) => fireEvent.change(screen.getByRole('combobox', { name: '比較範例' }), { target: { value } })
beforeEach(() => window.localStorage.clear())

it('requires a sign prediction and reveals the library sign only after strcmp returns', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
  expect(screen.getByRole('alert')).toHaveTextContent('請先選擇負值、零或正值')
  predict(); advanceUntil(() => activeLine(13))
  expect(screen.getByLabelText('手寫比較結果')).toHaveTextContent('1')
  expect(screen.getByLabelText('strcmp 結果符號')).toHaveTextContent('尚未取得結果')
  expect(screen.queryByText(/實際為正值/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測正值，實際為正值。預測正確！')).toBeInTheDocument()
  expect(screen.getByLabelText('strcmp 結果符號')).toHaveTextContent('正值；非零數值不固定')
  finish()
  expect(outputs()).toEqual(['manual=1', 'strcmp: positive'])
  expect(cells('left').every(cell => cell.textContent?.includes('離開作用域'))).toBe(true)
  expect(loadProgress().lessons['arrays-string-comparison']?.guidedRunCompleted).toBe(true)
})
it('short-circuits at the left terminator, then explicitly reads the decisive pair', () => {
  renderPage(); sample('prefix'); predict('negative')
  advanceUntil(() => activePart('terminator-guard') !== null && document.querySelector('[aria-label="目前比較索引"]')?.textContent === '3')
  expect(activePart('pair-equality')).toBeNull()
  expect(cells('left')[3]).toHaveAttribute('aria-current', 'step')
  expect(cells('right').every(cell => !cell.hasAttribute('aria-current'))).toBe(true)
  fireEvent.click(nextButton())
  expect(activeLine(10)).toBe(true)
  expect(screen.getByLabelText('目前比較索引')).toHaveTextContent('3')
  fireEvent.click(nextButton()); fireEvent.click(nextButton())
  expect(activeLine(12)).toBe(true)
  expect(screen.getByLabelText('左側位元組值')).toHaveTextContent('0')
  expect(screen.getByLabelText('右側位元組值')).toHaveTextContent('84')
  finish()
  expect(outputs()).toEqual(['manual=-1', 'strcmp: negative'])
})
it('compares equal strings and ignores differing stored characters after embedded terminators', () => {
  renderPage(); sample('equal'); predict('zero'); finish()
  expect(outputs()).toEqual(['manual=0', 'strcmp: zero'])
  sample('embedded-nul'); predict('zero'); advanceUntil(() => activeLine(13))
  expect(cells('left')[3]).toHaveTextContent('Z')
  expect(cells('right')[3]).toHaveTextContent('A')
  expect(cells('left')[3]).toHaveTextContent('結尾後資料')
  expect(cells('right')[3]).toHaveTextContent('結尾後資料')
  expect(screen.getByLabelText('比較判定位置')).toHaveTextContent('索引 2；前面 2 個內容字元相同')
  expect(screen.getByLabelText('手寫比較結果')).toHaveTextContent('0')
  finish()
  expect(outputs()).toEqual(['manual=0', 'strcmp: zero'])
})
it('reverses a nonzero relation and clears earlier output and prediction feedback', () => {
  renderPage(); predict(); finish()
  fireEvent.click(screen.getByRole('checkbox', { name: '交換左右字串' }))
  expect(outputs()).toEqual([])
  expect(activeLine(4)).toBe(true)
  expect(screen.queryByText(/實際為/)).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: '預測 strcmp 結果符號' })).toHaveValue('')
  predict('negative'); finish()
  expect(outputs()).toEqual(['manual=-1', 'strcmp: negative'])
  expect(loadProgress().lessons['arrays-string-comparison']?.savedState).toEqual({ sample: 'different', reversed: true })
})
it('handles the empty string and sorts by the first different byte rather than length', () => {
  renderPage(); sample('empty'); predict('negative'); advanceUntil(() => activeLine(14))
  expect(cells('left')).toHaveLength(1)
  expect(cells('right')).toHaveLength(2)
  expect(screen.getByLabelText('左側位元組值')).toHaveTextContent('0')
  finish()
  expect(outputs()).toEqual(['manual=-1', 'strcmp: negative'])
  sample('first-character'); predict(); finish()
  expect(outputs()).toEqual(['manual=1', 'strcmp: positive'])
  expect(screen.getByLabelText('比較判定位置')).toHaveTextContent('索引 0')
})
it('shows ASCII case values and a library sign without inventing a specific positive return integer', () => {
  renderPage(); sample('case'); predict(); advanceUntil(() => activeLine(14))
  expect(screen.getByLabelText('左側位元組值')).toHaveTextContent('97')
  expect(screen.getByLabelText('右側位元組值')).toHaveTextContent('66')
  expect(screen.getByLabelText('手寫比較結果')).toHaveTextContent('1')
  expect(screen.getByLabelText('strcmp 結果符號')).toHaveTextContent('library 為正值；非零數值不固定。')
  expect(screen.getByLabelText('strcmp 結果符號')).not.toHaveTextContent('1')
})
it('completes keyboard challenges and restores saved sample and direction', () => {
  const view = renderPage()
  sample('prefix'); fireEvent.click(screen.getByRole('checkbox', { name: '交換左右字串' }))
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /找到第一個不同位置/ }), { key: 'ArrowRight' }); solve('-1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /前綴如何比較/ }), { key: 'End' }); solve('2')
  expect(screen.getByText('你已完成字串比較與 strcmp。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 27, totalChallenges: 81, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '比較範例' })).toHaveValue('prefix')
  expect(screen.getByRole('checkbox', { name: '交換左右字串' })).toBeChecked()
})
it('synchronizes another tab, clears without recreating progress and permits an explicit restart', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-string-comparison', lessons: {
    'arrays-string-comparison': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: 'empty', reversed: true } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '比較範例' })).toHaveValue('empty')
  expect(screen.getByRole('checkbox', { name: '交換左右字串' })).toBeChecked()
  finish()
  expect(outputs()).toEqual(['manual=1', 'strcmp: positive'])
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('arrays-string-comparison')
  expect(loadProgress().lessons['arrays-string-comparison']?.guidedRunCompleted).toBe(true)
})
it('recovers a malformed comparison state independently from an existing array-parameter lesson', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['predict-array-return'], savedState: { sample: 'zeros', count: 0, mode: 'modify' } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-string-comparison', lessons: {
    'arrays-string-comparison': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { sample: { toString: null }, reversed: false } }, 'pointers-array-parameters': previous,
  } }))
  expect(loadProgress().lessons['pointers-array-parameters']).toEqual(previous)
  expect(loadProgress().lessons['arrays-string-comparison']).toMatchObject({ guidedRunCompleted: false, savedState: { sample: 'different', reversed: false } })
  expect(isStringComparisonSavedState({ sample: 'equal', reversed: true })).toBe(true)
  for (const value of [null, [], { sample: 'different', reversed: 'false' }, { sample: 'constructor', reversed: true }]) expect(isStringComparisonSavedState(value)).toBe(false)
})
it('opens its lazy hash route with the lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/arrays/string-comparison'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /從第一格比起/ })).toBeInTheDocument()
  expect(document.title).toContain('字串比較與 strcmp')
  vi.restoreAllMocks()
})
