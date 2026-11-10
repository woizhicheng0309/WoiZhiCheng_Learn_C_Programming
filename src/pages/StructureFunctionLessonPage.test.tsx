import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { getCourseProgress, loadProgress, PROGRESS_STORAGE_KEY } from '../state'
import { StructureFunctionLessonPage } from './StructureFunctionLessonPage'

const renderLesson = () => render(<StrictMode><ProgressProvider><MemoryRouter><StructureFunctionLessonPage /></MemoryRouter></ProgressProvider></StrictMode>)
const phase = (name: string) => document.querySelector(`.structure-execution[data-phase="${name}"]`) !== null
function goTo(name: string) {
  const button = screen.getByRole<HTMLButtonElement>('button', { name: '結構函式執行：執行下一步' })
  for (let i = 0; i < 24 && !phase(name) && !button.disabled; i++) fireEvent.click(button)
  expect(phase(name)).toBe(true)
}
function predict(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '預測 original、preview 的分數' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '提交預測' }))
}
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
beforeEach(() => window.localStorage.clear())

it('separates the copied structure, returned value and pointer parameter during the guided run', { timeout: 15000 }, () => {
  renderLesson()
  predict('101 88')
  expect(screen.getByRole('alert')).toHaveTextContent('0 到 100')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  predict('96 88')
  goTo('return-copy')
  expect(screen.getByLabelText('original.score')).toHaveTextContent('70')
  expect(screen.getByLabelText('copy.score')).toHaveTextContent('88')
  expect(screen.getByLabelText('preview.score')).toHaveTextContent('—')
  expect(screen.getByLabelText('即將回傳的結構')).toHaveTextContent('id=7, score=88')
  goTo('rebind-target')
  expect(screen.queryByLabelText('copy.score')).not.toBeInTheDocument()
  expect(screen.getByLabelText('original.score')).toHaveTextContent('96')
  expect(screen.getByLabelText('target 指向')).toHaveTextContent('&preview')
  expect(screen.getByLabelText('selected 指向')).toHaveTextContent('&original')
  expect(screen.queryByText(/預測正確/)).not.toBeInTheDocument()
  goTo('done')
  expect(screen.getByLabelText('結構函式輸出')).toHaveTextContent('original=96, preview=88, selected=96, observed=88')
  expect(screen.getByText(/預測正確/)).toBeInTheDocument()
  expect(loadProgress().lessons['structures-functions']?.guidedRunCompleted).toBe(true)
})

it('highlights preview as the write target when rebinding first and uses the chosen type spelling', { timeout: 12000 }, () => {
  renderLesson()
  choose('型別寫法', 'tag')
  choose('update 內的順序', 'rebind-first')
  predict('70,96')
  goTo('write-target')
  expect(screen.getByRole('region', { name: 'preview 紀錄' })).toHaveClass('is-active')
  expect(screen.getByLabelText('preview.score')).toHaveTextContent('96')
  expect(screen.getByLabelText('original.score')).toHaveTextContent('70')
  expect(screen.getByLabelText('selected 指向')).toHaveTextContent('&original')
  expect(screen.getByText('struct Student *selected = &original;')).toBeInTheDocument()
  expect(document.querySelector('.source-code-panel__line.is-active')).toHaveTextContent('target->score = score;')
})

it('saves settings and the three separate challenge completions', () => {
  const view = renderLesson()
  choose('型別寫法', 'tag')
  choose('update 內的順序', 'rebind-first')
  fireEvent.change(screen.getByRole('slider', { name: 'revise 寫入的分數' }), { target: { value: '0' } })
  fireEvent.change(screen.getByRole('slider', { name: 'update 寫入的分數' }), { target: { value: '100' } })
  const submit = (value: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: /你的答案/ }), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: '檢查答案' }))
  }
  submit('88 88')
  expect(loadProgress().lessons['structures-functions']?.completedChallengeIds).toEqual([])
  submit('70，88')
  fireEvent.keyDown(screen.getByRole('tab', { name: /回傳結構值後/ }), { key: 'ArrowRight' })
  submit('70 96 70')
  fireEvent.keyDown(screen.getByRole('tab', { name: /先改指向/ }), { key: 'End' })
  submit('2')
  expect(screen.getByText('你已完成結構的函式傳遞與 typedef。')).toBeInTheDocument()
  expect(getCourseProgress(loadProgress())).toMatchObject({ totalLessons: 35, totalChallenges: 105, completedChallenges: 3 })
  view.unmount()
  renderLesson()
  expect(screen.getByRole('combobox', { name: '型別寫法' })).toHaveValue('tag')
  expect(screen.getByRole('combobox', { name: 'update 內的順序' })).toHaveValue('rebind-first')
  expect(screen.getByRole('slider', { name: 'revise 寫入的分數' })).toHaveValue('0')
  expect(screen.getByRole('slider', { name: 'update 寫入的分數' })).toHaveValue('100')
  expect(screen.getByLabelText('本單元學習進度')).toHaveTextContent('單元完成')
})

it('restores saved settings across tabs and stops showing guided progress after clearing', () => {
  renderLesson()
  const savedState = { typeName: 'tag', writeOrder: 'rebind-first', previewScore: 81, writeScore: 93 }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, lastVisitedLessonId: 'structures-functions', lessons: {
    'structures-functions': { guidedRunCompleted: true, completedChallengeIds: [], savedState },
  } }))
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })))
  expect(screen.getByRole('combobox', { name: '型別寫法' })).toHaveValue('tag')
  expect(screen.getByRole('button', { name: /執行下一步/ })).toBeEnabled()
  act(() => {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY }))
  })
  expect(screen.getByRole('combobox', { name: '型別寫法' })).toHaveValue('alias')
  expect(screen.queryByRole('button', { name: /執行下一步/ })).not.toBeInTheDocument()
  expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
})
