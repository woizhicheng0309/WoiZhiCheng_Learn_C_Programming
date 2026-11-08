import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { HomePage } from './HomePage'

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
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
})
afterEach(() => vi.unstubAllGlobals())

it('shows all seven available topics on the home ribbon with a dynamic column count', () => {
  render(<ProgressProvider><MemoryRouter><HomePage /></MemoryRouter></ProgressProvider>)
  const ribbon = document.querySelector<HTMLElement>('.topic-ribbon')!
  expect(ribbon.querySelectorAll('.topic-pill')).toHaveLength(7)
  expect(ribbon.style.getPropertyValue('--topic-count')).toBe('7')
  expect(within(ribbon).getByText('結構與自訂型別').closest('.topic-pill')).toHaveTextContent('現在開放')
})
it('opens the new chapter from its course-map group and focuses the loaded lesson heading', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '結構與自訂型別' })
  expect(screen.getByText('7 CORE TOPICS')).toBeInTheDocument()
  const link = within(group).getByRole('link', { name: /結構與成員存取，未開始/ })
  expect(link).toHaveAttribute('href', '/learn/structures/basics')
  fireEvent.click(link)
  const heading = await screen.findByRole('heading', { level: 1, name: /把相關資料/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('結構與成員存取')
})
