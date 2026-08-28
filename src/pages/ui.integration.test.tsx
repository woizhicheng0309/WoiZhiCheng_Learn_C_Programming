import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from '../App'
import { CHALLENGE_IDS } from '../data/challenges'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { createDefaultProgress, PROGRESS_STORAGE_KEY, saveProgress } from '../state'
import { ForLoopLabPage } from './ForLoopLabPage'
import { HomePage } from './HomePage'

function renderHome() {
  return render(
    <ProgressProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </ProgressProvider>,
  )
}

function renderLab() {
  return render(
    <ProgressProvider>
      <MemoryRouter>
        <ForLoopLabPage />
      </MemoryRouter>
    </ProgressProvider>,
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

describe('HomePage interactive variables preview', () => {
  it('updates the generated C source and output as each slider changes', () => {
    renderHome()

    expect(screen.getByLabelText('輸出：7')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('slider', { name: 'x 的值' }), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByRole('slider', { name: 'y 的值' }), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByRole('slider', { name: '運算子' }), {
      target: { value: '3' },
    })

    const source = screen.getByLabelText('即時產生的 C 語言變數與運算程式碼')
    expect(source).toHaveTextContent('int result = x / y;')
    expect(screen.getByLabelText('輸出：2')).toBeInTheDocument()
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
      version: 2,
      lessons: {
        'loops-for': {
          savedState: { start: 2, end: 10, comparator: '<=', step: 2 },
        },
      },
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

  it('keeps nested table exploration isolated from the saved for configuration', () => {
    renderLab()
    setLabNumber(/起始值/, 3)
    const before = JSON.parse(
      window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}',
    ).lessons['loops-for'].savedState
    const nested = screen.getByRole('region', {
      name: /一個迴圈走過每一列/,
    })

    fireEvent.change(within(nested).getByRole('spinbutton', {
      name: /外層上限 a/,
    }), {
      target: { value: '4' },
    })

    const after = JSON.parse(
      window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}',
    ).lessons['loops-for'].savedState
    expect(after).toEqual(before)
    expect(within(nested).getByRole('table', {
      name: '4 × 9 乘法表，已完成 0 格',
    })).toBeInTheDocument()
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
      lessons: {
        'loops-for': { completedChallengeIds: [...CHALLENGE_IDS] },
      },
    })
  })

  it('requires confirmation before clearing saved progress and restores defaults', () => {
    const saved = createDefaultProgress()
    saved.lessons['loops-for'] = {
      guidedRunCompleted: false,
      completedChallengeIds: [...CHALLENGE_IDS],
      savedState: { start: 5, end: 0, comparator: '>', step: -1 },
    }
    saveProgress(saved)
    renderLab()

    expect(screen.getByRole('spinbutton', { name: /起始值/ })).toHaveValue(5)
    fireEvent.click(screen.getByRole('button', { name: /清除這台裝置的學習進度/ }))

    let confirmation = screen.getByRole('alertdialog')
    expect(confirmation).toHaveTextContent('這個動作無法復原')
    fireEvent.click(within(confirmation).getByRole('button', { name: '取消' }))
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /清除這台裝置的學習進度/ }))
    confirmation = screen.getByRole('alertdialog')
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
      <ProgressProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ProgressProvider>,
    )

    expect(screen.getByRole('heading', { name: /程式設計基礎\s*學習網站/ })).toBeInTheDocument()
    expect(screen.getByLabelText('作者：魏志成')).toBeInTheDocument()

    const courseMapLink = screen.getByRole('link', { name: '課程地圖' })
    courseMapLink.focus()
    expect(courseMapLink).toHaveFocus()
    await user.keyboard('{Enter}')

    const courseMapHeading = await screen.findByRole('heading', { name: /從第一行程式/ })
    expect(window.location.hash).toBe('#/learn')
    expect(screen.getByRole('link', { name: '課程地圖' })).toHaveAttribute('aria-current', 'page')
    await waitFor(() => expect(courseMapHeading).toHaveFocus())

    const variablesLink = screen.getByRole('link', { name: /程式骨架、變數與運算，未開始/ })
    variablesLink.focus()
    await user.keyboard('{Enter}')

    const variablesHeading = await screen.findByRole('heading', { name: /從程式骨架開始/ })
    expect(window.location.hash).toBe('#/learn/variables/basics')
    expect(document.title).toContain('程式骨架、變數與運算')
    await waitFor(() => expect(variablesHeading).toHaveFocus())
    const primaryNav = screen.getByRole('navigation', { name: '主要導覽' })
    expect(within(primaryNav).queryByRole('link', { name: '繼續學習' })).not.toBeInTheDocument()
    expect(within(primaryNav).getByRole('link', { name: '課程地圖' })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getAllByRole('link', { name: '課程地圖' })[0])
    const returnedCourseMapHeading = await screen.findByRole('heading', { name: /從第一行程式/ })
    await waitFor(() => expect(returnedCourseMapHeading).toHaveFocus())
    const labLink = await screen.findByRole('link', { name: /for 迴圈，未開始/ })
    labLink.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: /看見 for 迴圈/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/learn/loops/for')
  })

  it('redirects an unknown hash route to the landing page', async () => {
    window.location.hash = '#/missing-page'
    render(
      <ProgressProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ProgressProvider>,
    )

    expect(await screen.findByRole('heading', { name: /程式設計基礎\s*學習網站/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/')
  })
})
