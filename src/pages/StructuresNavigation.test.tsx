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

it('opens integer parsing from the map and connects it to character input', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '檔案與文字輸入' })
  fireEvent.click(within(group).getByRole('link', { name: /strtol 數字解析與輸入驗證，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /先轉換數字/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('strtol 數字解析與輸入驗證')
  fireEvent.click(screen.getByRole('link', { name: '上一課：fgetc 逐字讀取與 EOF' }))
  await screen.findByRole('heading', { level: 1, name: /用 int 接住回傳值/ })
  expect(screen.getByRole('link', { name: '下一課：strtol 數字解析與輸入驗證' })).toHaveAttribute('href', '/learn/files/integer-parsing')
})

it('opens score statistics from the map and connects it to integer parsing', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '檔案與文字輸入' })
  fireEvent.click(within(group).getByRole('link', { name: /檔案資料驗證與分數統計，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /先確認整筆資料/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('檔案資料驗證與分數統計')
  fireEvent.click(screen.getByRole('link', { name: '上一課：strtol 數字解析與輸入驗證' }))
  await screen.findByRole('heading', { level: 1, name: /先轉換數字/ })
  expect(screen.getByRole('link', { name: '下一課：檔案資料驗證與分數統計' })).toHaveAttribute('href', '/learn/files/score-statistics')
})

it('shows all nine available topics on the home ribbon with a dynamic column count', () => {
  render(<ProgressProvider><MemoryRouter><HomePage /></MemoryRouter></ProgressProvider>)
  const ribbon = document.querySelector<HTMLElement>('.topic-ribbon')!
  expect(ribbon.querySelectorAll('.topic-pill')).toHaveLength(9)
  expect(ribbon.style.getPropertyValue('--topic-count')).toBe('9')
  expect(within(ribbon).getByText('結構與自訂型別').closest('.topic-pill')).toHaveTextContent('現在開放')
  expect(within(ribbon).getByText('動態記憶體').closest('.topic-pill')).toHaveTextContent('現在開放')
  expect(within(ribbon).getByText('檔案與文字輸入').closest('.topic-pill')).toHaveTextContent('現在開放')
})
it('opens the new chapter from its course-map group and focuses the loaded lesson heading', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '結構與自訂型別' })
  expect(screen.getByText('9 CORE TOPICS')).toBeInTheDocument()
  const link = within(group).getByRole('link', { name: /結構與成員存取，未開始/ })
  expect(link).toHaveAttribute('href', '/learn/structures/basics')
  fireEvent.click(link)
  const heading = await screen.findByRole('heading', { level: 1, name: /把相關資料/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('結構與成員存取')
})

it('links the second structure lesson from the map and back to its prerequisite', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '結構與自訂型別' })
  fireEvent.click(within(group).getByRole('link', { name: /結構陣列與逐筆統計，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /先找到那一筆/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('結構陣列與逐筆統計')
  fireEvent.click(screen.getByRole('link', { name: '上一課：結構與成員存取' }))
  await screen.findByRole('heading', { level: 1, name: /把相關資料/ })
  expect(screen.getByRole('link', { name: '下一課：結構陣列與逐筆統計' })).toHaveAttribute('href', '/learn/structures/arrays')
})

it('opens the structure-pointer lesson from the map and connects adjacent lessons', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '結構與自訂型別' })
  fireEvent.click(within(group).getByRole('link', { name: /指向結構的指標，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /沿著指標/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('指向結構的指標')
  fireEvent.click(screen.getByRole('link', { name: '上一課：結構陣列與逐筆統計' }))
  await screen.findByRole('heading', { level: 1, name: /先找到那一筆/ })
  expect(screen.getByRole('link', { name: '下一課：指向結構的指標' })).toHaveAttribute('href', '/learn/structures/pointers')
})

it('opens chapter eight from the course map and connects it to the prior chapter', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '動態記憶體' })
  fireEvent.click(within(group).getByRole('link', { name: /動態記憶體配置與釋放，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /先取得空間/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('動態記憶體配置與釋放')
  fireEvent.click(screen.getByRole('link', { name: '上一課：結構的函式傳遞與 typedef' }))
  await screen.findByRole('heading', { level: 1, name: /把結構傳給函式/ })
  expect(screen.getByRole('link', { name: '下一課：動態記憶體配置與釋放' })).toHaveAttribute('href', '/learn/memory/allocation')
})

it('opens structure functions from the course map and links back to structure pointers', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '結構與自訂型別' })
  fireEvent.click(within(group).getByRole('link', { name: /結構的函式傳遞與 typedef，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /把結構傳給函式/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('結構的函式傳遞與 typedef')
  fireEvent.click(screen.getByRole('link', { name: '上一課：指向結構的指標' }))
  await screen.findByRole('heading', { level: 1, name: /沿著指標/ })
  expect(screen.getByRole('link', { name: '下一課：結構的函式傳遞與 typedef' })).toHaveAttribute('href', '/learn/structures/functions')
})

it('opens the reallocation lesson from the map and connects adjacent memory lessons', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '動態記憶體' })
  fireEvent.click(within(group).getByRole('link', { name: /realloc 容量調整與失敗處理，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /先接住新結果/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('realloc 容量調整與失敗處理')
  fireEvent.click(screen.getByRole('link', { name: '上一課：動態記憶體配置與釋放' }))
  await screen.findByRole('heading', { level: 1, name: /先取得空間/ })
  expect(screen.getByRole('link', { name: '下一課：realloc 容量調整與失敗處理' })).toHaveAttribute('href', '/learn/memory/reallocation')
})

it('opens ownership from the course map and connects back to reallocation', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '動態記憶體' })
  fireEvent.click(within(group).getByRole('link', { name: /記憶體所有權、借用與釋放，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /交接同一塊記憶體/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('記憶體所有權、借用與釋放')
  fireEvent.click(screen.getByRole('link', { name: '上一課：realloc 容量調整與失敗處理' }))
  await screen.findByRole('heading', { level: 1, name: /先接住新結果/ })
  expect(screen.getByRole('link', { name: '下一課：記憶體所有權、借用與釋放' })).toHaveAttribute('href', '/learn/memory/ownership')
})

it('opens chapter nine from the course map and connects it to ownership', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '檔案與文字輸入' })
  fireEvent.click(within(group).getByRole('link', { name: /檔案開啟與 fgets 讀取，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /先確認讀到了什麼/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('檔案開啟與 fgets 讀取')
  fireEvent.click(screen.getByRole('link', { name: '上一課：記憶體所有權、借用與釋放' }))
  await screen.findByRole('heading', { level: 1, name: /交接同一塊記憶體/ })
  expect(screen.getByRole('link', { name: '下一課：檔案開啟與 fgets 讀取' })).toHaveAttribute('href', '/learn/files/reading')
})

it('opens fgetc input from the map and connects the two file lessons', async () => {
  render(<ProgressProvider><MemoryRouter initialEntries={['/learn']}><App /></MemoryRouter></ProgressProvider>)
  const group = await screen.findByRole('region', { name: '檔案與文字輸入' })
  fireEvent.click(within(group).getByRole('link', { name: /fgetc 逐字讀取與 EOF，未開始/ }))
  const heading = await screen.findByRole('heading', { level: 1, name: /用 int 接住回傳值/ })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(document.title).toContain('fgetc 逐字讀取與 EOF')
  fireEvent.click(screen.getByRole('link', { name: '上一課：檔案開啟與 fgets 讀取' }))
  await screen.findByRole('heading', { level: 1, name: /先確認讀到了什麼/ })
  expect(screen.getByRole('link', { name: '下一課：fgetc 逐字讀取與 EOF' })).toHaveAttribute('href', '/learn/files/characters')
})
