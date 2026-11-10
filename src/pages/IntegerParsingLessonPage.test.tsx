import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, isIntegerParsingSavedState, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { IntegerParsingLessonPage } from './IntegerParsingLessonPage'

const renderPage = () => render(<StrictMode><ProgressProvider><MemoryRouter><IntegerParsingLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '數字解析執行：執行下一步' })
function advanceUntil(condition: () => boolean) {
  const button = nextButton()
  for (let i = 0; i < 100; i++) { if (condition()) return; if (button.disabled) break; fireEvent.click(button) }
  throw new Error('Expected integer-parsing phase not reached')
}
function finish() { const button = nextButton(); advanceUntil(() => button.disabled) }
const phase = (value: string) => document.querySelector(`.allocation-execution[data-phase="${value}"]`) !== null
const activeLine = (line: number) => document.querySelector(`.source-code-panel__part.is-active[data-part="line-${line}"]`) !== null
function predict(value = '3') { fireEvent.change(screen.getByRole('textbox', { name: '預測 main 回傳值' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '提交預測' })) }
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const draft = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: '輸入文字（套用後執行）' }), { target: { value } })
const apply = (value: string) => { draft(value); fireEvent.click(screen.getByRole('button', { name: '套用文字' })) }
const stdout = () => screen.getByLabelText('數字解析輸出').textContent
beforeEach(() => window.localStorage.clear())

it('shows end and value only after conversion, rejects a suffix, and reveals prediction only on return', () => {
  renderPage()
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('x'); expect(screen.getByRole('alert')).toHaveTextContent('一個非負整數')
  predict(); advanceUntil(() => phase('read-digit'))
  expect(activeLine(10)).toBe(true)
  expect(screen.getByLabelText('目前 value')).toHaveTextContent('尚未取得回傳值')
  expect(screen.getByLabelText('目前 end 索引')).toHaveTextContent('尚未取得停止位址')
  advanceUntil(() => phase('finish-conversion'))
  expect(screen.getByLabelText('目前 value')).toHaveTextContent('42')
  expect(screen.getByLabelText('目前 end 索引')).toHaveTextContent('2')
  expect(screen.getByLabelText('目前 end 字元')).toHaveTextContent('a')
  expect(screen.getByLabelText('目前 errno')).toHaveTextContent('0')
  expect(document.querySelector('.file-input-tokens .is-current')).toHaveTextContent('← end')
  advanceUntil(() => phase('print-tail'))
  expect(stdout()).toBe('trailing data\n')
  expect(screen.queryByText(/你預測 3，實際/)).not.toBeInTheDocument()
  fireEvent.click(nextButton())
  expect(screen.getByText('你預測 3，實際 3。預測正確！')).toBeInTheDocument()
  finish(); expect(screen.getByLabelText('目前 value')).toHaveTextContent('—')
  expect(loadProgress().lessons['files-integer-parsing']?.guidedRunCompleted).toBe(true)
})
it('distinguishes a legitimate zero from no digits after spaces and a sign', () => {
  renderPage(); choose('範例文字', 'zero'); predict('0'); advanceUntil(() => phase('finish-conversion'))
  expect(screen.getByLabelText('目前 value')).toHaveTextContent('0')
  expect(screen.getByLabelText('目前 end 索引')).toHaveTextContent('1')
  expect(screen.getByLabelText('目前 end 字元')).toHaveTextContent('\\0')
  finish(); expect(stdout()).toBe('value=0\n')
  choose('範例文字', 'noDigits'); predict('1'); advanceUntil(() => phase('finish-conversion'))
  expect(screen.getByLabelText('概念掃描索引')).toHaveTextContent('2')
  expect(screen.getByLabelText('目前 end 索引')).toHaveTextContent('0')
  expect(screen.getByLabelText('目前 value')).toHaveTextContent('0')
  finish(); expect(stdout()).toBe('no digits\n')
})
it('keeps the conversion stop record while moving end over trailing spaces', () => {
  renderPage(); choose('範例文字', 'spaces'); choose('尾端規則', 'true'); predict('0')
  advanceUntil(() => phase('finish-conversion'))
  expect(screen.getByLabelText('目前 end 索引')).toHaveTextContent('5')
  advanceUntil(() => phase('tail-condition')); expect(activeLine(21)).toBe(true)
  expect(screen.getByLabelText('目前判斷')).toHaveTextContent('isspace((unsigned char)*end) → 成立')
  advanceUntil(() => phase('check-tail'))
  expect(screen.getByLabelText('目前 end 索引')).toHaveTextContent('7')
  expect(screen.getByLabelText('轉換停止位置紀錄')).toHaveTextContent('5')
  finish(); expect(stdout()).toBe('value=-17\n')
})
it('changes the long range and displays exact 64-bit boundary values', () => {
  renderPage(); choose('範例文字', 'over32'); predict('2'); advanceUntil(() => phase('finish-conversion'))
  expect(screen.getByLabelText('目前 value')).toHaveTextContent('2147483647')
  expect(screen.getByLabelText('目前 errno')).toHaveTextContent('ERANGE')
  finish(); expect(stdout()).toBe('out of range\n')
  choose('long 模型', '64'); predict('0'); finish(); expect(stdout()).toBe('value=2147483648\n')
  choose('範例文字', 'min64'); predict('0'); advanceUntil(() => phase('finish-conversion'))
  expect(screen.getByLabelText('目前 value').textContent).toBe('-9223372036854775808')
  finish(); expect(stdout()).toBe('value=-9223372036854775808\n')
  choose('範例文字', 'over64'); predict('2'); finish(); expect(stdout()).toBe('out of range\n')
})
it('applies custom input explicitly, rejects invalid drafts, and accepts the empty string', () => {
  renderPage(); predict(); advanceUntil(() => phase('finish-conversion'))
  const savedBeforeEditing = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
  draft('9007199254740993')
  expect(phase('finish-conversion')).toBe(true)
  expect(screen.getByLabelText('目前套用文字')).toHaveTextContent('"42abc"')
  apply('中文')
  expect(screen.getByRole('alert')).toHaveTextContent('ASCII')
  expect(phase('finish-conversion')).toBe(true)
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(savedBeforeEditing)
  apply('1'.repeat(41)); expect(screen.getByRole('alert')).toHaveTextContent('40')
  apply('9007199254740993'); choose('long 模型', '64'); predict('0'); finish()
  expect(stdout()).toBe('value=9007199254740993\n')
  apply(''); predict('1'); finish(); expect(stdout()).toBe('no digits\n')
  fireEvent.click(screen.getByRole('button', { name: '恢復預設值' }))
  expect(screen.getByRole('textbox', { name: '輸入文字（套用後執行）' })).toHaveValue('42abc')
  expect(screen.getByRole('combobox', { name: 'long 模型' })).toHaveValue('32')
  expect(phase('prepare')).toBe(true)
})
it('retains an unapplied draft when platform settings change and resets playback', () => {
  vi.useFakeTimers()
  try {
    renderPage(); predict(); fireEvent.click(screen.getByRole('button', { name: '數字解析執行：開始播放' }))
    act(() => vi.advanceTimersByTime(760)); expect(phase('enter-main')).toBe(true)
    draft('77'); choose('long 模型', '64'); act(() => vi.advanceTimersByTime(10000))
    expect(phase('prepare')).toBe(true)
    expect(screen.getByRole('textbox', { name: '輸入文字（套用後執行）' })).toHaveValue('77')
    expect(screen.getByLabelText('目前套用文字')).toHaveTextContent('"42abc"')
    expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
    expect(loadProgress().lessons['files-integer-parsing']?.guidedRunCompleted).toBe(false)
  } finally { vi.useRealTimers() }
})
it('completes independent keyboard challenges and restores all saved controls', () => {
  const view = renderPage()
  apply(' +123 \t'); choose('long 模型', '64'); choose('尾端規則', 'true')
  const solve = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: '檢查答案' })) }
  solve('1'); expect(loadProgress().lessons['files-integer-parsing']?.completedChallengeIds).toEqual([])
  solve('2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /零值不等於轉換失敗/ }), { key: 'ArrowRight' }); solve('42 2')
  fireEvent.keyDown(screen.getByRole('tab', { name: /轉換前綴與停止位置/ }), { key: 'End' }); solve('10 1')
  expect(screen.getByText('你已完成 strtol 數字解析與輸入驗證。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 34, totalChallenges: 102, completedChallenges: 3 })
  expect(loadProgress().lessons['files-integer-parsing']?.guidedRunCompleted).toBe(false)
  view.unmount(); renderPage()
  expect(screen.getByRole('textbox', { name: '輸入文字（套用後執行）' })).toHaveValue(' +123 \t')
  expect(screen.getByRole('combobox', { name: 'long 模型' })).toHaveValue('64')
  expect(screen.getByRole('combobox', { name: '尾端規則' })).toHaveValue('true')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})
it('synchronizes cross-tab state and clearing without reviving removed progress', () => {
  renderPage(); draft('unapplied')
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-integer-parsing', lessons: {
    'files-integer-parsing': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { text: '42 ', longBits: 64, allowTrailingSpace: true } },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('textbox', { name: '輸入文字（套用後執行）' })).toHaveValue('42 ')
  finish(); expect(stdout()).toBe('value=42\n')
  act(() => { window.localStorage.removeItem(PROGRESS_STORAGE_KEY); window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })) })
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '輸入文字（套用後執行）' })).toHaveValue('42abc')
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  predict(); finish()
  expect(loadProgress().lessons['files-integer-parsing']?.guidedRunCompleted).toBe(true)
})
it('recovers malformed saved settings and preserves prior character-input progress', () => {
  const previous = { guidedRunCompleted: true, completedChallengeIds: ['choose-fgetc-int'], savedState: { dataset: 'text', outcome: 'success', stopAtNewline: true } }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'files-integer-parsing', lessons: {
    'files-characters': previous,
    'files-integer-parsing': { guidedRunCompleted: true, completedChallengeIds: [], savedState: { text: '0', longBits: '64', allowTrailingSpace: true } },
  } }))
  expect(loadProgress().lessons['files-characters']).toEqual(previous)
  expect(loadProgress().lessons['files-integer-parsing']).toMatchObject({ guidedRunCompleted: false, savedState: { text: '42abc', longBits: 32, allowTrailingSpace: false } })
  expect(isIntegerParsingSavedState({ text: '', longBits: 64, allowTrailingSpace: false })).toBe(true)
  for (const value of [null, [], { text: { toString: null }, longBits: 32, allowTrailingSpace: true }, { text: '中', longBits: 32, allowTrailingSpace: true }, { text: '1', longBits: 32, allowTrailingSpace: 'false' }]) expect(isIntegerParsingSavedState(value)).toBe(false)
})
it('opens its lazy hash route with title, source links and previous lesson', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/learn/files/integer-parsing'
  render(<ProgressProvider><HashRouter><App /></HashRouter></ProgressProvider>)
  expect(await screen.findByRole('heading', { level: 1, name: /先轉換數字/ })).toBeInTheDocument()
  expect(document.title).toContain('strtol 數字解析與輸入驗證')
  expect(screen.getByRole('link', { name: 'C11 工作草案 N1570：strtol' })).toHaveAttribute('href', 'https://www.sigbus.info/n1570#7.22.1.4')
  expect(screen.getByRole('link', { name: '上一課：fgetc 逐字讀取與 EOF' })).toHaveAttribute('href', '#/learn/files/characters')
  vi.restoreAllMocks()
})
