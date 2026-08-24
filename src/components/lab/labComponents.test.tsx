import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ChallengePanel } from './ChallengePanel'
import { LabShell } from './LabShell'
import { PlaybackControls } from './PlaybackControls'
import { SourceCodePanel } from './SourceCodePanel'
import type { ChallengePanelItem, SourceCodeLine } from './types'

describe('LabShell', () => {
  it('provides stable semantic regions and class hooks', () => {
    const { container } = render(
      <LabShell
        controls={<label>型別<input /></label>}
        controlsLabel="變數控制參數"
        playback={<button type="button">播放</button>}
        footer={<p>重點回顧</p>}
        className="variables-lab"
      >
        <section>記憶盒</section>
      </LabShell>,
    )

    expect(screen.getByRole('complementary', { name: '變數控制參數' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument()
    expect(screen.getByText('記憶盒')).toBeInTheDocument()
    expect(screen.getByText('重點回顧').closest('footer')).toHaveClass('lab-shell__footer')
    expect(container.firstElementChild).toHaveClass('lab-shell', 'variables-lab')
  })
})

describe('SourceCodePanel', () => {
  it('highlights only the exact active line and source part', () => {
    type Part = 'declaration' | 'expression' | 'terminator'
    const lines: readonly SourceCodeLine<Part>[] = [
      {
        lineNumber: 1,
        parts: [{ id: 'declaration', text: 'int main(void) {' }],
      },
      {
        lineNumber: 2,
        parts: [
          { id: 'declaration', text: '  int result = ' },
          { id: 'expression', text: 'x + y' },
          { id: 'terminator', text: ';' },
        ],
      },
    ]

    const { container } = render(
      <SourceCodePanel
        lines={lines}
        activeLine={2}
        activePart="expression"
        status="計算算式"
        explanation="先算出右側，再存入 result。"
      />,
    )

    const firstLine = container.querySelector('[data-line="1"]')
    const secondLine = container.querySelector('[data-line="2"]')
    expect(firstLine).not.toHaveClass('is-active')
    expect(secondLine).toHaveClass('is-active')
    expect(secondLine).toHaveAttribute('aria-current', 'step')

    const expression = container.querySelector('[data-part="expression"]')
    const declaration = secondLine?.querySelector('[data-part="declaration"]')
    expect(expression).toHaveClass('is-active')
    expect(expression).toHaveAttribute('data-active', 'true')
    expect(declaration).not.toHaveClass('is-active')
    expect(screen.getByLabelText('C 程式碼，目前執行第 2 行')).toHaveTextContent(
      'int result = x + y;',
    )
  })
})

describe('PlaybackControls', () => {
  it('exposes playback actions and the three pressed speed controls', async () => {
    const user = userEvent.setup()
    const actions = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onNext: vi.fn(),
      onReset: vi.fn(),
      onReplay: vi.fn(),
      onSpeedChange: vi.fn(),
    }
    const { rerender } = render(
      <PlaybackControls
        playing={false}
        atStart={false}
        atEnd={false}
        speed={1}
        {...actions}
      />,
    )

    await user.click(screen.getByRole('button', { name: '開始播放' }))
    await user.click(screen.getByRole('button', { name: '執行下一步' }))
    await user.click(screen.getByRole('button', { name: '回到第一步' }))
    expect(actions.onPlay).toHaveBeenCalledOnce()
    expect(actions.onNext).toHaveBeenCalledOnce()
    expect(actions.onReset).toHaveBeenCalledOnce()

    const speedGroup = screen.getByRole('radiogroup', { name: '播放速度' })
    const speedButtons = within(speedGroup).getAllByRole('button')
    expect(speedButtons).toHaveLength(3)
    expect(within(speedGroup).getByRole('button', { name: '1 倍速' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(speedGroup).getByRole('button', { name: '2 倍速' }))
    expect(actions.onSpeedChange).toHaveBeenCalledWith(2)

    rerender(
      <PlaybackControls
        playing={false}
        atStart={false}
        atEnd
        speed={2}
        {...actions}
      />,
    )
    await user.click(screen.getByRole('button', { name: '重新播放' }))
    expect(actions.onReplay).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '執行下一步' })).toBeDisabled()
  })
})

describe('ChallengePanel', () => {
  const challenges: readonly ChallengePanelItem<'predict' | 'adjust' | 'debug'>[] = [
    { id: 'predict', label: '先預測', eyebrow: 'CHALLENGE 01' },
    { id: 'adjust', label: '調參數', eyebrow: 'CHALLENGE 02', disabled: true },
    { id: 'debug', label: '找錯誤', eyebrow: 'CHALLENGE 03', completed: true },
  ]

  function ChallengeHarness() {
    const [activeId, setActiveId] = useState<(typeof challenges)[number]['id']>('predict')
    return (
      <ChallengePanel
        challenges={challenges}
        activeId={activeId}
        onSelect={setActiveId}
        label="變數與運算挑戰"
      >
        {(challenge) => <p>{challenge.label}的內容</p>}
      </ChallengePanel>
    )
  }

  it('links each tab to its panel and supports arrows, Home, and End', async () => {
    const user = userEvent.setup()
    render(<ChallengeHarness />)

    const tablist = screen.getByRole('tablist', { name: '變數與運算挑戰' })
    const predictTab = within(tablist).getByRole('tab', { name: /先預測/ })
    const debugTab = within(tablist).getByRole('tab', { name: /找錯誤/ })
    let panel = screen.getByRole('tabpanel')

    expect(predictTab).toHaveAttribute('aria-selected', 'true')
    expect(predictTab).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', predictTab.id)

    predictTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(debugTab).toHaveFocus()
    expect(debugTab).toHaveAttribute('aria-selected', 'true')
    panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('找錯誤的內容')
    expect(debugTab).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', debugTab.id)

    await user.keyboard('{Home}')
    expect(predictTab).toHaveFocus()
    await user.keyboard('{End}')
    expect(debugTab).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(predictTab).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(debugTab).toHaveFocus()
  })
})
