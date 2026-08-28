import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { NestedLoopLab } from './NestedLoopLab'

function nestedRegion() {
  return screen.getByRole('region', {
    name: /一個迴圈走過每一列/,
  })
}

function setDimension(name: RegExp, value: number) {
  fireEvent.change(within(nestedRegion()).getByRole('spinbutton', { name }), {
    target: { value: String(value) },
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('NestedLoopLab', () => {
  it('renders the complete table as the main stage before the source fragment', () => {
    render(<NestedLoopLab />)
    const region = nestedRegion()

    expect(within(region).getByRole('table', {
      name: '9 × 9 乘法表，已完成 0 格',
    })).toBeInTheDocument()
    expect(within(region).getByText('81')).toBeInTheDocument()
    expect(within(region).getByLabelText('巢狀 for 迴圈 C 程式片段'))
      .toHaveTextContent('int a = 9;')
    expect(within(region).getByLabelText('巢狀 for 迴圈 C 程式片段'))
      .toHaveTextContent('int b = 9;')

    const scrollRegion = within(region).getByRole('region', {
      name: '9 × 9 乘法表檢視區；小螢幕可左右捲動',
    })
    expect(scrollRegion).toHaveAttribute('tabindex', '0')
    const tablePanel = within(region).getByRole('heading', {
      name: '9 × 9 乘法表',
    }).closest('section')
    const codePanel = within(region).getByRole('heading', {
      name: '核心迴圈片段',
    }).closest('section')
    expect(tablePanel).not.toBeNull()
    expect(codePanel).not.toBeNull()
    if (!tablePanel || !codePanel) throw new Error('乘法表與程式片段面板應該存在')
    expect(tablePanel.compareDocumentPosition(codePanel)
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(region).getByLabelText('1 乘以 2，尚未執行'))
      .toHaveAccessibleName('1 乘以 2，尚未執行')
  })

  it('reveals cells in row-major order and marks the active source and cell', () => {
    render(<NestedLoopLab />)
    setDimension(/外層上限 a/, 2)
    setDimension(/內層上限 b/, 2)
    const region = nestedRegion()
    const next = within(region).getByRole('button', {
      name: '巢狀迴圈：執行下一步',
    })

    fireEvent.click(next)
    expect(within(region).getByLabelText('1 乘以 1 等於 1，目前執行'))
      .toHaveAttribute('aria-current', 'step')
    expect(region.querySelector('.nested-source [aria-current="step"]'))
      .toHaveTextContent('printf')

    fireEvent.click(next)
    expect(within(region).getByLabelText('1 乘以 2 等於 2，目前執行'))
      .toHaveAttribute('aria-current', 'step')

    fireEvent.click(next)
    expect(within(region).getByLabelText('2 乘以 1 等於 2，目前執行'))
      .toHaveAttribute('aria-current', 'step')

    fireEvent.click(next)
    fireEvent.click(next)
    expect(within(region).getByRole('table', {
      name: '2 × 2 乘法表，已完成 4 格',
    })).toBeInTheDocument()
    expect(within(region).getByText(/完成 4 次乘法/, {
      selector: '.nested-explanation p',
    })).toBeInTheDocument()
    expect(next).toBeDisabled()
  })

  it('stops and resets the trace immediately when a dimension changes', () => {
    vi.useFakeTimers()
    render(<NestedLoopLab />)
    setDimension(/外層上限 a/, 2)
    setDimension(/內層上限 b/, 2)
    const region = nestedRegion()

    fireEvent.click(within(region).getByRole('button', {
      name: '巢狀迴圈：開始播放',
    }))
    act(() => vi.advanceTimersByTime(560))
    expect(within(region).getByRole('table', {
      name: '2 × 2 乘法表，已完成 1 格',
    })).toBeInTheDocument()

    setDimension(/外層上限 a/, 3)
    expect(within(region).getByRole('button', {
      name: '巢狀迴圈：開始播放',
    })).toBeInTheDocument()
    expect(within(region).getByRole('table', {
      name: '3 × 2 乘法表，已完成 0 格',
    })).toBeInTheDocument()
    expect(region.querySelector('td[aria-current="step"]')).not.toBeInTheDocument()
  })

  it('supports named speed controls, playback, pause, and replay', () => {
    vi.useFakeTimers()
    render(<NestedLoopLab />)
    setDimension(/外層上限 a/, 1)
    setDimension(/內層上限 b/, 1)
    const region = nestedRegion()
    const speedGroup = within(region).getByRole('radiogroup', {
      name: '巢狀迴圈：播放速度',
    })

    expect(within(speedGroup).getByRole('button', {
      name: '巢狀迴圈：1 倍速',
    })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(speedGroup).getByRole('button', {
      name: '巢狀迴圈：2 倍速',
    }))
    expect(within(speedGroup).getByRole('button', {
      name: '巢狀迴圈：2 倍速',
    })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(region).getByRole('button', {
      name: '巢狀迴圈：開始播放',
    }))
    expect(within(region).getByText('正在自動播放巢狀迴圈；完成後會播報結果。'))
      .toBeInTheDocument()
    act(() => vi.advanceTimersByTime(280))
    expect(within(region).getByRole('table', {
      name: '1 × 1 乘法表，已完成 1 格',
    })).toBeInTheDocument()

    fireEvent.click(within(region).getByRole('button', {
      name: '巢狀迴圈：暫停播放',
    }))
    act(() => vi.advanceTimersByTime(1120))
    expect(within(region).getByRole('table', {
      name: '1 × 1 乘法表，已完成 1 格',
    })).toBeInTheDocument()

    fireEvent.click(within(region).getByRole('button', {
      name: '巢狀迴圈：執行下一步',
    }))
    fireEvent.click(within(region).getByRole('button', {
      name: '巢狀迴圈：重新播放',
    }))
    act(() => vi.advanceTimersByTime(280))
    expect(within(region).getByRole('table', {
      name: '1 × 1 乘法表，已完成 1 格',
    })).toBeInTheDocument()
  })
})
