import type { ReactNode } from 'react'

export type TerminalExecutionPhase = 'done' | 'blocked'

/**
 * The UI-facing portion of every lesson frame. Lesson-specific frames extend
 * this shape with their own memory, output, or trace data.
 */
export interface ExecutionFrame<
  Phase extends string = string,
  SourcePart extends string = string,
> {
  /** Stable zero-based position inside the complete execution trace. */
  index: number
  phase: Phase
  activeLine: number
  activePart: SourcePart | null
  explanation: string
}

export type SimulationCompletionStatus = 'completed' | 'blocked'

export interface LessonSimulation<
  Config,
  Frame extends ExecutionFrame,
  Output,
> {
  config: Readonly<Config>
  frames: readonly Frame[]
  output: Output
  status: SimulationCompletionStatus
}

export type LessonSimulator<
  Config,
  Frame extends ExecutionFrame,
  Output,
  Result extends LessonSimulation<Config, Frame, Output> = LessonSimulation<
    Config,
    Frame,
    Output
  >,
> = (config: Config) => Result

export interface SourceCodePart<PartId extends string = string> {
  id: PartId
  text: string
}

export interface SourceCodeLine<PartId extends string = string> {
  lineNumber: number
  parts: readonly SourceCodePart<PartId>[]
}

export interface ChallengePanelItem<Id extends string = string> {
  id: Id
  label: string
  eyebrow?: string
  completed?: boolean
  disabled?: boolean
}

export type ChallengeTabRenderer<Id extends string = string> = (
  challenge: ChallengePanelItem<Id>,
  state: { selected: boolean },
) => ReactNode
