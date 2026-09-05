import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SiteHeader } from '../components/SiteChrome'
import { ProgressProvider } from '../hooks/useLearningProgress'
import {
  PROGRESS_STORAGE_KEY,
  type ProgressStorage,
  type ProgressV2,
} from '../state'
import { HomePage } from './HomePage'
import { LearnPage } from './LearnPage'

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

function renderWithProgress(content: React.ReactNode, storage: ProgressStorage | null = null) {
  return render(
    <ProgressProvider storage={storage}>
      <MemoryRouter>{content}</MemoryRouter>
    </ProgressProvider>,
  )
}

function createMemoryStorage(initialProgress?: ProgressV2): ProgressStorage {
  const values = new Map<string, string>()
  if (initialProgress) {
    values.set(PROGRESS_STORAGE_KEY, JSON.stringify(initialProgress))
  }
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('landing page variable preview', () => {
  it('keeps the variable source and C integer output synchronized', () => {
    renderWithProgress(<HomePage />)

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

    expect(screen.getByLabelText('即時產生的 C 語言變數與運算程式碼'))
      .toHaveTextContent('result = x / y;')
    expect(screen.getByLabelText('輸出：2')).toBeInTheDocument()
  })
})

describe('two-level course map', () => {
  it('shows every available topic and lesson without locks', () => {
    renderWithProgress(<LearnPage />)

    expect(screen.getByRole('heading', { name: '變數與運算', level: 2 }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: /程式骨架、變數與運算，未開始/ }))
      .toHaveAttribute('href', '/learn/variables/basics')
    expect(screen.getByRole('link', { name: /for 迴圈，未開始/ }))
      .toHaveAttribute('href', '/learn/loops/for')
    expect(screen.getByRole('link', { name: /函式、參數與回傳值，未開始/ }))
      .toHaveAttribute('href', '/learn/functions/basics')
    expect(screen.getByRole('link', { name: /陣列、索引與字串，未開始/ }))
      .toHaveAttribute('href', '/learn/arrays/basics')
    expect(screen.getByText('建議先備：for 迴圈')).toBeInTheDocument()
    expect(screen.getByText('建議先備：函式、參數與回傳值')).toBeInTheDocument()
    expect(screen.getAllByText('建議先備：程式骨架、變數與運算'))
      .toHaveLength(2)
  })
})

describe('site navigation and contextual learning progress', () => {
  it('keeps the header stable and marks the course section active on lesson pages', () => {
    const storage = createMemoryStorage({
      version: 2,
      lessons: {},
      lastVisitedLessonId: 'loops-for',
    })
    render(
      <ProgressProvider storage={storage}>
        <MemoryRouter initialEntries={['/learn/variables/basics']}>
          <SiteHeader />
        </MemoryRouter>
      </ProgressProvider>,
    )

    const desktopNav = screen.getByRole('navigation', { name: '主要導覽' })
    expect(within(desktopNav).queryByRole('link', { name: '繼續學習' })).not.toBeInTheDocument()
    expect(within(desktopNav).getByRole('link', { name: '課程地圖' }))
      .toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: '開啟導覽選單' }))
    const mobileNav = screen.getByRole('navigation', { name: '行動版導覽' })
    expect(within(mobileNav).queryByRole('link', { name: '繼續學習' })).not.toBeInTheDocument()
    expect(within(mobileNav).getByRole('link', { name: '課程地圖' }))
      .toHaveAttribute('aria-current', 'page')
  })

  it('keeps the specific last-visited lesson in the course-map progress card', () => {
    const storage = createMemoryStorage({
      version: 2,
      lessons: {},
      lastVisitedLessonId: 'loops-for',
    })
    renderWithProgress(<LearnPage />, storage)

    expect(screen.getByRole('link', { name: '繼續上次進度：for 迴圈' }))
      .toHaveAttribute('href', '/learn/loops/for')
  })
})
