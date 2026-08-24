export const VARIABLE_VALUE_TYPES = ['int', 'double'] as const

export type VariableValueType = (typeof VARIABLE_VALUE_TYPES)[number]

export const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%'] as const

export type ArithmeticOperator = (typeof ARITHMETIC_OPERATORS)[number]

export interface VariableConfig {
  valueType: VariableValueType
  x: number
  y: number
  operator: ArithmeticOperator
}

export const VARIABLE_LIMITS = {
  x: { min: -20, max: 20 },
  y: { min: -20, max: 20 },
  doubleStep: 0.5,
} as const

export const DEFAULT_VARIABLE_CONFIG: Readonly<VariableConfig> = {
  valueType: 'int',
  x: 5,
  y: 2,
  operator: '+',
}

export type VariablePhase =
  | 'main'
  | 'init-x'
  | 'init-y'
  | 'declare-result'
  | 'evaluate'
  | 'assign'
  | 'print'
  | 'return'
  | 'done'
  | 'blocked'

export type VariableSourcePart =
  | 'main-signature'
  | 'x-initializer'
  | 'y-initializer'
  | 'result-declaration'
  | 'expression'
  | 'assignment'
  | 'printf'
  | 'return'
  | 'exit'

export interface VariableSourceLine {
  lineNumber: number
  code: string
  phases: readonly VariablePhase[]
}

export interface GeneratedVariableSource {
  lines: readonly VariableSourceLine[]
  lineByPhase: Readonly<Record<VariablePhase, number>>
  partByPhase: Readonly<Record<VariablePhase, VariableSourcePart>>
  expression: string
  printFormat: '%d' | '%g'
}

export interface VariableMemoryCell {
  declared: boolean
  initialized: boolean
  valueType: VariableValueType | null
  value: number | null
}

export interface VariableMemorySnapshot {
  x: Readonly<VariableMemoryCell>
  y: Readonly<VariableMemoryCell>
  result: Readonly<VariableMemoryCell>
}

export interface VariableFrame {
  /** Stable index within the complete execution trace. */
  index: number
  phase: VariablePhase
  memoryBefore: Readonly<VariableMemorySnapshot>
  memoryAfter: Readonly<VariableMemorySnapshot>
  expression: string
  resolvedExpression: string | null
  evaluatedValue: number | null
  output: readonly number[]
  activeLine: number
  activePart: VariableSourcePart
  explanation: string
}

export type VariableSimulationStatus = 'completed' | 'blocked'

export type VariableBlockReason =
  | 'invalid-number'
  | 'x-out-of-range'
  | 'y-out-of-range'
  | 'int-requires-integer'
  | 'double-requires-half-step'
  | 'double-modulo'
  | 'division-by-zero'
  | 'invalid-result'

export interface VariableValidationIssue {
  code: Exclude<VariableBlockReason, 'invalid-result'>
  message: string
}

export interface VariableSimulationResult {
  config: Readonly<VariableConfig>
  source: GeneratedVariableSource
  frames: readonly VariableFrame[]
  output: readonly number[]
  resultValue: number | null
  status: VariableSimulationStatus
  blockReason: VariableBlockReason | null
  message: string
}

const LINE_BY_PHASE: Readonly<Record<VariablePhase, number>> = {
  main: 3,
  'init-x': 4,
  'init-y': 5,
  'declare-result': 6,
  evaluate: 7,
  assign: 7,
  print: 8,
  return: 9,
  done: 10,
  blocked: 7,
}

const PART_BY_PHASE: Readonly<Record<VariablePhase, VariableSourcePart>> = {
  main: 'main-signature',
  'init-x': 'x-initializer',
  'init-y': 'y-initializer',
  'declare-result': 'result-declaration',
  evaluate: 'expression',
  assign: 'assignment',
  print: 'printf',
  return: 'return',
  done: 'exit',
  blocked: 'expression',
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

export function formatVariableNumber(value: number): string {
  if (Object.is(value, -0)) return '0'
  if (!Number.isFinite(value)) return String(value)
  if (Number.isInteger(value)) return String(value)

  return String(Number(value.toPrecision(12)))
}

function formatLiteral(value: number, valueType: VariableValueType): string {
  const formatted = formatVariableNumber(value)
  if (valueType === 'double' && Number.isInteger(value)) return `${formatted}.0`
  return formatted
}

function copyConfig(config: VariableConfig): Readonly<VariableConfig> {
  return {
    valueType: config.valueType,
    x: config.x,
    y: config.y,
    operator: config.operator,
  }
}

function emptyCell(): VariableMemoryCell {
  return {
    declared: false,
    initialized: false,
    valueType: null,
    value: null,
  }
}

function emptyMemory(): VariableMemorySnapshot {
  return {
    x: emptyCell(),
    y: emptyCell(),
    result: emptyCell(),
  }
}

function cloneCell(cell: Readonly<VariableMemoryCell>): VariableMemoryCell {
  return { ...cell }
}

function cloneMemory(
  memory: Readonly<VariableMemorySnapshot>,
): VariableMemorySnapshot {
  return {
    x: cloneCell(memory.x),
    y: cloneCell(memory.y),
    result: cloneCell(memory.result),
  }
}

function isHalfStep(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < Number.EPSILON * 8
}

export function validateVariableConfig(
  config: VariableConfig,
): readonly VariableValidationIssue[] {
  if (!Number.isFinite(config.x) || !Number.isFinite(config.y)) {
    return [{ code: 'invalid-number', message: 'x 與 y 都必須是有限數字。' }]
  }

  const issues: VariableValidationIssue[] = []

  if (config.x < VARIABLE_LIMITS.x.min || config.x > VARIABLE_LIMITS.x.max) {
    issues.push({
      code: 'x-out-of-range',
      message: `x 必須介於 ${VARIABLE_LIMITS.x.min} 到 ${VARIABLE_LIMITS.x.max}。`,
    })
  }

  if (config.y < VARIABLE_LIMITS.y.min || config.y > VARIABLE_LIMITS.y.max) {
    issues.push({
      code: 'y-out-of-range',
      message: `y 必須介於 ${VARIABLE_LIMITS.y.min} 到 ${VARIABLE_LIMITS.y.max}。`,
    })
  }

  if (
    config.valueType === 'int' &&
    (!Number.isInteger(config.x) || !Number.isInteger(config.y))
  ) {
    issues.push({
      code: 'int-requires-integer',
      message: 'int 只能儲存整數，請將 x 與 y 設為整數。',
    })
  }

  if (
    config.valueType === 'double' &&
    (!isHalfStep(config.x) || !isHalfStep(config.y))
  ) {
    issues.push({
      code: 'double-requires-half-step',
      message: `這個練習中的 double 請以 ${VARIABLE_LIMITS.doubleStep} 為單位調整。`,
    })
  }

  if (config.valueType === 'double' && config.operator === '%') {
    issues.push({
      code: 'double-modulo',
      message: 'C 語言的 % 只能用於整數；double 必須改用其他運算子。',
    })
  }

  if ((config.operator === '/' || config.operator === '%') && config.y === 0) {
    issues.push({
      code: 'division-by-zero',
      message: '除數 y 是 0，除法或取餘數沒有合法結果，因此已阻止執行。',
    })
  }

  return issues
}

export function buildVariableSource(
  config: VariableConfig = DEFAULT_VARIABLE_CONFIG,
): GeneratedVariableSource {
  const expression = `x ${config.operator} y`
  const printFormat = config.valueType === 'int' ? '%d' : '%g'

  return {
    lines: [
      { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
      { lineNumber: 2, code: '', phases: [] },
      { lineNumber: 3, code: 'int main(void) {', phases: ['main'] },
      {
        lineNumber: 4,
        code: `  ${config.valueType} x = ${formatLiteral(config.x, config.valueType)};`,
        phases: ['init-x'],
      },
      {
        lineNumber: 5,
        code: `  ${config.valueType} y = ${formatLiteral(config.y, config.valueType)};`,
        phases: ['init-y'],
      },
      {
        lineNumber: 6,
        code: `  ${config.valueType} result;`,
        phases: ['declare-result'],
      },
      {
        lineNumber: 7,
        code: `  result = ${expression};`,
        phases: ['evaluate', 'assign', 'blocked'],
      },
      {
        lineNumber: 8,
        code: `  printf("${printFormat}\\n", result);`,
        phases: ['print'],
      },
      { lineNumber: 9, code: '  return 0;', phases: ['return'] },
      { lineNumber: 10, code: '}', phases: ['done'] },
    ],
    lineByPhase: LINE_BY_PHASE,
    partByPhase: PART_BY_PHASE,
    expression,
    printFormat,
  }
}

export function evaluateVariableExpression(config: VariableConfig): number {
  let result: number

  switch (config.operator) {
    case '+':
      result = config.x + config.y
      break
    case '-':
      result = config.x - config.y
      break
    case '*':
      result = config.x * config.y
      break
    case '/':
      result = config.x / config.y
      if (config.valueType === 'int') result = Math.trunc(result)
      break
    case '%':
      result = config.x % config.y
      break
  }

  return normalizeZero(result)
}

function isStructuralIssue(issue: VariableValidationIssue): boolean {
  return (
    issue.code === 'invalid-number' ||
    issue.code === 'x-out-of-range' ||
    issue.code === 'y-out-of-range' ||
    issue.code === 'int-requires-integer' ||
    issue.code === 'double-requires-half-step'
  )
}

export function simulateVariableProgram(
  config: VariableConfig = DEFAULT_VARIABLE_CONFIG,
): VariableSimulationResult {
  const stableConfig = copyConfig(config)
  const source = buildVariableSource(stableConfig)
  const frames: VariableFrame[] = []
  const output: number[] = []
  let memory = emptyMemory()
  let evaluatedValue: number | null = null

  const addFrame = (
    phase: VariablePhase,
    explanation: string,
    mutate?: (nextMemory: VariableMemorySnapshot) => void,
  ) => {
    const memoryBefore = cloneMemory(memory)
    const memoryAfter = cloneMemory(memory)
    mutate?.(memoryAfter)
    memory = memoryAfter

    frames.push({
      index: frames.length,
      phase,
      memoryBefore,
      memoryAfter: cloneMemory(memoryAfter),
      expression: source.expression,
      resolvedExpression:
        Number.isFinite(stableConfig.x) && Number.isFinite(stableConfig.y)
          ? `${formatVariableNumber(stableConfig.x)} ${stableConfig.operator} ${formatVariableNumber(stableConfig.y)}`
          : null,
      evaluatedValue,
      output: [...output],
      activeLine: source.lineByPhase[phase],
      activePart: source.partByPhase[phase],
      explanation,
    })
  }

  const blockedResult = (
    reason: VariableBlockReason,
    message: string,
  ): VariableSimulationResult => {
    addFrame('blocked', message)
    return {
      config: stableConfig,
      source,
      frames,
      output: [...output],
      resultValue: null,
      status: 'blocked',
      blockReason: reason,
      message,
    }
  }

  addFrame('main', '進入 main 函式，程式從這裡開始執行。')

  const validationIssues = validateVariableConfig(stableConfig)
  const structuralIssue = validationIssues.find(isStructuralIssue)
  if (structuralIssue) {
    return blockedResult(structuralIssue.code, structuralIssue.message)
  }

  addFrame('init-x', `宣告 ${stableConfig.valueType} x，並初始化為 ${formatVariableNumber(stableConfig.x)}。`, (next) => {
    next.x = {
      declared: true,
      initialized: true,
      valueType: stableConfig.valueType,
      value: stableConfig.x,
    }
  })

  addFrame('init-y', `宣告 ${stableConfig.valueType} y，並初始化為 ${formatVariableNumber(stableConfig.y)}。`, (next) => {
    next.y = {
      declared: true,
      initialized: true,
      valueType: stableConfig.valueType,
      value: stableConfig.y,
    }
  })

  addFrame('declare-result', `宣告 ${stableConfig.valueType} result；此時尚未賦值，不能拿來輸出。`, (next) => {
    next.result = {
      declared: true,
      initialized: false,
      valueType: stableConfig.valueType,
      value: null,
    }
  })

  const operationIssue = validationIssues.find((issue) => !isStructuralIssue(issue))
  if (operationIssue) {
    return blockedResult(operationIssue.code, operationIssue.message)
  }

  evaluatedValue = evaluateVariableExpression(stableConfig)
  if (!Number.isFinite(evaluatedValue)) {
    const message = '算式產生了非有限數值，無法安全地存入 result。'
    return blockedResult('invalid-result', message)
  }

  addFrame(
    'evaluate',
    `計算 ${formatVariableNumber(stableConfig.x)} ${stableConfig.operator} ${formatVariableNumber(stableConfig.y)}，得到 ${formatVariableNumber(evaluatedValue)}。`,
  )

  addFrame(
    'assign',
    `將算式結果 ${formatVariableNumber(evaluatedValue)} 賦值給 result。`,
    (next) => {
      next.result = {
        declared: true,
        initialized: true,
        valueType: stableConfig.valueType,
        value: evaluatedValue,
      }
    },
  )

  output.push(evaluatedValue)
  addFrame(
    'print',
    `printf 讀取 result，輸出 ${formatVariableNumber(evaluatedValue)}。`,
  )
  addFrame('return', 'return 0 表示程式正常結束。')

  const message = `程式正常完成，輸出 ${formatVariableNumber(evaluatedValue)}。`
  addFrame('done', message)

  return {
    config: stableConfig,
    source,
    frames,
    output: [...output],
    resultValue: evaluatedValue,
    status: 'completed',
    blockReason: null,
    message,
  }
}
