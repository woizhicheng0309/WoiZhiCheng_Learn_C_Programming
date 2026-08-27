import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CONDITIONAL_CHALLENGE_IDS } from '../data/conditionalChallenges'
import { ProgressProvider } from '../hooks/useLearningProgress'
import { PROGRESS_STORAGE_KEY } from '../state'
import { ConditionalsLessonPage } from './ConditionalsLessonPage'

function renderLesson() {
  return render(
    <ProgressProvider>
      <MemoryRouter initialEntries={['/learn/conditionals/if-else']}>
        <ConditionalsLessonPage />
      </MemoryRouter>
    </ProgressProvider>,
  )
}

function chooseGuidedBranch(branch: 'if' | 'else') {
  const form = screen.getByRole('form', { name: '課程預測' })
  fireEvent.click(within(form).getByRole('radio', { name: new RegExp(`^${branch}`) }))
  fireEvent.click(within(form).getByRole('button', { name: /提交預測/ }))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ConditionalsLessonPage', () => {
  it('requires a branch prediction before unlocking the execution player', () => {
    renderLesson()

    expect(screen.getByRole('heading', { name: /讓程式學會選擇/ })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('提交上方預測後解鎖播放')
    expect(screen.getByLabelText(/C 程式碼，目前執行第 3 行/)).toHaveTextContent('int main(void)')

    chooseGuidedBranch('else')

    expect(screen.getByRole('button', { name: '執行下一步' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('預測正確')
  })

  it('steps through the default else branch and synchronizes the output panel', () => {
    renderLesson()
    chooseGuidedBranch('else')

    for (let index = 0; index < 6; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
    }

    expect(screen.getByLabelText(/C 程式碼，目前執行第 9 行/)).toHaveTextContent('} else {')
    expect(screen.getByRole('heading', { name: '條件與分支' })).toBeInTheDocument()
    expect(screen.getByText('else · 再練習')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
    expect(screen.getByLabelText(/C 程式碼，目前執行第 10 行/)).toHaveTextContent('再練習')
    expect(screen.getByText('再練習', { selector: '.conditionals-result-grid code' })).toBeInTheDocument()
  })

  it('completes all three challenges and persists their ids', () => {
    renderLesson()

    chooseGuidedBranch('else')
    const firstChallenge = screen.getByRole('tabpanel')
    fireEvent.click(within(firstChallenge).getByRole('radio', { name: /^else/ }))
    fireEvent.click(screen.getByRole('button', { name: /提交並揭曉/ }))

    fireEvent.click(screen.getByRole('tab', { name: /讓兩關都通過/ }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'score' }), { target: { value: '60' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'attendance' }), { target: { value: '70' } })
    fireEvent.click(screen.getByRole('button', { name: '檢查實際輸出' }))

    fireEvent.click(screen.getByRole('tab', { name: /找出過寬規則/ }))
    fireEvent.click(screen.getByRole('radio', { name: /\|\| 只要一邊/ }))
    fireEvent.click(screen.getByRole('radio', { name: '&&' }))
    fireEvent.click(screen.getByRole('button', { name: '檢查診斷與修正' }))

    expect(screen.getByRole('heading', { name: /你已完成條件判斷單元/ })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')).toMatchObject({
      lessons: {
        'conditionals-if-else': {
          completedChallengeIds: CONDITIONAL_CHALLENGE_IDS,
          savedState: { score: 72, attendance: 65, logicalOperator: '&&' },
        },
      },
    })
  })

  it('changes the source and branch result when controls change', () => {
    renderLesson()

    fireEvent.change(screen.getByRole('spinbutton', { name: 'score 分數' }), { target: { value: '100' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'attendance 出席率' }), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('radio', { name: /兩邊都要真/ }))
    chooseGuidedBranch('if')

    for (let index = 0; index < 6; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: '執行下一步' }))
    }

    expect(screen.getByText('if · 通過')).toBeInTheDocument()
    expect(screen.getByLabelText(/C 程式碼，目前執行第 7 行/)).toHaveTextContent('int score = 100;')
  })

  it('clears the conditionals progress after confirmation', () => {
    renderLesson()
    fireEvent.click(screen.getByRole('button', { name: /清除這台裝置的學習進度/ }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '確定清除' }))

    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('提交上方預測後解鎖播放')
  })
})
