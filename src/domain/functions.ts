export interface FunctionConfig {
  x: number
  y: number
}

export const FUNCTION_LIMITS = {
  x: { min: -20, max: 20 },
  y: { min: -20, max: 20 },
} as const

export const DEFAULT_FUNCTION_CONFIG: Readonly<FunctionConfig> = {
  x: 4,
  y: 3,
}

export type FunctionPhase =
  | 'enter-main'
  | 'init-x'
  | 'init-y'
  | 'call-add'
  | 'bind-parameters'
  | 'declare-result'
  | 'calculate-result'
  | 'return-add'
  | 'assign-answer'
  | 'print'
  | 'return-main'
  | 'done'
  | 'blocked'

export type FunctionSourcePart =
  | 'main-signature'
  | 'x-initializer'
  | 'y-initializer'
  | 'add-call'
  | 'parameters'
  | 'result-declaration'
  | 'result-expression'
  | 'add-return'
  | 'answer-assignment'
  | 'printf'
  | 'main-return'
  | 'exit'

export type FunctionName = 'main' | 'add'

export interface FunctionSourceLine {
  lineNumber: number
  code: string
  phases: readonly FunctionPhase[]
}

export interface GeneratedFunctionSource {
  lines: readonly FunctionSourceLine[]
  lineByPhase: Readonly<Record<FunctionPhase, number>>
  partByPhase: Readonly<Record<FunctionPhase, FunctionSourcePart>>
  sourceText: string
  callExpression: 'add(x, y)'
  addExpression: 'a + b'
}

export interface FunctionVariableState {
  declared: boolean
  initialized: boolean
  inScope: boolean
  value: number | null
}

export type FunctionStackFrameStatus =
  | 'not-created'
  | 'active'
  | 'suspended'
  | 'returned'

export interface FunctionMainFrameSnapshot {
  name: 'main'
  status: FunctionStackFrameStatus
  active: boolean
  x: Readonly<FunctionVariableState>
  y: Readonly<FunctionVariableState>
  answer: Readonly<FunctionVariableState>
}

export interface FunctionAddFrameSnapshot {
  name: 'add'
  status: FunctionStackFrameStatus
  active: boolean
  a: Readonly<FunctionVariableState>
  b: Readonly<FunctionVariableState>
  result: Readonly<FunctionVariableState>
}

export interface FunctionMemorySnapshot {
  main: Readonly<FunctionMainFrameSnapshot>
  add: Readonly<FunctionAddFrameSnapshot>
}

interface MutableFunctionMainFrame {
  name: 'main'
  status: FunctionStackFrameStatus
  active: boolean
  x: FunctionVariableState
  y: FunctionVariableState
  answer: FunctionVariableState
}

interface MutableFunctionAddFrame {
  name: 'add'
  status: FunctionStackFrameStatus
  active: boolean
  a: FunctionVariableState
  b: FunctionVariableState
  result: FunctionVariableState
}

interface MutableFunctionMemory {
  main: MutableFunctionMainFrame
  add: MutableFunctionAddFrame
}

export interface FunctionFrame {
  /** Stable zero-based position inside the complete execution trace. */
  index: number
  phase: FunctionPhase
  memoryBefore: Readonly<FunctionMemorySnapshot>
  memoryAfter: Readonly<FunctionMemorySnapshot>
  /** Convenient copies of the post-step stack frames for UI rendering. */
  mainFrame: Readonly<FunctionMainFrameSnapshot>
  addFrame: Readonly<FunctionAddFrameSnapshot>
  activeFunction: FunctionName | null
  callExpression: string
  resolvedCall: string | null
  addExpression: string
  resolvedAddExpression: string | null
  addReturnValue: number | null
  output: readonly number[]
  activeLine: number
  activePart: FunctionSourcePart
  explanation: string
}

export type FunctionSimulationStatus = 'completed' | 'blocked'

export type FunctionBlockReason =
  | 'invalid-number'
  | 'x-out-of-range'
  | 'y-out-of-range'
  | 'integer-required'
  | 'invalid-result'

export interface FunctionValidationIssue {
  code: Exclude<FunctionBlockReason, 'invalid-result'>
  field: keyof FunctionConfig
  message: string
}

export interface FunctionSimulationResult {
  config: Readonly<FunctionConfig>
  source: GeneratedFunctionSource
  frames: readonly FunctionFrame[]
  output: readonly number[]
  returnValue: number | null
  answerValue: number | null
  status: FunctionSimulationStatus
  blockReason: FunctionBlockReason | null
  validationIssues: readonly FunctionValidationIssue[]
  message: string
}

const LINE_BY_PHASE: Readonly<Record<FunctionPhase, number>> = {
  'enter-main': 8,
  'init-x': 9,
  'init-y': 10,
  'call-add': 11,
  'bind-parameters': 3,
  'declare-result': 4,
  'calculate-result': 4,
  'return-add': 5,
  'assign-answer': 11,
  print: 12,
  'return-main': 13,
  done: 14,
  blocked: 9,
}

const PART_BY_PHASE: Readonly<Record<FunctionPhase, FunctionSourcePart>> = {
  'enter-main': 'main-signature',
  'init-x': 'x-initializer',
  'init-y': 'y-initializer',
  'call-add': 'add-call',
  'bind-parameters': 'parameters',
  'declare-result': 'result-declaration',
  'calculate-result': 'result-expression',
  'return-add': 'add-return',
  'assign-answer': 'answer-assignment',
  print: 'printf',
  'return-main': 'main-return',
  done: 'exit',
  blocked: 'x-initializer',
}

function copyConfig(config: FunctionConfig): Readonly<FunctionConfig> {
  return { x: config.x, y: config.y }
}

function emptyVariable(): FunctionVariableState {
  return {
    declared: false,
    initialized: false,
    inScope: false,
    value: null,
  }
}

function createInitialMemory(): MutableFunctionMemory {
  return {
    main: {
      name: 'main',
      status: 'not-created',
      active: false,
      x: emptyVariable(),
      y: emptyVariable(),
      answer: emptyVariable(),
    },
    add: {
      name: 'add',
      status: 'not-created',
      active: false,
      a: emptyVariable(),
      b: emptyVariable(),
      result: emptyVariable(),
    },
  }
}

function cloneVariable(
  variable: Readonly<FunctionVariableState>,
): FunctionVariableState {
  return { ...variable }
}

function cloneMainFrame(
  frame: Readonly<FunctionMainFrameSnapshot>,
): MutableFunctionMainFrame {
  return {
    name: 'main',
    status: frame.status,
    active: frame.active,
    x: cloneVariable(frame.x),
    y: cloneVariable(frame.y),
    answer: cloneVariable(frame.answer),
  }
}

function cloneAddFrame(
  frame: Readonly<FunctionAddFrameSnapshot>,
): MutableFunctionAddFrame {
  return {
    name: 'add',
    status: frame.status,
    active: frame.active,
    a: cloneVariable(frame.a),
    b: cloneVariable(frame.b),
    result: cloneVariable(frame.result),
  }
}

function cloneMemory(
  memory: Readonly<FunctionMemorySnapshot>,
): MutableFunctionMemory {
  return {
    main: cloneMainFrame(memory.main),
    add: cloneAddFrame(memory.add),
  }
}

function activeFunctionFor(
  memory: Readonly<FunctionMemorySnapshot>,
): FunctionName | null {
  if (memory.add.active) return 'add'
  if (memory.main.active) return 'main'
  return null
}

function sourceLiteral(value: number, field: keyof FunctionConfig): string {
  if (Number.isFinite(value)) return String(value)
  return `0 /* invalid ${field}: simulation blocked */`
}

export function validateFunctionConfig(
  config: FunctionConfig = DEFAULT_FUNCTION_CONFIG,
): readonly FunctionValidationIssue[] {
  const issues: FunctionValidationIssue[] = []

  for (const field of ['x', 'y'] as const) {
    const value = config[field]
    const limits = FUNCTION_LIMITS[field]

    if (!Number.isFinite(value)) {
      issues.push({
        code: 'invalid-number',
        field,
        message: `${field} 必須是有限整數。`,
      })
      continue
    }

    if (value < limits.min || value > limits.max) {
      issues.push({
        code: `${field}-out-of-range`,
        field,
        message: `${field} 必須介於 ${limits.min} 到 ${limits.max}。`,
      })
    }

    if (!Number.isInteger(value)) {
      issues.push({
        code: 'integer-required',
        field,
        message: `${field} 必須是整數，才能作為這個 int 變數的值。`,
      })
    }
  }

  return issues
}

export function buildFunctionSource(
  config: FunctionConfig = DEFAULT_FUNCTION_CONFIG,
): GeneratedFunctionSource {
  const stableConfig = copyConfig(config)
  const lines: FunctionSourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    {
      lineNumber: 3,
      code: 'int add(int a, int b) {',
      phases: ['bind-parameters'],
    },
    {
      lineNumber: 4,
      code: '  int result = a + b;',
      phases: ['declare-result', 'calculate-result'],
    },
    { lineNumber: 5, code: '  return result;', phases: ['return-add'] },
    { lineNumber: 6, code: '}', phases: [] },
    { lineNumber: 7, code: '', phases: [] },
    { lineNumber: 8, code: 'int main(void) {', phases: ['enter-main'] },
    {
      lineNumber: 9,
      code: `  int x = ${sourceLiteral(stableConfig.x, 'x')};`,
      phases: ['init-x', 'blocked'],
    },
    {
      lineNumber: 10,
      code: `  int y = ${sourceLiteral(stableConfig.y, 'y')};`,
      phases: ['init-y', 'blocked'],
    },
    {
      lineNumber: 11,
      code: '  int answer = add(x, y);',
      phases: ['call-add', 'assign-answer'],
    },
    {
      lineNumber: 12,
      code: '  printf("%d\\n", answer);',
      phases: ['print'],
    },
    { lineNumber: 13, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 14, code: '}', phases: ['done'] },
  ]

  return {
    lines,
    lineByPhase: { ...LINE_BY_PHASE },
    partByPhase: { ...PART_BY_PHASE },
    sourceText: lines.map((line) => line.code).join('\n'),
    callExpression: 'add(x, y)',
    addExpression: 'a + b',
  }
}

export function calculateAddResult(a: number, b: number): number {
  return a + b
}

export function simulateFunctionProgram(
  config: FunctionConfig = DEFAULT_FUNCTION_CONFIG,
): FunctionSimulationResult {
  const stableConfig = copyConfig(config)
  const source = buildFunctionSource(stableConfig)
  const validationIssues = validateFunctionConfig(stableConfig).map((issue) => ({
    ...issue,
  }))
  const frames: FunctionFrame[] = []
  const output: number[] = []
  let memory = createInitialMemory()
  let addReturnValue: number | null = null

  const addFrame = (
    phase: FunctionPhase,
    explanation: string,
    mutate?: (nextMemory: MutableFunctionMemory) => void,
    sourceOverride?: Pick<FunctionFrame, 'activeLine' | 'activePart'>,
  ) => {
    const memoryBefore = cloneMemory(memory)
    const memoryAfter = cloneMemory(memory)
    mutate?.(memoryAfter)
    memory = memoryAfter
    const frameMemory = cloneMemory(memoryAfter)
    const canResolveCall = Number.isFinite(stableConfig.x)
      && Number.isFinite(stableConfig.y)
    const canResolveAdd = memoryAfter.add.a.initialized
      && memoryAfter.add.b.initialized

    frames.push({
      index: frames.length,
      phase,
      memoryBefore,
      memoryAfter: cloneMemory(frameMemory),
      mainFrame: cloneMainFrame(frameMemory.main),
      addFrame: cloneAddFrame(frameMemory.add),
      activeFunction: activeFunctionFor(frameMemory),
      callExpression: source.callExpression,
      resolvedCall: canResolveCall
        ? `add(${stableConfig.x}, ${stableConfig.y})`
        : null,
      addExpression: source.addExpression,
      resolvedAddExpression: canResolveAdd
        ? `${memoryAfter.add.a.value} + ${memoryAfter.add.b.value}`
        : null,
      addReturnValue,
      output: [...output],
      activeLine: sourceOverride?.activeLine ?? source.lineByPhase[phase],
      activePart: sourceOverride?.activePart ?? source.partByPhase[phase],
      explanation,
    })
  }

  const completedResult = (message: string): FunctionSimulationResult => ({
    config: stableConfig,
    source,
    frames,
    output: [...output],
    returnValue: addReturnValue,
    answerValue: memory.main.answer.initialized
      ? memory.main.answer.value
      : null,
    status: 'completed',
    blockReason: null,
    validationIssues: [],
    message,
  })

  const blockedResult = (
    issue: FunctionValidationIssue,
  ): FunctionSimulationResult => {
    const message = validationIssues.map((item) => item.message).join(' ')
    addFrame('blocked', `無法執行：${message}`, undefined, {
      activeLine: issue.field === 'x' ? 9 : 10,
      activePart: issue.field === 'x' ? 'x-initializer' : 'y-initializer',
    })

    return {
      config: stableConfig,
      source,
      frames,
      output: [],
      returnValue: null,
      answerValue: null,
      status: 'blocked',
      blockReason: issue.code,
      validationIssues: validationIssues.map((item) => ({ ...item })),
      message,
    }
  }

  addFrame('enter-main', '進入 main 函式，建立並啟用 main 的呼叫框架。', (next) => {
    next.main.status = 'active'
    next.main.active = true
  })

  if (validationIssues.length > 0) {
    return blockedResult(validationIssues[0])
  }

  addFrame('init-x', `在 main 內宣告 x，並初始化為 ${stableConfig.x}。`, (next) => {
    next.main.x = {
      declared: true,
      initialized: true,
      inScope: true,
      value: stableConfig.x,
    }
  })

  addFrame('init-y', `在 main 內宣告 y，並初始化為 ${stableConfig.y}。`, (next) => {
    next.main.y = {
      declared: true,
      initialized: true,
      inScope: true,
      value: stableConfig.y,
    }
  })

  addFrame(
    'call-add',
    `main 準備呼叫 add(x, y)，此時引數的值是 ${stableConfig.x} 與 ${stableConfig.y}。`,
    (next) => {
      next.main.answer = {
        declared: true,
        initialized: false,
        inScope: true,
        value: null,
      }
    },
  )

  addFrame(
    'bind-parameters',
    `進入 add 時，將 x 的值 ${stableConfig.x} 與 y 的值 ${stableConfig.y} 同時複製給參數 a、b；兩個參數都會在函式本體開始執行前完成宣告與初始化，並進入 add 的作用域。`,
    (next) => {
      next.main.status = 'suspended'
      next.main.active = false
      next.add.status = 'active'
      next.add.active = true
      next.add.a = {
        declared: true,
        initialized: true,
        inScope: true,
        value: stableConfig.x,
      }
      next.add.b = {
        declared: true,
        initialized: true,
        inScope: true,
        value: stableConfig.y,
      }
    },
  )

  addFrame('declare-result', '在 add 內宣告區域變數 result；它還沒有完成初始化。', (next) => {
    next.add.result = {
      declared: true,
      initialized: false,
      inScope: true,
      value: null,
    }
  })

  const calculatedResult = calculateAddResult(stableConfig.x, stableConfig.y)
  if (!Number.isFinite(calculatedResult) || !Number.isInteger(calculatedResult)) {
    const message = 'a + b 沒有產生可安全存入 int result 的整數，已阻止執行。'
    addFrame('blocked', message, undefined, {
      activeLine: 4,
      activePart: 'result-expression',
    })
    return {
      config: stableConfig,
      source,
      frames,
      output: [],
      returnValue: null,
      answerValue: null,
      status: 'blocked',
      blockReason: 'invalid-result',
      validationIssues: [],
      message,
    }
  }

  addFrame(
    'calculate-result',
    `計算 a + b，也就是 ${stableConfig.x} + ${stableConfig.y}，得到 ${calculatedResult} 並存入 result。`,
    (next) => {
      next.add.result = {
        declared: true,
        initialized: true,
        inScope: true,
        value: calculatedResult,
      }
    },
  )

  addReturnValue = calculatedResult
  addFrame('return-add', `return result 將 ${calculatedResult} 傳回呼叫 add 的 main。`)

  addFrame(
    'assign-answer',
    `回到 main，把 add 的回傳值 ${calculatedResult} 存入 answer；a、b、result 已離開作用域。`,
    (next) => {
      next.add.status = 'returned'
      next.add.active = false
      next.add.a.inScope = false
      next.add.b.inScope = false
      next.add.result.inScope = false
      next.main.status = 'active'
      next.main.active = true
      next.main.answer = {
        declared: true,
        initialized: true,
        inScope: true,
        value: calculatedResult,
      }
    },
  )

  output.push(calculatedResult)
  addFrame('print', `printf 讀取 main 的 answer，輸出 ${calculatedResult}。`)
  addFrame('return-main', 'return 0 表示 main 正常結束。')

  const message = `程式正常完成，add 回傳 ${calculatedResult}，printf 也輸出 ${calculatedResult}。`
  addFrame('done', message, (next) => {
    next.main.status = 'returned'
    next.main.active = false
    next.main.x.inScope = false
    next.main.y.inScope = false
    next.main.answer.inScope = false
  })

  return completedResult(message)
}

/** Short alias for consumers that name simulators after the chapter topic. */
export const simulateFunction = simulateFunctionProgram
