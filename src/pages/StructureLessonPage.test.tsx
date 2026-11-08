import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isStructureSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { StructureLessonPage } from './StructureLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><StructureLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '結構成員執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 30; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected structure phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
function predict(value = '80 95') { fireEvent.change(screen.getByRole('textbox', { name: '預測原物件、副本的成員值' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const activeLine = (line: number) => document.querySelector(`.source-code-panel__line.is-active[data-line="${line}"]`) !== null
const outputs = () => within(screen.getByRole('list', { name: '結構成員輸出' })).queryAllByRole('listitem').map(item => item.textContent)
beforeEach(() => window.localStorage.clear())

it('initializes and copies members before editing only the selected object', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.getByLabelText('student.score')).toHaveTextContent('—')
  predict('80')
  expect(screen.getByRole('alert')).toHaveTextContent('兩個整數值')
  predict(); advanceUntil(() => activeLine(11))
  expect(screen.getByLabelText('student.id')).toHaveTextContent('7')
  expect(screen.getByLabelText('student.score')).toHaveTextContent('80')
  expect(screen.getByLabelText('backup.score')).toHaveTextContent('80')
  expect(screen.getByLabelText('student.grade')).toHaveTextContent("'B'")
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('student.score')).toHaveTextContent('80')
  expect(screen.getByLabelText('backup.score')).toHaveTextContent('95')
  fireEvent.click(nextButton())
  expect(outputs()).toHaveLength(1)
  expect(screen.queryByText(/實際 80、95/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測 80、95，實際 80、95。預測正確！')).toBeInTheDocument()
  finish()
  expect(outputs()).toEqual(['student: id=7, score=80, grade_code=66', 'backup: id=7, score=95, grade_code=66'])
  expect(screen.getByLabelText('student.score')).toHaveTextContent('—')
  expect(loadProgress().lessons['structures-basics']?.guidedRunCompleted).toBe(true)
})
it('keeps the backup unchanged when editing the original object after the copy', () => {
  renderPage(); choose('要修改的物件', 'student'); predict('95 80'); finish()
  expect(outputs()).toEqual(['student: id=7, score=95, grade_code=66', 'backup: id=7, score=80, grade_code=66'])
})
it('shows omitted partial-initializer members as actual zero values and NUL', () => {
  renderPage(); choose('初始化方式', 'partial'); predict('0 95'); advanceUntil(() => activeLine(10))
  expect(screen.getByLabelText('student.score')).toHaveTextContent('0')
  expect(screen.getByLabelText('student.grade')).toHaveTextContent("'\\0'")
  expect(screen.getByLabelText('backup.score')).toHaveTextContent('—')
  advanceUntil(() => activeLine(11))
  expect(screen.getByLabelText('backup.grade')).toHaveTextContent("'\\0'")
  finish()
  expect(outputs()).toEqual(['student: id=7, score=0, grade_code=0', 'backup: id=7, score=95, grade_code=0'])
})
it('updates a char member without changing either numeric member or the other copy', () => {
  renderPage(); choose('初始化方式', 'partial'); choose('要修改的物件', 'student'); choose('要修改的成員', 'grade')
  predict('65 0'); advanceUntil(() => activeLine(12))
  expect(screen.getByLabelText('student.grade')).toHaveTextContent("'A'")
  expect(screen.getByLabelText('backup.grade')).toHaveTextContent("'\\0'")
  expect(screen.getByLabelText('student.id')).toHaveTextContent('7')
  expect(screen.getByLabelText('student.score')).toHaveTextContent('0')
  finish()
  expect(outputs()).toEqual(['student: id=7, score=0, grade_code=65', 'backup: id=7, score=0, grade_code=0'])
})
it('updates only id and resets both objects when changing the selected member', () => {
  renderPage(); choose('要修改的成員', 'id'); predict('7 42'); finish()
  expect(outputs()).toEqual(['student: id=7, score=80, grade_code=66', 'backup: id=42, score=80, grade_code=66'])
  choose('要修改的成員', 'score')
  expect(outputs()).toEqual([])
  expect(screen.getByLabelText('backup.id')).toHaveTextContent('—')
  expect(screen.queryByText(/實際 7、42/)).not.toBeInTheDocument()
  predict(); finish()
  expect(outputs()[1]).toBe('backup: id=7, score=95, grade_code=66')
})
it('maps designated initializers to member names even when their written order differs', () => {
  renderPage(); choose('初始化方式', 'designated'); choose('要修改的物件', 'student')
  predict('95 80'); advanceUntil(() => activeLine(10))
  expect(screen.getByLabelText('C 程式碼，目前執行第 10 行')).toHaveTextContent("{.score = 80, .grade = 'B', .id = 7}")
  expect(screen.getByLabelText('student.id')).toHaveTextContent('7')
  expect(screen.getByLabelText('student.score')).toHaveTextContent('80')
  expect(screen.getByLabelText('student.grade')).toHaveTextContent("'B'")
  finish()
  expect(outputs()).toEqual(['student: id=7, score=95, grade_code=66', 'backup: id=7, score=80, grade_code=66'])
})
it('completes keyboard challenges and restores all saved controls', () => {
  const view = renderPage()
  choose('初始化方式', 'partial'); choose('要修改的物件', 'student'); choose('要修改的成員', 'grade')
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /選對成員存取方式/ }), { key: 'ArrowRight' }); solve('80 95')
  fireEvent.keyDown(screen.getByRole('tab', { name: /副本修改不影響原物件/ }), { key: 'End' }); solve('0 0')
  expect(screen.getByText('你已完成結構與成員存取。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 26, totalChallenges: 78, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '初始化方式' })).toHaveValue('partial')
  expect(screen.getByRole('combobox', { name: '要修改的物件' })).toHaveValue('student')
  expect(screen.getByRole('combobox', { name: '要修改的成員' })).toHaveValue('grade')
})
it('synchronizes another tab and clears without recreating progress until an explicit restart', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'structures-basics', lessons: {
    'structures-basics': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { initialization: 'designated', target: 'backup', field: 'id' } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '初始化方式' })).toHaveValue('designated')
  expect(screen.getByRole('combobox', { name: '要修改的成員' })).toHaveValue('id')
  finish()
  expect(outputs()[1]).toBe('backup: id=42, score=80, grade_code=66')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('structures-basics')
  expect(loadProgress().lessons['structures-basics']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed structure state while preserving a prior pointer lesson', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['choose-pointee-const'], savedState: { kind: 'both-const', operation: 'direct-write', target: 'x' } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'structures-basics', lessons: {
    'structures-basics': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { initialization: { toString: null }, target: 'backup', field: 'score' } }, 'pointers-const': previous,
  } }))
  expect(loadProgress().lessons['pointers-const']).toEqual(previous)
  expect(loadProgress().lessons['structures-basics']).toMatchObject({ guidedRunCompleted: false, savedState: { initialization: 'full', target: 'backup', field: 'score' } })
  expect(isStructureSavedState({ initialization: 'partial', target: 'student', field: 'grade' })).toBe(true)
  for (const value of [null, [], { initialization: 'constructor', target: 'student', field: 'score' }, { initialization: 'full', target: 'other', field: 'score' }, { initialization: 'full', target: 'student', field: '__proto__' }]) expect(isStructureSavedState(value)).toBe(false)
})
it('opens its lazy hash route with the chapter seven lesson title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/structures/basics'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /把相關資料/ })).toBeInTheDocument()
  expect(document.title).toContain('結構與成員存取')
  vi.restoreAllMocks()
})
