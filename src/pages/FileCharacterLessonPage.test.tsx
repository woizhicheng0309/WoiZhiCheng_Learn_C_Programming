import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isFileCharacterSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { FileCharacterLessonPage } from './FileCharacterLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><FileCharacterLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '逐字讀取執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 80; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected character-input phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
const phase = (value: string) => document.querySelector(`.allocation-execution[data-phase="${value}"]`) !== null
const activePart = (value: string) => document.querySelector(`.source-code-panel__part.is-active[data-part="${value}"]`) !== null
function predict(value = '5 2') { fireEvent.change(screen.getByRole('textbox', { name: '預測處理資料量、數字字元數' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const stdout = () => screen.getByLabelText('逐字讀取輸出').textContent
beforeEach(() => window.localStorage.clear())

it('stores data in int, compares EOF before processing and reveals feedback only on return', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('5'); expect(screen.getByRole('alert')).toHaveTextContent('兩個非負整數')
  predict(); advanceUntil(() => phase('declare-ch'))
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('未初始化')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('—')
  advanceUntil(() => phase('read-attempt'))
  expect(activePart('fgetc-call')).toBe(true)
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('65')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('0')
  fireEvent.click(nextButton()); expect(activePart('eof-check')).toBe(true)
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('ch != EOF → 成立')
  const ch = screen.getByLabelText('目前 ch（int）')
  advanceUntil(() => phase('read-attempt') && ch.textContent === 'EOF')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('5')
  expect(screen.getByLabelText('目前 digits')).toHaveTextContent('2')
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('1')
  advanceUntil(() => phase('print-summary'))
  expect(stdout()).toBe('code=65\ncode=48\ncode=10\ncode=66\ncode=57\ncount=5, digits=2\n')
  expect(screen.queryByText(/實際 5、2/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測 5、2，實際 5、2。預測正確！')).toBeInTheDocument()
  finish()
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('—')
  expect(loadProgress().lessons['files-characters']?.guidedRunCompleted).toBe(true)
})
it('processes a NUL byte without stopping and distinguishes it from ASCII zero', () => {
  renderPage(); choose('位元組資料', 'nul'); predict('4 1')
  const ch = screen.getByLabelText('目前 ch（int）')
  advanceUntil(() => phase('read-attempt') && ch.textContent === '0')
  expect(screen.getByLabelText('目前資料字元')).toHaveTextContent("'\\0'")
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('0')
  fireEvent.click(nextButton()); expect(screen.getByLabelText('目前判斷')).toHaveTextContent('ch != EOF → 成立')
  advanceUntil(() => phase('check-digit') && ch.textContent === '0')
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('不成立')
  finish(); expect(stdout()).toBe('code=65\ncode=0\ncode=66\ncode=57\ncount=4, digits=1\n')
  choose('位元組資料', 'text'); predict()
  advanceUntil(() => phase('check-digit') && ch.textContent === '48')
  expect(screen.getByLabelText('目前資料字元')).toHaveTextContent("'0'")
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('成立')
})
it('keeps 255 as data and later receives a separate symbolic EOF', () => {
  renderPage(); choose('位元組資料', 'high'); predict('4 2'); advanceUntil(() => phase('read-attempt'))
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('255')
  expect(screen.getByLabelText('目前資料字元')).toHaveTextContent('0xFF')
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('0')
  fireEvent.click(nextButton()); expect(screen.getByLabelText('目前判斷')).toHaveTextContent('成立')
  const ch = screen.getByLabelText('目前 ch（int）')
  advanceUntil(() => phase('read-attempt') && ch.textContent === 'EOF')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('4')
  finish(); expect(stdout()).toBe('code=255\ncode=48\ncode=10\ncode=57\ncount=4, digits=2\n')
})
it('breaks after reading a newline but before counting it, without setting EOF', () => {
  renderPage(); choose('停止方式', 'true'); predict('2 1'); advanceUntil(() => phase('break'))
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('10')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('2')
  expect(screen.getByLabelText('目前 digits')).toHaveTextContent('1')
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('0')
  expect(screen.getByLabelText('模擬讀取進度')).toHaveTextContent('3 / 5')
  const data = within(screen.getByRole('list', { name: '虛擬位元組串流' })).getAllByRole('listitem')
  expect(data[2]).toHaveTextContent('已讀，未計入')
  expect(data[3]).toHaveTextContent('尚未讀取')
  fireEvent.click(nextButton()); expect(phase('capture-read-error')).toBe(true)
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('0')
  finish(); expect(stdout()).toBe('code=65\ncode=48\ncount=2, digits=1\n')
})
it('reads all digits when no newline occurs and handles empty input without a body iteration', () => {
  renderPage(); choose('位元組資料', 'digits'); choose('停止方式', 'true'); predict('3 3'); finish()
  expect(stdout()).toBe('code=48\ncode=49\ncode=57\ncount=3, digits=3\n')
  choose('位元組資料', 'empty'); predict('0 0'); advanceUntil(() => phase('read-attempt'))
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('EOF')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('0')
  fireEvent.click(nextButton()); fireEvent.click(nextButton())
  expect(phase('capture-read-error')).toBe(true)
  finish(); expect(stdout()).toBe('count=0, digits=0\n')
})
it('does not invent counters or close a null stream after open failure', () => {
  renderPage(); choose('I/O 情境', 'open-failure'); predict('0 0'); advanceUntil(() => phase('return-open-failure'))
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('尚未宣告')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('—')
  expect(screen.getByLabelText('目前 digits')).toHaveTextContent('—')
  expect(screen.getByLabelText('目前 close_failed')).toHaveTextContent('—')
  finish(); expect(stdout()).toBe('open failed\n')
  expect(screen.getByLabelText('main 回傳值')).toHaveTextContent('1')
})
it('distinguishes an error EOF return from the end-of-file indicator', () => {
  renderPage(); choose('I/O 情境', 'read-failure'); predict('0 0'); advanceUntil(() => phase('read-attempt'))
  expect(screen.getByLabelText('目前 ch（int）')).toHaveTextContent('EOF')
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('0')
  expect(screen.getByLabelText('錯誤指標（布林）')).toHaveTextContent('1')
  advanceUntil(() => phase('capture-read-error'))
  expect(screen.getByLabelText('目前 read_failed')).toHaveTextContent('1')
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('EOF 指標（布林）')).toHaveTextContent('—')
  expect(screen.getByLabelText('錯誤指標（布林）')).toHaveTextContent('—')
  finish(); expect(stdout()).toBe('I/O failed\n')
  expect(screen.getByLabelText('main 回傳值')).toHaveTextContent('2')
})
it('retains processed data on close failure but never queries the disassociated stream', () => {
  renderPage(); choose('I/O 情境', 'close-failure'); predict(); advanceUntil(() => phase('close'))
  expect(screen.getByLabelText('串流狀態')).toHaveTextContent('解除關聯，關閉回報錯誤')
  expect(screen.getByLabelText('指標 fp')).toHaveTextContent('不可再使用')
  expect(screen.getByLabelText('目前 read_failed')).toHaveTextContent('0')
  expect(screen.getByLabelText('目前 close_failed')).toHaveTextContent('1')
  expect(screen.getByLabelText('目前 count')).toHaveTextContent('5')
  finish(); expect(stdout()).toBe('code=65\ncode=48\ncode=10\ncode=66\ncode=57\nI/O failed\n')
})
it('reports a wrong prediction and restores defaults after a completed run', () => {
  renderPage(); choose('停止方式', 'true'); predict('3 1'); finish()
  expect(screen.getByText(/你預測 3、1，實際 2、1/)).toHaveTextContent('先區分已讀與已處理')
  fireEvent.click(screen.getByRole('button', { name: '恢復預設值' }))
  expect(phase('prepare')).toBe(true)
  expect(screen.getByRole('combobox', { name: '停止方式' })).toHaveValue('false')
  expect(screen.getByRole('textbox', { name: '預測處理資料量、數字字元數' })).toHaveValue('')
  expect(stdout()).toBe('尚無輸出')
})
it('cancels a playing trace on configuration changes without a fake completion', () => {
  vi.useFakeTimers()
  try {
    const view = renderPage(); predict()
    fireEvent.click(screen.getByRole('button', { name: '逐字讀取執行：開始播放' }))
    act(() => vi.advanceTimersByTime(760)); expect(phase('enter-main')).toBe(true)
    choose('停止方式', 'true')
    act(() => vi.advanceTimersByTime(10000))
    expect(phase('prepare')).toBe(true)
    expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
    expect(loadProgress().lessons['files-characters']?.guidedRunCompleted).toBe(false)
    view.unmount()
  } finally { vi.useRealTimers() }
})
it('completes independent keyboard challenges and restores all three saved controls', () => {
  const view = renderPage()
  choose('位元組資料', 'empty'); choose('I/O 情境', 'close-failure'); choose('停止方式', 'true')
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('1'); expect(loadProgress().lessons['files-characters']?.completedChallengeIds).toEqual([])
  solve('2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /先保留完整回傳值/ }), { key: 'ArrowRight' }); solve('4 1')
  fireEvent.keyDown(screen.getByRole('tab', { name: /資料零值也要處理/ }), { key: 'End' }); solve('2 0')
  expect(screen.getByText('你已完成 fgetc 逐字讀取與 EOF。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 32, totalChallenges: 96, completedChallenges: 3 })
  expect(loadProgress().lessons['files-characters']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage()
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
  expect(screen.getByRole('combobox', { name: '位元組資料' })).toHaveValue('empty')
  expect(screen.getByRole('combobox', { name: 'I/O 情境' })).toHaveValue('close-failure')
  expect(screen.getByRole('combobox', { name: '停止方式' })).toHaveValue('true')
})
it('synchronizes cross-tab changes and clearing, then permits an explicit restart', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-characters', lessons: {
    'files-characters': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: 'nul', outcome: 'success', stopAtNewline: true } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '位元組資料' })).toHaveValue('nul')
  finish(); expect(stdout()).toBe('code=65\ncode=0\ncode=66\ncode=57\ncount=4, digits=1\n')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lastVisitedLessonId).toBe('files-characters')
  expect(loadProgress().lessons['files-characters']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed boolean settings while preserving prior fgets progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['predict-fgets-chunks'], savedState: { dataset: 'long', outcome: 'close-failure', bufferSize: 2 } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-characters', lessons: {
    'files-reading': previous,
    'files-characters': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: 'text', outcome: 'success', stopAtNewline: 'false' } },
  } }))
  expect(loadProgress().lessons['files-reading']).toEqual(previous)
  expect(loadProgress().lessons['files-characters']).toMatchObject({ guidedRunCompleted: false, savedState: { dataset: 'text', outcome: 'success', stopAtNewline: false } })
  expect(isFileCharacterSavedState({ dataset: 'high', outcome: 'read-failure', stopAtNewline: true })).toBe(true)
  for (const value of [null, [], { dataset: 'constructor', outcome: 'success', stopAtNewline: false }, { dataset: 'text', outcome: { toString: null }, stopAtNewline: true }, { dataset: 'text', outcome: 'success', stopAtNewline: 0 }]) expect(isFileCharacterSavedState(value)).toBe(false)
})
it('opens the lazy hash route and links to its C11 source', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/files/characters'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /用 int 接住回傳值/ })).toBeInTheDocument()
  expect(document.title).toContain('fgetc 逐字讀取與 EOF')
  expect(screen.getByRole('link', { name: /C11 工作草案 N1570/ })).toHaveAttribute('href', 'https://www.sigbus.info/n1570#7.21.7.1')
  vi.restoreAllMocks()
})
