import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import {
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
} from '../../hooks/useTracePlayer'

export interface PlaybackControlsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onReset'> {
  playing: boolean
  atStart: boolean
  atEnd: boolean
  speed: PlaybackSpeed
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onReset: () => void
  onReplay: () => void
  onSpeedChange: (speed: PlaybackSpeed) => void
}

function joinClassNames(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

export function PlaybackControls({
  playing,
  atStart,
  atEnd,
  speed,
  onPlay,
  onPause,
  onNext,
  onReset,
  onReplay,
  onSpeedChange,
  className,
  ...rest
}: PlaybackControlsProps) {
  const togglePlayback = playing ? onPause : atEnd ? onReplay : onPlay
  const toggleLabel = playing ? '暫停播放' : atEnd ? '重新播放' : '開始播放'

  return (
    <div
      className={joinClassNames('playback-controls', className)}
      aria-label="執行控制"
      {...rest}
    >
      <button
        type="button"
        className="playback-controls__button playback-controls__reset"
        onClick={onReset}
        disabled={atStart && !playing}
        aria-label="回到第一步"
      >
        <RotateCcw size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="playback-controls__button playback-controls__play"
        onClick={togglePlayback}
        aria-label={toggleLabel}
      >
        {playing
          ? <Pause size={19} aria-hidden="true" />
          : <Play size={19} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="playback-controls__button playback-controls__next"
        onClick={onNext}
        disabled={atEnd}
        aria-label="執行下一步"
      >
        <StepForward size={18} aria-hidden="true" />
      </button>
      <div
        className="playback-controls__speed"
        role="radiogroup"
        aria-label="播放速度"
      >
        {PLAYBACK_SPEEDS.map((option) => (
          <button
            type="button"
            className={joinClassNames(
              'playback-controls__speed-button',
              speed === option && 'is-active',
            )}
            aria-label={`${option} 倍速`}
            aria-pressed={speed === option}
            key={option}
            onClick={() => onSpeedChange(option)}
          >
            {option}×
          </button>
        ))}
      </div>
    </div>
  )
}
