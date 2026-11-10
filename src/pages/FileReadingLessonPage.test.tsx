import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isFileReadingSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { FileReadingLessonPage } from './FileReadingLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><FileReadingLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '文字檔讀取執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 80; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected file-reading phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
const phase = (value: string) => document.querySelector(`.allocation-execution[data-phase="${value}"]`) !== null
const activePart = (value: string) => document.querySelector(`.source-code-panel__part.is-active[data-part="${value}"]`) !== null
function predict(value = '2 0') { fireEvent.change(screen.getByRole('textbox', { name: '預測成功讀取次數、main 回傳值' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const resize = (value: number) => fireEvent.change(screen.getByRole('slider', { name: 'buffer 大小' }), { target: { value: String(value) } })
const stdout = () => screen.getByLabelText('文字檔讀取輸出').textContent
beforeEach(() => window.localStorage.clear())

it('guards processing with fgets results and preserves newline and the null terminator', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('2'); expect(screen.getByRole('alert')).toHaveTextContent('兩個非負整數')
  predict(); advanceUntil(() => phase('declare-buffer'))
  expect(screen.getByLabelText('buffer[0]')).toHaveTextContent('未初始化')
  expect(screen.getByLabelText('目前 reads')).toHaveTextContent('—')
  fireEvent.click(nextButton()); fireEvent.click(nextButton())
  expect(phase('read-attempt')).toBe(true); expect(activePart('fgets-call')).toBe(true)
  expect(screen.getByLabelText('buffer[0]')).toHaveTextContent("'H'")
  expect(screen.getByLabelText('buffer[2]')).toHaveTextContent("'\\n'")
  expect(screen.getByLabelText('buffer[3]')).toHaveTextContent("'\\0'")
  expect(screen.getByLabelText('最近一次 fgets 回傳')).toHaveTextContent('→ buffer')
  fireEvent.click(nextButton()); expect(activePart('fgets-check')).toBe(true)
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('fgets(...) != NULL → 成立')
  advanceUntil(() => phase('print-summary'))
  expect(stdout()).toBe('[1] Hi\n[2] C\n\nreads=2\n')
  expect(screen.queryByText(/實際 2、0/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測 2、0，實際 2、0。預測正確！')).toBeInTheDocument()
  finish()
  expect(screen.getByLabelText('指標 fp')).toHaveTextContent('—')
  expect(screen.getByLabelText('buffer[0]')).toHaveTextContent('—')
  expect(loadProgress().lessons['files-reading']?.guidedRunCompleted).toBe(true)
})
it('splits a long line and keeps old buffer data on the final NULL without processing it again', () => {
  renderPage(); choose('文字資料', 'long'); resize(4); predict('4 0')
  const result = screen.getByLabelText('最近一次 fgets 回傳')
  advanceUntil(() => phase('read-attempt') && result.textContent?.includes('NULL') === true)
  expect(screen.getByLabelText('目前 reads')).toHaveTextContent('4')
  expect(screen.getByLabelText('buffer[0]')).toHaveTextContent("'X'")
  expect(screen.getByLabelText('buffer[1]')).toHaveTextContent("'\\0'")
  expect(screen.getByLabelText('buffer[2]')).toHaveTextContent("'F'")
  expect(screen.getByLabelText('buffer[2]').closest('li')).toHaveClass('is-tail')
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('1')
  finish(); expect(stdout()).toBe('[1] ABC[2] DEF[3] \n[4] X\nreads=4\n')
})
it('can show EOF already set on a successful final partial string', () => {
  renderPage(); choose('文字資料', 'long'); resize(8); predict()
  const eof = screen.getByLabelText('EOF 指標（布林）')
  advanceUntil(() => phase('read-attempt') && eof.textContent === '1')
  expect(screen.getByLabelText('最近一次 fgets 回傳')).toHaveTextContent('→ buffer')
  expect(screen.getByLabelText('目前 buffer 字串')).toHaveTextContent('"X"')
  expect(screen.getByLabelText('目前 reads')).toHaveTextContent('1')
  finish(); expect(stdout()).toBe('[1] ABCDEF\n[2] X\nreads=2\n')
})
it('handles an empty file without inventing a string or executing the loop body', () => {
  renderPage(); choose('文字資料', 'empty'); predict('0 0'); advanceUntil(() => phase('read-attempt'))
  expect(screen.getByLabelText('最近一次 fgets 回傳')).toHaveTextContent('NULL')
  expect(screen.getByLabelText('buffer[0]')).toHaveTextContent('未初始化')
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('1')
  fireEvent.click(nextButton()); fireEvent.click(nextButton())
  expect(phase('capture-read-error')).toBe(true)
  finish(); expect(stdout()).toBe('\nreads=0\n')
  expect(screen.getByText('你預測 0、0，實際 0、0。預測正確！')).toBeInTheDocument()
})
it('returns on open failure without declaring the buffer or closing a null pointer', () => {
  renderPage(); choose('I/O 情境', 'open-failure'); predict('0 1'); advanceUntil(() => phase('return-open-failure'))
  expect(screen.getByLabelText('指標 fp')).toHaveTextContent('NULL')
  expect(screen.queryByLabelText('buffer[0]')).not.toBeInTheDocument()
  expect(screen.getByLabelText('目前 reads')).toHaveTextContent('—')
  expect(screen.getByLabelText('目前 close_failed')).toHaveTextContent('—')
  finish(); expect(stdout()).toBe('open failed\n')
  expect(screen.getByLabelText('main 回傳值')).toHaveTextContent('1')
})
it('marks read-error contents indeterminate and saves the error before closing', () => {
  renderPage(); choose('I/O 情境', 'read-failure'); predict('0 2'); advanceUntil(() => phase('read-attempt'))
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('0')
  expect(screen.getByLabelText('錯誤指標（布林）')).toHaveTextContent('1')
  expect(screen.getByLabelText('buffer[0]')).toHaveTextContent('內容不確定')
  expect(screen.getByLabelText('最近一次 fgets 回傳')).toHaveTextContent('NULL')
  advanceUntil(() => phase('capture-read-error'))
  expect(screen.getByLabelText('目前 read_failed')).toHaveTextContent('1')
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('串流狀態')).toHaveTextContent('已成功關閉')
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('—')
  expect(screen.getByLabelText('錯誤指標（布林）')).toHaveTextContent('—')
  expect(screen.getByLabelText('目前 read_failed')).toHaveTextContent('1')
  finish(); expect(stdout()).toBe('\nI/O failed\n')
})
it('does not reuse a disassociated stream when fclose reports an error', () => {
  renderPage(); choose('I/O 情境', 'close-failure'); predict('2 2'); advanceUntil(() => phase('close'))
  expect(screen.getByLabelText('串流狀態')).toHaveTextContent('解除關聯，關閉回報錯誤')
  expect(screen.getByLabelText('指標 fp')).toHaveTextContent('不可再使用')
  expect(screen.getByLabelText('目前 read_failed')).toHaveTextContent('0')
  expect(screen.getByLabelText('目前 close_failed')).toHaveTextContent('1')
  finish(); expect(stdout()).toBe('[1] Hi\n[2] C\n\nI/O failed\n')
})
it('supports the minimum buffer and blank lines, then resets a changed scenario', () => {
  renderPage(); choose('文字資料', 'blank'); resize(2); predict('3 0'); finish()
  expect(stdout()).toBe('[1] A[2] \n[3] \n[4] B\nreads=4\n')
  expect(screen.getByText(/你預測 3、0，實際 4、0/)).toHaveTextContent('先確認每次 fgets')
  fireEvent.click(screen.getByRole('button', { name: '恢復預設值' }))
  expect(phase('prepare')).toBe(true)
  expect(screen.getByRole('combobox', { name: '文字資料' })).toHaveValue('short')
  expect(screen.getByRole('slider', { name: 'buffer 大小' })).toHaveValue('6')
  expect(screen.getByRole('textbox', { name: '預測成功讀取次數、main 回傳值' })).toHaveValue('')
})
it('cancels playback when a setting changes without marking a run complete', () => {
  vi.useFakeTimers()
  try {
    const view = renderPage(); predict()
    fireEvent.click(screen.getByRole('button', { name: '文字檔讀取執行：開始播放' }))
    act(() => vi.advanceTimersByTime(760)); expect(phase('enter-main')).toBe(true)
    choose('I/O 情境', 'read-failure')
    act(() => vi.advanceTimersByTime(10000))
    expect(phase('prepare')).toBe(true)
    expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
    expect(loadProgress().lessons['files-reading']?.guidedRunCompleted).toBe(false)
    view.unmount()
  } finally { vi.useRealTimers() }
})
it('completes independent keyboard challenges and restores all saved controls', () => {
  const view = renderPage()
  choose('文字資料', 'long'); choose('I/O 情境', 'close-failure'); resize(2)
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('1'); expect(loadProgress().lessons['files-reading']?.completedChallengeIds).toEqual([])
  solve('2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /用讀取結果決定是否處理/ }), { key: 'ArrowRight' }); solve('4')
  fireEvent.keyDown(screen.getByRole('tab', { name: /讀取次數不一定等於行數/ }), { key: 'End' }); solve('0 1')
  expect(screen.getByText('你已完成檔案開啟與 fgets 讀取。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 35, totalChallenges: 105, completedChallenges: 3 })
  expect(loadProgress().lessons['files-reading']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '文字資料' })).toHaveValue('long')
  expect(screen.getByRole('combobox', { name: 'I/O 情境' })).toHaveValue('close-failure')
  expect(screen.getByRole('slider', { name: 'buffer 大小' })).toHaveValue('2')
})
it('synchronizes cross-tab state and clearing without recreating progress until a restart', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-reading', lessons: {
    'files-reading': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: 'empty', outcome: 'read-failure', bufferSize: 8 } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '文字資料' })).toHaveValue('empty')
  finish(); expect(stdout()).toBe('\nI/O failed\n')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('files-reading')
  expect(loadProgress().lessons['files-reading']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed input settings while retaining prior reallocation progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['predict-realloc-growth'], savedState: { dataset: 'descending', outcome: 'in-place', requested: 1, fill: 9 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-reading', lessons: {
    'memory-reallocation': previous,
    'files-reading': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: { toString: null }, outcome: 'success', bufferSize: 6 } },
  } }))
  expect(loadProgress().lessons['memory-reallocation']).toEqual(previous)
  expect(loadProgress().lessons['files-reading']).toMatchObject({ guidedRunCompleted: false, savedState: { dataset: 'short', outcome: 'success', bufferSize: 6 } })
  expect(isFileReadingSavedState({ dataset: 'long', outcome: 'read-failure', bufferSize: 2 })).toBe(true)
  for (const value of [null, [], { dataset: 'constructor', outcome: 'success', bufferSize: 6 }, { dataset: 'empty', outcome: 'success', bufferSize: 1 }, { dataset: 'short', outcome: { toString: null }, bufferSize: 6 }]) expect(isFileReadingSavedState(value)).toBe(false)
})
it('opens its lazy hash route with a primary C11 reference', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/files/reading'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先確認讀到了什麼/ })).toBeInTheDocument()
  expect(document.title).toContain('檔案開啟與 fgets 讀取')
  expect(screen.getByRole('link', { name: /C11 工作草案 N1570/ })).toHaveAttribute('href', 'https://www.sigbus.info/n1570#7.21.7.2')
  vi.restoreAllMocks()
})
