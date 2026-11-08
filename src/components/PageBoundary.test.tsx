import { lazy, Suspense, type ComponentType } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PageBoundary, PageLoading } from './PageBoundary'

it('announces loading until the requested page is ready', async () => {
  let resolve!: (value: { default: ComponentType }) => void
  const DelayedPage = lazy(() => new Promise<{ default: ComponentType }>(done => { resolve = done }))
  render(<MemoryRouter><PageBoundary><Suspense fallback={<PageLoading />}><DelayedPage /></Suspense></PageBoundary></MemoryRouter>)
  expect(screen.getByRole('status')).toHaveTextContent('正在準備互動單元')
  await act(async () => resolve({ default: () => <h1>互動單元已就緒</h1> }))
  expect(screen.getByRole('heading', { name: '互動單元已就緒' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('offers an explicit reload after a failed download and preserves stored progress', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const reload = vi.fn()
  const stored = '{"version":2,"lessons":{}}'
  window.localStorage.setItem('page-boundary-progress', stored)
  const FailedPage = lazy(() => Promise.reject(new Error('chunk unavailable')))
  const view = render(<MemoryRouter><PageBoundary key="failed" onReload={reload}><Suspense fallback={<PageLoading />}><FailedPage /></Suspense></PageBoundary></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('頁面暫時無法開啟')
  fireEvent.click(screen.getByRole('button', { name: '重新載入此頁' }))
  expect(reload).toHaveBeenCalledOnce()
  expect(window.localStorage.getItem('page-boundary-progress')).toBe(stored)
  expect(screen.getByRole('link', { name: '回到首頁' })).toHaveAttribute('href', '/')
  view.rerender(<MemoryRouter><PageBoundary key="another-route"><h1>其他單元正常開啟</h1></PageBoundary></MemoryRouter>)
  expect(screen.getByRole('heading', { name: '其他單元正常開啟' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  consoleError.mockRestore()
  window.localStorage.removeItem('page-boundary-progress')
})
