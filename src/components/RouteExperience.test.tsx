import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { RouteExperience } from './RouteExperience'

function DelayedHeading() {
  const [ready, setReady] = useState(false)
  return ready ? <h1>延後出現的單元標題</h1> : <button onClick={() => setReady(true)}>完成頁面載入</button>
}

it('waits for a delayed heading before moving keyboard focus after navigation', async () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  render(<MemoryRouter><RouteExperience /><Link to="/learn">開啟課程</Link><main id="main-content"><Routes>
    <Route path="/" element={<h1>首頁標題</h1>} />
    <Route path="/learn" element={<DelayedHeading />} />
  </Routes></main></MemoryRouter>)
  expect(screen.getByRole('heading', { name: '首頁標題' })).not.toHaveFocus()
  fireEvent.click(screen.getByRole('link', { name: '開啟課程' }))
  expect(document.title).toContain('課程地圖')
  fireEvent.click(screen.getByRole('button', { name: '完成頁面載入' }))
  const heading = screen.getByRole('heading', { name: '延後出現的單元標題' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(heading).toHaveAttribute('tabindex', '-1')
  // Later updates must not steal focus again after this route is ready.
  const link = screen.getByRole('link', { name: '開啟課程' })
  link.focus()
  heading.append(document.createElement('span'))
  await new Promise(resolve => window.requestAnimationFrame(resolve))
  expect(link).toHaveFocus()
  scroll.mockRestore()
})
