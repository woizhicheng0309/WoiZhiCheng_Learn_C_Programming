export {
  buildForLoopSource,
  compareLoopValue,
  simulateForLoop,
  validateLoopConfig,
} from './loopSimulator'

export {
  COMPARATORS,
  DEFAULT_LOOP_CONFIG,
  LOOP_LIMITS,
  type Comparator,
  type CSourceLine,
  type CSourcePart,
  type GeneratedLoopSource,
  type LoopConfig,
  type LoopFrame,
  type LoopPhase,
  type LoopTraceRow,
  type LoopValidationIssue,
  type SimulationBlockReason,
  type SimulationResult,
  type SimulationStatus,
} from './types'

export * from './variables'
