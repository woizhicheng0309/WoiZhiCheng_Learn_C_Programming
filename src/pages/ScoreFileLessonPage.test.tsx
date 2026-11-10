import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { buildScoreFileSource } from '../domain/scoreFile'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isScoreFileSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { ScoreFileLessonPage } from './ScoreFileLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><ScoreFileLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '分數統計執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 350; i++) {
    if (condition()) return
    if (button.disabled) break
    fireEvent.click(button)
  }
  throw new Error('Expected score-file phase not reached')
}
const phase = (value: string) => document.querySelector(`.allocation-execution[data-phase="${value}"]`) !== null
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
function predict(value = '3 3 180') {
  fireEvent.change(screen.getByRole('textbox', { name: '預測 accepted、rejected、sum' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
}
const stdout = () => screen.getByLabelText('分數統計輸出').textContent
const jump = () => fireEvent.click(screen.getByRole('button', { name: '前往下一筆判定' }))
const finish = () => fireEvent.click(screen.getByRole('button', { name: '查看最後結果' }))
const records = () => within(screen.getByRole('list', { name: '分數判定紀錄' })).getAllByRole('listitem')
beforeEach(() => window.localStorage.clear())

it('steps through separate count and sum writes, then jumps between decisions and reveals prediction at the end', { timeout: 15000 }, () => {
  renderPage()
  expect(screen.queryByRole('button', { name: '前往下一筆判定' })).not.toBeInTheDocument()
  predict('3 3'); expect(screen.getByRole('alert')).toHaveTextContent('三個非負整數')
  predict(); advanceUntil(() => phase('accept'))
  expect(screen.getByLabelText('目前 accepted')).toHaveTextContent('1')
  expect(screen.getByLabelText('目前 sum')).toHaveTextContent('0')
  expect(document.querySelector('.source-code-panel__line.is-active')).toHaveTextContent('accepted++')
  fireEvent.click(nextButton())
  expect(screen.getByLabelText('目前 sum')).toHaveTextContent('80')
  jump(); expect(records()[1]).toHaveTextContent('拒絕：沒有數字')
  jump(); jump(); jump(); jump()
  expect(records()).toHaveLength(6)
  expect(records()[5]).toHaveTextContent('"0"接受')
  expect(screen.queryByText(/你預測 3、3、180，實際/)).not.toBeInTheDocument()
  finish()
  expect(stdout()).toBe('complete\naccepted=3, rejected=3, sum=180\naverage=60.00\n')
  expect(screen.getByText('你預測 3、3、180，實際 3、3、180。預測正確！')).toBeInTheDocument()
  expect(screen.getByLabelText('目前 accepted')).toHaveTextContent('—')
  expect(loadProgress().lessons['files-score-statistics']?.guidedRunCompleted).toBe(true)
})
it('keeps an overlong prefix bounded and rejects the record even when strtol returns zero', () => {
  renderPage(); choose('分數資料', 'long'); predict('1 1 90'); jump()
  expect(phase('reject')).toBe(true)
  expect(screen.getByLabelText('目前 used')).toHaveTextContent('11')
  expect(screen.getByLabelText('目前 too_long')).toHaveTextContent('1')
  const cells = within(screen.getByRole('list', { name: '分數字元緩衝區' })).getAllByRole('listitem')
  expect(cells).toHaveLength(12)
  expect(cells[11]).toHaveTextContent('結尾空字元')
  expect(screen.getByLabelText('分數目前 value')).toHaveTextContent('0')
  expect(screen.getByLabelText('分數目前 valid')).toHaveTextContent('0')
  expect(records()[0]).toHaveTextContent('拒絕：整行過長')
  jump(); expect(records()[1]).toHaveTextContent('"90"接受')
  finish(); expect(stdout()).toContain('accepted=1, rejected=1, sum=90')
})
it('discards a partially read record after fgetc reports an error', () => {
  renderPage(); choose('I/O 情境', 'read-failure'); predict('1 0 80'); jump()
  const errorFlag = screen.getByLabelText('分數錯誤指標')
  advanceUntil(() => phase('read-error') && errorFlag.textContent === '1')
  expect(screen.getByLabelText('分數目前 ch')).toHaveTextContent('EOF')
  expect(screen.getByLabelText('分數 EOF 指標')).toHaveTextContent('0')
  expect(screen.getByLabelText('目前 used')).toHaveTextContent('1')
  expect(screen.getByLabelText('目前 rejected')).toHaveTextContent('0')
  expect(records()).toHaveLength(1)
  finish(); expect(stdout()).toBe('I/O failed\n')
  expect(screen.getByText('你預測 1、0、80，實際 1、0、80。預測正確！')).toBeInTheDocument()
})
it('labels early-stop results partial and suppresses them after close failure', () => {
  renderPage(); choose('無效紀錄策略', 'true'); predict('1 1 80'); jump(); jump()
  advanceUntil(() => phase('close'))
  expect(screen.getByLabelText('目前 stopped')).toHaveTextContent('1')
  expect(screen.getByLabelText('目前 fp')).toHaveTextContent('不可再使用')
  expect(screen.getByLabelText('分數目前 ch')).toHaveTextContent('—')
  finish(); expect(stdout()).toBe('partial\naccepted=1, rejected=1, sum=80\naverage=80.00\n')
  choose('I/O 情境', 'close-failure'); predict('1 1 80'); jump(); jump(); finish()
  expect(stdout()).toBe('I/O failed\n')
  expect(screen.getByLabelText('main 回傳值')).toHaveTextContent('2')
})
it('distinguishes no average from a valid zero average', () => {
  renderPage(); choose('分數資料', 'empty'); predict('0 0 0'); finish()
  expect(stdout()).toContain('average=N/A')
  choose('分數資料', 'zero'); predict('2 0 0'); jump(); jump(); finish()
  expect(stdout()).toContain('average=0.00')
})
it('keeps the active statement visible in its keyboard-focusable source pane', () => {
  renderPage(); predict()
  const editor = screen.getByRole('region', { name: /C 程式碼，目前執行第/ })
  expect(editor).toHaveAttribute('tabindex', '0')
  const read = editor.querySelector<HTMLElement>(`[data-line="${buildScoreFileSource().locations.read}"]`)!
  vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 100 } as DOMRect)
  vi.spyOn(read, 'getBoundingClientRect').mockReturnValue({ top: 120, bottom: 150 } as DOMRect)
  advanceUntil(() => phase('read'))
  expect(read).toHaveAttribute('aria-current', 'step')
  expect(editor.scrollTop).toBe(50)
  vi.restoreAllMocks()
})
it('pauses playback when jumping and resets without completion when changing settings', () => {
  vi.useFakeTimers()
  try {
    renderPage(); predict(); fireEvent.click(screen.getByRole('button', { name: '分數統計執行：開始播放' }))
    jump(); expect(phase('sum')).toBe(true)
    act(() => vi.advanceTimersByTime(10000)); expect(phase('sum')).toBe(true)
    choose('分數資料', 'zero')
    expect(phase('prepare')).toBe(true)
    expect(screen.queryByRole('button', { name: '前往下一筆判定' })).not.toBeInTheDocument()
    expect(loadProgress().lessons['files-score-statistics']?.guidedRunCompleted).toBe(false)
  } finally { vi.useRealTimers() }
})
it('completes independent keyboard challenges and restores all saved controls', () => {
  const view = renderPage()
  choose('分數資料', 'long'); choose('I/O 情境', 'close-failure'); choose('無效紀錄策略', 'true')
  const solve = (value: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  }
  solve('1'); expect(loadProgress().lessons['files-score-statistics']?.completedChallengeIds).toEqual([])
  solve('2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /過長前綴不能變成一筆分數/ }), { key: 'ArrowRight' }); solve('3 3 180')
  fireEvent.keyDown(screen.getByRole('tab', { name: /只把完整合法紀錄加入總和/ }), { key: 'End' }); solve('2')
  expect(screen.getByText('你已完成檔案資料驗證與分數統計。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 33, totalChallenges: 99, completedChallenges: 3 })
  expect(loadProgress().lessons['files-score-statistics']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage()
  expect(screen.getByRole('combobox', { name: '分數資料' })).toHaveValue('long')
  expect(screen.getByRole('combobox', { name: 'I/O 情境' })).toHaveValue('close-failure')
  expect(screen.getByRole('combobox', { name: '無效紀錄策略' })).toHaveValue('true')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})
it('synchronizes cross-tab clearing without restoring cleared progress', () => {
  renderPage()
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-score-statistics', lessons: {
    'files-score-statistics': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: 'zero', outcome: 'success', stopOnInvalid: true } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '分數資料' })).toHaveValue('zero')
  jump(); jump(); finish(); expect(stdout()).toContain('average=0.00')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: '前往下一筆判定' })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: '分數資料' })).toHaveValue('mixed')
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  choose('分數資料', 'empty'); predict('0 0 0'); finish()
  expect(loadProgress().lessons['files-score-statistics']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed controls while retaining prior strtol progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['distinguish-strtol-zero'], savedState: { text: '0', longBits: 64, allowTrailingSpace: true } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-score-statistics', lessons: {
    'files-integer-parsing': previous,
    'files-score-statistics': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { dataset: 'zero', outcome: 'success', stopOnInvalid: 'false' } },
  } }))
  expect(loadProgress().lessons['files-integer-parsing']).toEqual(previous)
  expect(loadProgress().lessons['files-score-statistics']).toMatchObject({ guidedRunCompleted: false, savedState: { dataset: 'mixed', outcome: 'success', stopOnInvalid: false } })
  expect(isScoreFileSavedState({ dataset: 'zero', outcome: 'success', stopOnInvalid: true })).toBe(true)
  for (const value of [null, [], { dataset: 'constructor', outcome: 'success', stopOnInvalid: true }, { dataset: 'zero', outcome: { toString: null }, stopOnInvalid: false }]) expect(isScoreFileSavedState(value)).toBe(false)
})
it('opens the lazy hash route with its title, source and prerequisite', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/files/score-statistics'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先確認整筆資料/ })).toBeInTheDocument()
  expect(document.title).toContain('檔案資料驗證與分數統計')
  expect(screen.getByRole('link', { name: 'C11 工作草案 N1570：fgetc' })).toHaveAttribute('href', 'https://www.sigbus.info/n1570#7.21.7.1')
  expect(screen.getByRole('link', { name: '上一課：strtol 數字解析與輸入驗證' })).toHaveAttribute('href', '#/learn/files/integer-parsing')
  vi.restoreAllMocks()
})
