import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isStructurePointerSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { StructurePointerLessonPage } from './StructurePointerLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><StructurePointerLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '結構指標執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 30; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected structure-pointer phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
const phase = (value: string) => document.querySelector(`.structure-execution[data-phase="${value}"]`) !== null
const activeLine = (line: number) => document.querySelector(`.source-code-panel__line.is-active[data-line="${line}"]`) !== null
function predict(value = '95 70') { fireEvent.change(screen.getByRole('textbox', { name: '預測 first、second 的分數' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const slide = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } })
const outputs = () => within(screen.getByRole('list', { name: '結構指標輸出' })).queryAllByRole('listitem').map(item => item.textContent)
beforeEach(() => window.localStorage.clear())

it('copies the pointer address without copying an object and updates the actual pointees', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.getByLabelText('first.score')).toHaveTextContent('—')
  predict('95'); expect(screen.getByRole('alert')).toHaveTextContent('兩個非負整數')
  predict(); advanceUntil(() => phase('initialize-first'))
  expect(screen.getByLabelText('first.score')).toHaveTextContent('80')
  expect(screen.getByLabelText('second.score')).toHaveTextContent('—')
  expect(screen.getByLabelText('p 指向')).toHaveTextContent('尚未建立')
  advanceUntil(() => phase('copy-pointer'))
  expect(screen.getByLabelText('p 指向')).toHaveTextContent('→ &first')
  expect(screen.getByLabelText('q 指向')).toHaveTextContent('→ &first')
  expect(screen.getByLabelText('兩個指標的關係')).toHaveTextContent('同一份 first')
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('first.score')).toHaveTextContent('95')
  expect(screen.getByLabelText('first.id')).toHaveTextContent('7')
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('p 指向')).toHaveTextContent('→ &second')
  expect(screen.getByLabelText('q 指向')).toHaveTextContent('→ &first')
  expect(screen.getByLabelText('first.score')).toHaveTextContent('95')
  expect(screen.getByLabelText('second.score')).toHaveTextContent('60')
  advanceUntil(() => phase('write-via-p'))
  expect(screen.getByLabelText('second.score')).toHaveTextContent('70')
  expect(outputs()).toEqual([])
  expect(screen.queryByText(/實際 95、70/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測 95、70，實際 95、70。預測正確！')).toBeInTheDocument()
  finish()
  expect(outputs()).toEqual(['first=95, second=70'])
  expect(screen.getByLabelText('first.score')).toHaveTextContent('—')
  expect(screen.getByLabelText('p 指向')).toHaveTextContent('—')
  expect(loadProgress().lessons['structures-pointers']?.guidedRunCompleted).toBe(true)
})
it('shows the parenthesized dereference form with the same result', () => {
  renderPage(); choose('成員存取寫法', 'dereference'); predict(); advanceUntil(() => phase('write-via-q'))
  expect(screen.getByLabelText('C 程式碼，目前執行第 13 行')).toHaveTextContent('(*q).score = 95;')
  expect(screen.getByLabelText('C 程式碼，目前執行第 13 行')).toHaveTextContent('(*p).score = 70;')
  finish(); expect(outputs()).toEqual(['first=95, second=70'])
})
it('skips member access for NULL while q keeps the original address', () => {
  renderPage(); choose('p 的新指向', 'null')
  expect(screen.getByRole('slider', { name: '透過 p 寫入的分數' })).toBeDisabled()
  predict('95 60'); advanceUntil(() => phase('check-pointer'))
  expect(screen.getByLabelText('p 指向')).toHaveTextContent('NULL')
  expect(screen.getByLabelText('q 指向')).toHaveTextContent('→ &first')
  expect(screen.getByLabelText('空指標判斷')).toHaveTextContent('不成立，略過修改')
  expect(activeLine(15)).toBe(true)
  fireEvent.click(nextButton())
  expect(phase('print')).toBe(true); expect(activeLine(18)).toBe(true)
  expect(outputs()).toEqual(['first=95, second=60'])
  finish()
  expect(loadProgress().lessons['structures-pointers']?.guidedRunCompleted).toBe(true)
})
it('overwrites the original score when both writes still refer to the same object', () => {
  renderPage(); choose('p 的新指向', 'first'); predict('70 60'); advanceUntil(() => phase('write-via-q'))
  expect(screen.getByLabelText('first.score')).toHaveTextContent('95')
  advanceUntil(() => phase('write-via-p'))
  expect(screen.getByLabelText('first.score')).toHaveTextContent('70')
  expect(screen.getByLabelText('second.score')).toHaveTextContent('60')
  expect(screen.getByLabelText('兩個指標的關係')).toHaveTextContent('同一份 first')
  finish(); expect(outputs()).toEqual(['first=70, second=60'])
})
it('supports the other initial object, edge scores and an incorrect prediction', () => {
  renderPage(); choose('p 的初始指向', 'second'); choose('p 的新指向', 'first')
  slide('透過 q 寫入的分數', 0); slide('透過 p 寫入的分數', 100)
  predict('0 100'); finish()
  expect(outputs()).toEqual(['first=100, second=0'])
  expect(screen.getByText(/你預測 0、100，實際 100、0/)).toHaveTextContent('沿著 p、q 保存的位址')
  fireEvent.click(screen.getByRole('button', { name: '恢復預設值' }))
  expect(screen.getByRole('combobox', { name: 'p 的初始指向' })).toHaveValue('first')
  expect(screen.getByRole('slider', { name: '透過 q 寫入的分數' })).toHaveValue('95')
  expect(outputs()).toEqual([])
})
it('pauses playback and cancels its timer when a setting changes', () => {
  vi.useFakeTimers()
  try {
    const view = renderPage(); predict()
    fireEvent.click(screen.getByRole('button', { name: '結構指標執行：2 倍速' }))
    fireEvent.click(screen.getByRole('button', { name: '結構指標執行：開始播放' }))
    act(() => vi.advanceTimersByTime(379)); expect(phase('prepare')).toBe(true)
    act(() => vi.advanceTimersByTime(1)); expect(phase('enter-main')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '結構指標執行：暫停播放' }))
    act(() => vi.advanceTimersByTime(2000)); expect(phase('enter-main')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '結構指標執行：開始播放' }))
    choose('成員存取寫法', 'dereference')
    act(() => vi.advanceTimersByTime(10000))
    expect(phase('prepare')).toBe(true)
    expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
    expect(loadProgress().lessons['structures-pointers']?.guidedRunCompleted).toBe(false)
    view.unmount()
  } finally { vi.useRealTimers() }
})
it('completes the three keyboard challenges independently and restores all saved controls', () => {
  const view = renderPage()
  choose('成員存取寫法', 'dereference'); choose('p 的初始指向', 'second'); choose('p 的新指向', 'null')
  slide('透過 q 寫入的分數', 100)
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('2'); expect(loadProgress().lessons['structures-pointers']?.completedChallengeIds).toEqual([])
  solve('1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /選出箭頭的等價寫法/ }), { key: 'ArrowRight' }); solve('95 70')
  fireEvent.keyDown(screen.getByRole('tab', { name: /複製位址，再改指向/ }), { key: 'End' }); solve('1 0')
  expect(screen.getByText('你已完成指向結構的指標。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 34, totalChallenges: 102, completedChallenges: 3 })
  expect(loadProgress().lessons['structures-pointers']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '成員存取寫法' })).toHaveValue('dereference')
  expect(screen.getByRole('combobox', { name: 'p 的初始指向' })).toHaveValue('second')
  expect(screen.getByRole('combobox', { name: 'p 的新指向' })).toHaveValue('null')
  expect(screen.getByRole('slider', { name: '透過 q 寫入的分數' })).toHaveValue('100')
  expect(screen.getByRole('slider', { name: '透過 p 寫入的分數' })).toHaveValue('70')
})
it('synchronizes cross-tab state and clearing, then allows an explicit restart', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'structures-pointers', lessons: {
    'structures-pointers': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { syntax: 'dereference', initialTarget: 'second', target: 'null', aliasScore: 0, pointedScore: 100 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: 'p 的新指向' })).toHaveValue('null')
  finish(); expect(outputs()).toEqual(['first=80, second=0'])
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  expect(screen.getByRole('combobox', { name: '成員存取寫法' })).toHaveValue('arrow')
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('structures-pointers')
  expect(loadProgress().lessons['structures-pointers']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed pointer settings while preserving an earlier structure-array lesson', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['check-structure-array-bound'], savedState: { roster: 'equal', index: 2, score: 0, threshold: 60 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'structures-pointers', lessons: {
    'structures-arrays': previous,
    'structures-pointers': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { syntax: { toString: null }, initialTarget: 'first', target: 'null', aliasScore: 95, pointedScore: 70 } },
  } }))
  expect(loadProgress().lessons['structures-arrays']).toEqual(previous)
  expect(loadProgress().lessons['structures-pointers']).toMatchObject({ guidedRunCompleted: false, savedState: { syntax: 'arrow', initialTarget: 'first', target: 'second', aliasScore: 95, pointedScore: 70 } })
  expect(isStructurePointerSavedState({ syntax: 'dereference', initialTarget: 'second', target: 'null', aliasScore: 0, pointedScore: 100 })).toBe(true)
  for (const value of [null, [], { syntax: 'constructor', initialTarget: 'first', target: 'null', aliasScore: 95, pointedScore: 70 }, { syntax: 'arrow', initialTarget: 'null', target: 'first', aliasScore: 95, pointedScore: 70 }, { syntax: 'arrow', initialTarget: 'first', target: null, aliasScore: 95, pointedScore: 70 }]) expect(isStructurePointerSavedState(value)).toBe(false)
})
it('opens the lazy hash route with its lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/structures/pointers'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /沿著指標/ })).toBeInTheDocument()
  expect(document.title).toContain('指向結構的指標')
  vi.restoreAllMocks()
})
