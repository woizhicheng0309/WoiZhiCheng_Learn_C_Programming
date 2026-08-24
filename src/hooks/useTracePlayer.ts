import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ExecutionFrame,
  TerminalExecutionPhase,
} from '../components/lab/types'

export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export interface UseTracePlayerOptions<Frame extends ExecutionFrame> {
  frames: readonly Frame[]
  speed: PlaybackSpeed
  /**
   * Pass the simulator config (or another stable identity) so a new config
   * resets the trace even if a caller deliberately reuses the frames array.
   */
  config?: unknown
  baseDelayMs?: number
  terminalPhases?: readonly TerminalExecutionPhase[]
}

export interface TracePlayer<Frame extends ExecutionFrame> {
  frame: Frame | null
  frameIndex: number
  playing: boolean
  atStart: boolean
  atEnd: boolean
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  reset: () => void
  replay: () => void
}

const DEFAULT_BASE_DELAY_MS = 760
const DEFAULT_TERMINAL_PHASES: readonly TerminalExecutionPhase[] = [
  'done',
  'blocked',
]

export function useTracePlayer<Frame extends ExecutionFrame>({
  frames,
  speed,
  config,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  terminalPhases = DEFAULT_TERMINAL_PHASES,
}: UseTracePlayerOptions<Frame>): TracePlayer<Frame> {
  const [player, setPlayer] = useState(() => ({
    frameIndex: 0,
    playing: false,
    framesIdentity: frames,
    configIdentity: config,
  }))

  const identityMatches = player.framesIdentity === frames
    && Object.is(player.configIdentity, config)
  const frameIndex = identityMatches ? player.frameIndex : 0
  const playing = identityMatches ? player.playing : false

  const lastIndex = Math.max(0, frames.length - 1)
  const boundedIndex = Math.min(frameIndex, lastIndex)
  const frame = frames[boundedIndex] ?? null
  const isTerminal = useCallback(
    (candidate: Frame | null) => (
      candidate !== null
      && terminalPhases.includes(candidate.phase as TerminalExecutionPhase)
    ),
    [terminalPhases],
  )
  const atStart = boundedIndex === 0
  const atEnd = frames.length === 0 || boundedIndex >= lastIndex || isTerminal(frame)

  useEffect(() => {
    if (!playing || atEnd || frame === null) return

    const delay = baseDelayMs / speed
    const nextIndex = Math.min(boundedIndex + 1, lastIndex)
    const nextFrame = frames[nextIndex] ?? null
    const timer = window.setTimeout(() => {
      setPlayer({
        frameIndex: nextIndex,
        playing: !(nextIndex >= lastIndex || isTerminal(nextFrame)),
        framesIdentity: frames,
        configIdentity: config,
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [
    atEnd,
    baseDelayMs,
    boundedIndex,
    config,
    frame,
    frames,
    isTerminal,
    lastIndex,
    playing,
    speed,
  ])

  const reset = useCallback(() => {
    setPlayer({
      frameIndex: 0,
      playing: false,
      framesIdentity: frames,
      configIdentity: config,
    })
  }, [config, frames])

  const pause = useCallback(() => {
    setPlayer({
      frameIndex: boundedIndex,
      playing: false,
      framesIdentity: frames,
      configIdentity: config,
    })
  }, [boundedIndex, config, frames])

  const play = useCallback(() => {
    if (frames.length === 0) return
    const startingAtFirstFrame = atEnd
    const canAdvanceFromFirstFrame = frames.length > 1 && !isTerminal(frames[0] ?? null)
    setPlayer({
      frameIndex: startingAtFirstFrame ? 0 : boundedIndex,
      playing: startingAtFirstFrame ? canAdvanceFromFirstFrame : true,
      framesIdentity: frames,
      configIdentity: config,
    })
  }, [atEnd, boundedIndex, config, frames, isTerminal])

  const replay = useCallback(() => {
    if (frames.length === 0) return
    setPlayer({
      frameIndex: 0,
      playing: frames.length > 1 && !isTerminal(frames[0] ?? null),
      framesIdentity: frames,
      configIdentity: config,
    })
  }, [config, frames, isTerminal])

  const next = useCallback(() => {
    const nextIndex = (
      frames.length === 0 || isTerminal(frames[boundedIndex] ?? null)
    )
      ? boundedIndex
      : Math.min(boundedIndex + 1, lastIndex)
    setPlayer({
      frameIndex: nextIndex,
      playing: false,
      framesIdentity: frames,
      configIdentity: config,
    })
  }, [boundedIndex, config, frames, isTerminal, lastIndex])

  const toggle = useCallback(() => {
    if (playing) pause()
    else play()
  }, [pause, play, playing])

  return useMemo(() => ({
    frame,
    frameIndex: boundedIndex,
    playing,
    atStart,
    atEnd,
    play,
    pause,
    toggle,
    next,
    reset,
    replay,
  }), [
    atEnd,
    atStart,
    boundedIndex,
    frame,
    next,
    pause,
    play,
    playing,
    replay,
    reset,
    toggle,
  ])
}
