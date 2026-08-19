export {
  buildForLoopSource,
  compareLoopValue,
  simulateForLoop,
  validateLoopConfig,
} from './loopSimulator'

export {
  ARITHMETIC_OPERATORS,
  ATTENDANCE_THRESHOLD,
  evaluateCourseCondition,
  evaluateIntegerExpression,
  LOGICAL_OPERATORS,
  SCORE_THRESHOLD,
  type ArithmeticOperator,
  type ConditionalEvaluation,
  type IntegerExpressionResult,
  type LogicalOperator,
} from './foundationSimulator'

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
  type LoopValidationIssue,
  type SimulationBlockReason,
  type SimulationResult,
  type SimulationStatus,
} from './types'
