import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { CHALLENGE_IDS } from '../data/challenges'
import { createDefaultProgress, PROGRESS_STORAGE_KEY, saveProgress } from '../state'
import { ForLoopLabPage } from './ForLoopLabPage'
import { HomePage } from './HomePage'
import { VariablesLessonPage } from './VariablesLessonPage'
import { ConditionalsLessonPage } from './ConditionalsLessonPage'

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

function renderLab() {
  return render(
    <MemoryRouter>
      <ForLoopLabPage />
    </MemoryRouter>,
  )
}

function renderVariablesLesson() {
  return render(
    <MemoryRouter>
      <VariablesLessonPage />
    </MemoryRouter>,
  )
}

function renderConditionalsLesson() {
  return render(
    <MemoryRouter>
      <ConditionalsLessonPage />
    </MemoryRouter>,
  )
}

function setLabNumber(name: RegExp, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name }), {
    target: { value: String(value) },
  })
}

function currentOutput() {
  return screen.getByText('你目前的完整輸出').nextElementSibling
}

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly scrollMargin = '0px'
  readonly thresholds = [0]

  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  unobserve() {}
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('HomePage interactive loop preview', () => {
  it('updates the generated C source and output as each slider changes', () => {
    renderHome()

    expect(screen.getByLabelText('輸出：0 1 2 3 4')).toBeInTheDocument()
    expect(screen.getByText('5 次迭代')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('slider', { name: /從哪裡開始/ }), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByRole('slider', { name: /小於多少/ }), {
      target: { value: '8' },
    })
    fireEvent.change(screen.getByRole('slider', { name: /每次增加/ }), {
      target: { value: '2' },
    })

    const source = screen.getByLabelText('即時產生的 C 語言 for 迴圈程式碼')
    expect(source).toHaveTextContent('for (int i = 2; i < 8; i += 2) {')
    expect(screen.getByLabelText('輸出：2 4 6')).toBeInTheDocument()
    expect(screen.getByText('3 次迭代')).toBeInTheDocument()
  })
})

describe('VariablesLessonPage interactive lesson', () => {
  it('updates the integer expression and explains division by zero', () => {
    renderVariablesLesson()

    expect(screen.getByRole('status')).toHaveTextContent('8 + 3 = 11')
    fireEvent.change(screen.getByRole('spinbutton', { name: /變數 a/ }), {
      target: { value: '7' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: /變數 b/ }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /\/.*除/ }))

    expect(screen.getByLabelText(/整數運算 C 程式碼/)).toHaveTextContent('int result = a / b;')
    expect(screen.getByRole('status')).toHaveTextContent('7 / 2 = 3')
    expect(screen.getByRole('status')).toHaveTextContent('小數部分會被捨去')

    fireEvent.change(screen.getByRole('spinbutton', { name: /變數 b/ }), {
      target: { value: '0' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('無法計算')
    expect(screen.getByRole('status')).toHaveTextContent('除數不能是 0')
  })

  it('records lesson completion after all three answers are correct', () => {
    renderVariablesLesson()

    fireEvent.click(within(screen.getByRole('radiogroup', { name: /哪一個是變數名稱/ })).getByRole('radio', { name: 'score' }))
    fireEvent.click(within(screen.getByRole('radiogroup', { name: /result 會得到多少/ })).getByRole('radio', { name: '3' }))
    fireEvent.click(within(screen.getByRole('radiogroup', { name: /取餘數運算/ })).getByRole('radio', { name: '2' }))

    expect(screen.getAllByText('單元完成').length).toBeGreaterThan(0)
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')).toMatchObject({
      completedLessonIds: ['variables'],
    })
  })
})

describe('ConditionalsLessonPage interactive lesson', () => {
  it('shows how AND and OR choose different branches', () => {
    renderConditionalsLesson()

    expect(screen.getByRole('status')).toHaveTextContent('通過')
    fireEvent.change(screen.getByRole('spinbutton', { name: /出席率 attendance/ }), {
      target: { value: '65' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('再練習')
    expect(screen.getByRole('status')).toHaveTextContent('false')

    fireEvent.click(screen.getByRole('button', { name: /\|\|.*一個就好/ }))
    expect(screen.getByRole('status')).toHaveTextContent('通過')
    expect(screen.getByRole('status')).toHaveTextContent('if 區塊')
  })

  it('records conditional lesson completion after all answers are correct', () => {
    renderConditionalsLesson()

    fireEvent.click(within(screen.getByRole('radiogroup', { name: /false.*else/ })).getByRole('radio', { name: 'else 區塊' }))
    fireEvent.click(within(screen.getByRole('radiogroup', { name: /表達式會得到/ })).getByRole('radio', { name: 'false' }))
    fireEvent.click(within(screen.getByRole('radiogroup', { name: /x 是 120/ })).getByRole('radio', { name: 'true' }))

    expect(JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')).toMatchObject({
      completedLessonIds: ['conditionals'],
    })
  })
})

describe('ForLoopLabPage execution controls', () => {
  it('supports single stepping, resets the trace, and stops playback when paused', () => {
    vi.useFakeTimers()
    renderLab()

    expect(screen.getByText('初始化', { selector: '.phase-badge' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
    expect(screen.getByText('檢查條件', { selector: '.phase-badge' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '回到第一步' }))
    expect(screen.getByText('初始化', { selector: '.phase-badge' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '開始播放' }))
    expect(screen.getByRole('button', { name: '暫停播放' })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(760))
    expect(screen.getByText('檢查條件', { selector: '.phase-badge' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '暫停播放' }))
    act(() => vi.advanceTimersByTime(1520))
    expect(screen.getByText('檢查條件', { selector: '.phase-badge' })).toBeInTheDocument()
  })

  it('synchronizes parameters, source, output, trace reset, and saved progress', () => {
    renderLab()

    fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
    expect(screen.getByText('1 ROWS')).toBeInTheDocument()

    setLabNumber(/起始值/, 2)
    setLabNumber(/終止值/, 10)
    fireEvent.change(screen.getByRole('combobox', { name: /比較方式/ }), {
      target: { value: '<=' },
    })
    setLabNumber(/步進值/, 2)

    expect(screen.getByText('初始化', { selector: '.phase-badge' })).toBeInTheDocument()
    expect(screen.getByText('0 ROWS')).toBeInTheDocument()
    expect(currentOutput()).toHaveTextContent('2 4 6 8 10')
    expect(screen.getByLabelText(/C 程式碼，目前執行第 4 行/)).toHaveTextContent(
      'for (int i = 2; i <= 10; i += 2) {',
    )

    expect(JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')).toMatchObject({
      lastConfig: { start: 2, end: 10, comparator: '<=', step: 2 },
    })

    fireEvent.click(screen.getByRole('button', { name: /恢復預設參數/ }))
    expect(screen.getByRole('spinbutton', { name: /起始值/ })).toHaveValue(0)
    expect(currentOutput()).toHaveTextContent('0 1 2 3 4')
  })

  it('surfaces a blocked loop only when its blocked frame is reached', () => {
    renderLab()

    setLabNumber(/步進值/, 0)
    expect(currentOutput()).toHaveTextContent('無法完成執行')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))

    expect(screen.getByRole('alert')).toHaveTextContent('已安全停止可能的無窮迴圈')
    expect(screen.getByRole('alert')).toHaveTextContent('步進值是 0')

    fireEvent.click(screen.getByRole('button', { name: '檢查這組輸出' }))
    expect(screen.getByRole('status')).toHaveTextContent('這組參數無法安全完成')
  })
})

describe('ForLoopLabPage challenges and local progress', () => {
  it('accepts all three exact output sequences and persists lesson completion', () => {
    renderLab()

    fireEvent.click(screen.getByRole('button', { name: '檢查這組輸出' }))
    expect(screen.getByRole('status')).toHaveTextContent('輸出完全正確')

    fireEvent.click(screen.getByRole('tab', { name: /偶數步進/ }))
    setLabNumber(/起始值/, 2)
    setLabNumber(/終止值/, 10)
    fireEvent.change(screen.getByRole('combobox', { name: /比較方式/ }), {
      target: { value: '<=' },
    })
    setLabNumber(/步進值/, 2)
    fireEvent.click(screen.getByRole('button', { name: '檢查這組輸出' }))
    expect(screen.getByRole('status')).toHaveTextContent('輸出完全正確')

    fireEvent.click(screen.getByRole('tab', { name: /倒數練習/ }))
    setLabNumber(/起始值/, 5)
    setLabNumber(/終止值/, 0)
    fireEvent.change(screen.getByRole('combobox', { name: /比較方式/ }), {
      target: { value: '>' },
    })
    setLabNumber(/步進值/, -1)
    fireEvent.click(screen.getByRole('button', { name: '檢查這組輸出' }))

    expect(screen.getByRole('heading', { name: /你已完成 for 迴圈單元/ })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')).toMatchObject({
      completedChallengeIds: [...CHALLENGE_IDS],
    })
  })

  it('requires confirmation before clearing saved progress and restores defaults', () => {
    const saved = createDefaultProgress()
    saved.completedChallengeIds = [...CHALLENGE_IDS]
    saved.lastConfig = { start: 5, end: 0, comparator: '>', step: -1 }
    saveProgress(saved)
    renderLab()

    expect(screen.getByRole('spinbutton', { name: /起始值/ })).toHaveValue(5)
    fireEvent.click(screen.getByRole('button', { name: /清除這台裝置的學習進度/ }))

    let confirmation = screen.getByRole('alert')
    expect(confirmation).toHaveTextContent('這個動作無法復原')
    fireEvent.click(within(confirmation).getByRole('button', { name: '取消' }))
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /清除這台裝置的學習進度/ }))
    confirmation = screen.getByRole('alert')
    fireEvent.click(within(confirmation).getByRole('button', { name: '確定清除' }))

    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByRole('spinbutton', { name: /起始值/ })).toHaveValue(0)
    expect(screen.queryByRole('heading', { name: /你已完成 for 迴圈單元/ })).not.toBeInTheDocument()
  })
})

describe('App hash routes and keyboard semantics', () => {
  it('navigates the core hash routes using keyboard-activated links', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/'
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )

    expect(screen.getByRole('heading', { name: /程式設計基礎\s*學習網站/ })).toBeInTheDocument()
    expect(screen.getByText('作者：魏志成')).toBeInTheDocument()

    const courseMapLink = screen.getByRole('link', { name: '課程地圖' })
    courseMapLink.focus()
    expect(courseMapLink).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: /從第一行程式/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/learn')
    expect(screen.getByRole('link', { name: '課程地圖' })).toHaveAttribute('aria-current', 'page')

    const variablesLink = screen.getByRole('link', { name: '變數與運算' })
    variablesLink.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: /把資料放進變數/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/learn/variables')

    const conditionalsLink = screen.getByRole('link', { name: '條件判斷' })
    conditionalsLink.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: /把問題變成真假/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/learn/conditionals')

    const labLink = screen.getByRole('link', { name: 'for 迴圈' })
    labLink.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: /看見 for 迴圈/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/learn/loops/for')
  })

  it('redirects an unknown hash route to the landing page', async () => {
    window.location.hash = '#/missing-page'
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )

    expect(await screen.findByRole('heading', { name: /程式設計基礎\s*學習網站/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/')
  })
})
