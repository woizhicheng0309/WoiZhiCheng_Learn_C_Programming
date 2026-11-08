import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, HashRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY, loadProgress, getCourseProgress, isMatrixSavedState } from '../state'
import { MatrixLessonPage } from './MatrixLessonPage'
import App from '../App'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><MatrixLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const number = (label: string, value: number) => fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: String(value) } })
const next = () => fireEvent.click(screen.getByRole('button', { name: '二維陣列執行：執行下一步' }))
function finish() {
  const button = screen.getByRole<HTMLButtonElement>('button', { name: '二維陣列執行：執行下一步' })
  for (let i = 0; i < 150; i++) {
    if (button.disabled) return
    fireEvent.click(button)
  }
  throw new Error('Trace did not finish')
}
function predict(value = 6) { number('預測指定元素的值', value); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const outputs = () => within(screen.getByRole('list', { name: '二維走訪輸出' })).queryAllByRole('listitem').map(item => Number(item.textContent))
beforeEach(() => window.localStorage.clear())

it('requires prediction, reveals the selected cell only at its read and traverses in row order', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict(); next()
  expect(screen.queryByText(/實際讀到/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('grid[1][2]，6')).toHaveTextContent('6')
  next()
  expect(screen.getByText(/實際讀到 6。預測正確/)).toBeInTheDocument()
  expect(screen.getByLabelText('grid[1][2]，6')).toHaveClass('is-active')
  finish()
  expect(outputs()).toEqual([1, 2, 3, 4, 5, 6])
  expect(screen.getByText('sum = 21')).toBeInTheDocument()
  expect(screen.getByLabelText('row，不在作用域')).toHaveTextContent('—')
  expect(screen.getByLabelText('col，不在作用域')).toHaveTextContent('—')
  expect(within(screen.getByRole('list', { name: 'grid 的六個元素' })).getAllByRole('listitem').every(item => item.textContent?.includes('—'))).toBe(true)
  expect(loadProgress().lessons['arrays-matrices']?.guidedRunCompleted).toBe(true)
})
it('reads in column order while preserving row-major storage and resets after mode changes', () => {
  renderPage()
  fireEvent.click(screen.getByRole('radio', { name: /逐欄/ }))
  predict(); next()
  const storage = screen.getByRole('region', { name: /逐列記憶體示意/ })
  expect(within(storage).getAllByRole('listitem').map(item => item.querySelector('strong')?.textContent)).toEqual(['1', '2', '3', '4', '5', '6'])
  finish()
  expect(outputs()).toEqual([1, 4, 2, 5, 3, 6])
  expect(screen.getByText('已讀取的偏移：0 → 3 → 1 → 4 → 2 → 5')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /逐列：/ }))
  expect(outputs()).toEqual([])
  expect(screen.getByLabelText('C 程式碼，目前執行第 3 行')).toBeInTheDocument()
})
it('blocks a column beyond its subarray even when the next row exists and does not save it', () => {
  renderPage()
  number('指定列索引', 0); number('指定欄索引', 3)
  finish()
  expect(screen.getByRole('alert')).toHaveTextContent('grid[0][3]')
  expect(screen.getByLabelText('C 程式碼，目前執行第 5 行')).toBeInTheDocument()
  expect(outputs()).toEqual([])
  expect(loadProgress().lessons['arrays-matrices']).toMatchObject({ guidedRunCompleted: false, savedState: { targetRow: 0, targetColumn: 2 } })
})
it('keeps invalid input local when a challenge updates progress', () => {
  renderPage()
  number('指定列索引', 2)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  expect(screen.getByRole('spinbutton', { name: '指定列索引' })).toHaveValue(2)
  expect(loadProgress().lessons['arrays-matrices']?.savedState?.targetRow).toBe(1)
})
it('synchronizes another tab and clears progress at the final frame without rewriting it', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-matrices', lessons: {
    'arrays-matrices': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { mode: 'column-first', targetRow: 0, targetColumn: 1 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('spinbutton', { name: '指定列索引' })).toHaveValue(0)
  expect(screen.getByRole('radio', { name: /逐欄/ })).toBeChecked()
  finish()
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
it('completes and restores three challenges and rejects damaged saved configuration', () => {
  const view = renderPage()
  const solve = (answer: string) => { fireEvent.change(screen.getByRole('textbox'), { target: { value: answer } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('6')
  fireEvent.click(screen.getByRole('tab', { name: /預測逐欄輸出/ })); solve('1 4 2 5 3 6')
  fireEvent.click(screen.getByRole('tab', { name: /計算元素偏移/ })); solve('4')
  expect(screen.getByText('你已完成二維陣列與巢狀走訪。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 23, totalChallenges: 69, completedChallenges: 3 })
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(isMatrixSavedState({ mode: 'row-first', targetRow: 1, targetColumn: 2 })).toBe(true)
  for (const targetColumn of [NaN, Infinity, 3, -1, 0.5, '2']) expect(isMatrixSavedState({ mode: 'row-first', targetRow: 1, targetColumn })).toBe(false)
})
it('recovers a damaged lesson independently from older progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: [], savedState: { n: 4 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'arrays-matrices', lessons: {
    'arrays-matrices': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { mode: 'bad', targetRow: 0, targetColumn: 0 } }, 'functions-recursion': previous,
  } }))
  expect(loadProgress().lessons['functions-recursion']).toEqual(previous)
  expect(loadProgress().lessons['arrays-matrices']).toMatchObject({ guidedRunCompleted: false, savedState: { mode: 'row-first', targetRow: 1, targetColumn: 2 } })
})
it('opens the lesson route with its own document title', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/arrays/matrices'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /同一張表格/ })).toBeInTheDocument()
  expect(document.title).toContain('二維陣列與巢狀走訪')
  vi.restoreAllMocks()
})
