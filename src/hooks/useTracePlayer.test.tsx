import { act, renderHook } from '@testing-library/react'
import type { ExecutionFrame } from '../components/lab'
import { useTracePlayer, type PlaybackSpeed } from './useTracePlayer'

type TestPhase = 'init' | 'body' | 'done' | 'blocked' | 'after'

function makeFrame(index: number, phase: TestPhase): ExecutionFrame<TestPhase> {
  return {
    index,
    phase,
    activeLine: index + 1,
    activePart: null,
    explanation: phase,
  }
}

const completeFrames = [
  makeFrame(0, 'init'),
  makeFrame(1, 'body'),
  makeFrame(2, 'done'),
  makeFrame(3, 'after'),
] as const

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useTracePlayer', () => {
  it('supports next, reset, play, pause, and replay', () => {
    const { result } = renderHook(() => useTracePlayer({
      frames: completeFrames,
      speed: 1,
    }))

    expect(result.current.frame).toBe(completeFrames[0])
    expect(result.current.atStart).toBe(true)
    expect(result.current.atEnd).toBe(false)

    act(() => result.current.next())
    expect(result.current.frameIndex).toBe(1)
    expect(result.current.playing).toBe(false)

    act(() => result.current.play())
    expect(result.current.playing).toBe(true)
    act(() => result.current.pause())
    expect(result.current.playing).toBe(false)

    act(() => result.current.reset())
    expect(result.current.frameIndex).toBe(0)

    act(() => result.current.replay())
    expect(result.current.frameIndex).toBe(0)
    expect(result.current.playing).toBe(true)
  })

  it('uses speed to advance and stops on done before a later frame', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useTracePlayer({
      frames: completeFrames,
      speed: 2,
      baseDelayMs: 800,
    }))

    act(() => result.current.play())
    act(() => vi.advanceTimersByTime(399))
    expect(result.current.frameIndex).toBe(0)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.frameIndex).toBe(1)
    expect(result.current.playing).toBe(true)

    act(() => vi.advanceTimersByTime(400))
    expect(result.current.frameIndex).toBe(2)
    expect(result.current.frame?.phase).toBe('done')
    expect(result.current.atEnd).toBe(true)
    expect(result.current.playing).toBe(false)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.frameIndex).toBe(2)
  })

  it.each(['done', 'blocked'] as const)('single stepping cannot move past %s', (phase) => {
    const frames = [makeFrame(0, 'init'), makeFrame(1, phase), makeFrame(2, 'after')]
    const { result } = renderHook(() => useTracePlayer({ frames, speed: 1 }))

    act(() => result.current.next())
    expect(result.current.frame?.phase).toBe(phase)
    expect(result.current.atEnd).toBe(true)

    act(() => result.current.next())
    expect(result.current.frameIndex).toBe(1)
  })

  it.each(['done', 'blocked'] as const)('never reports playing for a terminal-only %s trace', (phase) => {
    const frames = [makeFrame(0, phase)]
    const { result } = renderHook(() => useTracePlayer({ frames, speed: 1 }))

    act(() => result.current.play())
    expect(result.current.playing).toBe(false)
    act(() => result.current.replay())
    expect(result.current.playing).toBe(false)
    expect(result.current.atEnd).toBe(true)
  })

  it('stops and resets when either frames or config identity changes', () => {
    const sharedConfig = { start: 0 }
    const { result, rerender } = renderHook(
      ({ frames, config }: { frames: readonly ExecutionFrame<TestPhase>[]; config: object }) => (
        useTracePlayer({ frames, config, speed: 1 })
      ),
      { initialProps: { frames: completeFrames, config: sharedConfig } },
    )

    act(() => result.current.next())
    act(() => result.current.play())
    expect(result.current.frameIndex).toBe(1)
    expect(result.current.playing).toBe(true)

    rerender({ frames: completeFrames, config: { start: 1 } })
    expect(result.current.frameIndex).toBe(0)
    expect(result.current.playing).toBe(false)

    act(() => result.current.next())
    rerender({ frames: [...completeFrames], config: sharedConfig })
    expect(result.current.frameIndex).toBe(0)
    expect(result.current.playing).toBe(false)
  })

  it('handles an empty trace without scheduling playback', () => {
    const { result } = renderHook(() => useTracePlayer({
      frames: [],
      speed: 0.5,
    }))

    expect(result.current.frame).toBeNull()
    expect(result.current.atStart).toBe(true)
    expect(result.current.atEnd).toBe(true)
    act(() => result.current.play())
    expect(result.current.playing).toBe(false)
  })

  it('keeps the same execution state when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const speed: PlaybackSpeed = 1
    const { result } = renderHook(() => useTracePlayer({
      frames: completeFrames,
      speed,
    }))

    act(() => result.current.next())
    expect(result.current.frameIndex).toBe(1)
    expect(result.current.frame).toBe(completeFrames[1])
  })
})
