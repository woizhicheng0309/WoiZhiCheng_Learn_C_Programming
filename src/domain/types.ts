export const COMPARATORS = ['<', '<=', '>', '>='] as const

export type Comparator = (typeof COMPARATORS)[number]

export interface LoopConfig {
  start: number
  end: number
  comparator: Comparator
  step: number
}

export const LOOP_LIMITS = {
  start: { min: -20, max: 20 },
  end: { min: -20, max: 20 },
  step: { min: -5, max: 5 },
  maxIterations: 100,
} as const

export const DEFAULT_LOOP_CONFIG: Readonly<LoopConfig> = {
  start: 0,
  end: 5,
  comparator: '<',
  step: 1,
}

export type LoopPhase =
  | 'init'
  | 'condition'
  | 'body'
  | 'increment'
  | 'done'
  | 'blocked'

export type CSourcePart =
  | 'initializer'
  | 'condition'
  | 'body'
  | 'increment'
  | 'exit'

export interface CSourceLine {
  lineNumber: number
  code: string
  phases: readonly LoopPhase[]
}

export interface GeneratedLoopSource {
  lines: readonly CSourceLine[]
  lineByPhase: Readonly<Record<LoopPhase, number>>
  partByPhase: Readonly<Record<LoopPhase, CSourcePart>>
  variableType: 'int' | 'double'
  conditionExpression: string
}

export interface LoopFrame {
  /** Stable index within the complete execution trace. */
  index: number
  phase: LoopPhase
  /** Number of loop bodies that have run, except body uses its one-based row number. */
  iteration: number
  currentValue: number
  conditionExpression: string
  conditionResult: boolean | null
  output: readonly number[]
  activeLine: number
  activePart: CSourcePart
  explanation: string
}

export interface LoopTraceRow {
  kind: 'iteration' | 'exit-check' | 'blocked-check'
  iteration: number | null
  conditionValue: number
  conditionExpression: string
  conditionResult: boolean
  printedValue: number | null
  afterValue: number | null
  conditionFrameIndex: number
  bodyFrameIndex: number | null
  incrementFrameIndex: number | null
}

export type SimulationStatus = 'completed' | 'blocked'

export type SimulationBlockReason =
  | 'invalid-number'
  | 'start-out-of-range'
  | 'end-out-of-range'
  | 'step-out-of-range'
  | 'step-zero'
  | 'wrong-direction'
  | 'iteration-limit'

export interface LoopValidationIssue {
  code: Exclude<
    SimulationBlockReason,
    'step-zero' | 'wrong-direction' | 'iteration-limit'
  >
  message: string
}

export interface SimulationResult {
  config: Readonly<LoopConfig>
  source: GeneratedLoopSource
  frames: readonly LoopFrame[]
  traceRows: readonly LoopTraceRow[]
  output: readonly number[]
  iterations: number
  status: SimulationStatus
  blockReason: SimulationBlockReason | null
  message: string
}
