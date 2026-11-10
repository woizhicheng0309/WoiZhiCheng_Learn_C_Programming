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
export * from './conditionals'
export * from './functions'
export * from './arrays'
export * from './pointers'
export * from './swap'
export * from './traversal'
export * from './stringPointers'
export * from './whileLoops'
export * from './loopControl'

export {
  MULTIPLICATION_TABLE_LIMITS,
  simulateNestedMultiplicationTable,
  type MultiplicationCell,
  type NestedLoopFrame,
  type NestedLoopPhase,
  type NestedLoopSimulation,
  type NestedLoopSourcePart,
} from './nestedLoopSimulator'
export * from './switchBranching'
export * from './recursion'
export * from './matrices'
export * from './search'
export * from './binarySearch'
export * from './selectionSort'
export * from './insertionSort'
export * from './bubbleSort'
export * from './stringCopy'
export * from './arrayParameters'
export * from './stringComparison'
export * from './constPointers'
export * from './structures'
export * from './structureArrays'
export * from './structurePointers'
export * from './allocation'
export * from './reallocation'
export * from './fileReading'
export * from './fileCharacters'
export * from './integerParsing'
export * from './scoreFile'
export * from './structureFunctions'
