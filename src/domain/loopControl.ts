export type LoopControlMode = 'break' | 'continue'

export interface LoopControlConfig {
  mode: LoopControlMode
  end: number
  trigger: number
}

export const DEFAULT_LOOP_CONTROL_CONFIG: Readonly<LoopControlConfig> = {
  mode: 'continue',
  end: 5,
  trigger: 3,
}

export const LOOP_CONTROL_LIMITS = {
  end: { min: 1, max: 8 },
  trigger: { min: 1, max: 8 },
} as const

export type LoopControlPhase =
  | 'enter-main'
  | 'init-sum'
  | 'initialize'
  | 'condition'
  | 'branch'
  | 'break'
  | 'continue'
  | 'accumulate'
  | 'print-value'
  | 'increment'
  | 'print-summary'
  | 'return-main'
  | 'done'
  | 'blocked'

export interface LoopControlValidationIssue {
  field: keyof LoopControlConfig
  message: string
}

export interface LoopControlSourceLine {
  lineNumber: number
  code: string
  phases: readonly LoopControlPhase[]
}

export interface GeneratedLoopControlSource {
  lines: readonly LoopControlSourceLine[]
  sourceText: string
}

export interface LoopControlMemory {
  /** Last value is retained in the trace; inspect iInScope before displaying it. */
  i: number | null
  sum: number | null
  /** Scope of main, and therefore of sum once declared. */
  inScope: boolean
  /** The for-initializer variable leaves scope as soon as the loop ends. */
  iInScope: boolean
}

export interface LoopControlFrame {
  index: number
  phase: LoopControlPhase
  activeLine: number
  activePart: `line-${number}`
  explanation: string
  memory: Readonly<LoopControlMemory>
  /** Number of entered loop bodies, including an iteration skipped or broken. */
  iteration: number
  conditionExpression: string
  conditionResult: boolean | null
  branchExpression: string
  branchResult: boolean | null
  /** Values printed inside the loop, without the final summary. */
  output: readonly number[]
  outputText: string
  summary: string | null
}

export interface LoopControlSimulationResult {
  config: Readonly<LoopControlConfig>
  source: GeneratedLoopControlSource
  frames: readonly LoopControlFrame[]
  status: 'completed' | 'blocked'
  blockReason: 'invalid-config' | null
  validationIssues: readonly LoopControlValidationIssue[]
  message: string
  output: readonly number[]
  outputText: string
  summary: string | null
  sum: number
  iterations: number
}

function validInteger(value: number, field: 'end' | 'trigger'): boolean {
  return Number.isFinite(value) && Number.isInteger(value)
    && value >= LOOP_CONTROL_LIMITS[field].min
    && value <= LOOP_CONTROL_LIMITS[field].max
}

export function validateLoopControlConfig(
  config: LoopControlConfig = DEFAULT_LOOP_CONTROL_CONFIG,
): readonly LoopControlValidationIssue[] {
  const issues: LoopControlValidationIssue[] = []
  if (config.mode !== 'break' && config.mode !== 'continue') {
    issues.push({ field: 'mode', message: '請選擇 break 或 continue。' })
  }
  for (const field of ['end', 'trigger'] as const) {
    if (!validInteger(config[field], field)) {
      issues.push({
        field,
        message: `${field} 必須是 ${LOOP_CONTROL_LIMITS[field].min} 到 ${LOOP_CONTROL_LIMITS[field].max} 的整數。`,
      })
    }
  }
  return issues
}

function integerLiteral(value: number, field: 'end' | 'trigger'): string {
  return validInteger(value, field)
    ? String(value)
    : `0 /* invalid ${field}: simulation blocked */`
}

export function buildLoopControlSource(
  config: LoopControlConfig = DEFAULT_LOOP_CONTROL_CONFIG,
): GeneratedLoopControlSource {
  const instruction = config.mode === 'break' || config.mode === 'continue'
    ? `${config.mode};`
    : 'break; /* invalid mode: simulation blocked */'
  const lines: LoopControlSourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    { lineNumber: 3, code: 'int main(void) {', phases: ['enter-main', 'blocked'] },
    { lineNumber: 4, code: '  int sum = 0;', phases: ['init-sum'] },
    {
      lineNumber: 5,
      code: `  for (int i = 1; i <= ${integerLiteral(config.end, 'end')}; i++) {`,
      phases: ['initialize', 'condition', 'increment', 'blocked'],
    },
    {
      lineNumber: 6,
      code: `    if (i == ${integerLiteral(config.trigger, 'trigger')}) {`,
      phases: ['branch', 'blocked'],
    },
    { lineNumber: 7, code: `      ${instruction}`, phases: ['break', 'continue'] },
    { lineNumber: 8, code: '    }', phases: [] },
    { lineNumber: 9, code: '    sum += i;', phases: ['accumulate'] },
    { lineNumber: 10, code: '    printf("%d\\n", i);', phases: ['print-value'] },
    { lineNumber: 11, code: '  }', phases: [] },
    { lineNumber: 12, code: '  printf("sum = %d\\n", sum);', phases: ['print-summary'] },
    { lineNumber: 13, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 14, code: '}', phases: ['done'] },
  ]
  return { lines, sourceText: lines.map((line) => line.code).join('\n') }
}

export function simulateLoopControlProgram(
  config: LoopControlConfig = DEFAULT_LOOP_CONTROL_CONFIG,
): LoopControlSimulationResult {
  const stableConfig = { mode: config.mode, end: config.end, trigger: config.trigger }
  const source = buildLoopControlSource(stableConfig)
  const validationIssues = validateLoopControlConfig(stableConfig)
  const frames: LoopControlFrame[] = []
  const output: number[] = []
  const memory: LoopControlMemory = {
    i: null, sum: null, inScope: true, iInScope: false,
  }
  let iterations = 0
  let summary: string | null = null
  const addFrame = (
    phase: LoopControlPhase,
    activeLine: number,
    explanation: string,
    conditionResult: boolean | null = null,
    branchResult: boolean | null = null,
  ) => {
    frames.push({
      index: frames.length,
      phase,
      activeLine,
      activePart: `line-${activeLine}`,
      explanation,
      memory: { ...memory },
      iteration: iterations,
      conditionExpression: `${memory.i ?? 'i'} <= ${validInteger(stableConfig.end, 'end') ? stableConfig.end : 'end'}`,
      conditionResult,
      branchExpression: `${memory.i ?? 'i'} == ${validInteger(stableConfig.trigger, 'trigger') ? stableConfig.trigger : 'trigger'}`,
      branchResult,
      output: [...output],
      outputText: [...output.map(String), ...(summary === null ? [] : [summary])].join('\n'),
      summary,
    })
  }
  const result = (
    status: LoopControlSimulationResult['status'],
    message: string,
  ): LoopControlSimulationResult => ({
    config: stableConfig,
    source,
    frames,
    status,
    blockReason: status === 'blocked' ? 'invalid-config' : null,
    validationIssues,
    message,
    output: [...output],
    outputText: [...output.map(String), ...(summary === null ? [] : [summary])].join('\n'),
    summary,
    sum: memory.sum ?? 0,
    iterations,
  })

  addFrame('enter-main', 3, '進入 main，準備觀察 break 與 continue 如何改變 for 的執行流程。')
  if (validationIssues.length > 0) {
    const message = validationIssues.map((issue) => issue.message).join(' ')
    const lineByField = { mode: 3, end: 5, trigger: 6 }
    addFrame('blocked', lineByField[validationIssues[0].field], `輸入不符合本練習限制，模擬器在初始化前停止：${message}`)
    return result('blocked', message)
  }

  memory.sum = 0
  addFrame('init-sum', 4, '宣告 sum 並設為 0；它在 main 的作用域內，迴圈結束後仍可使用。')
  memory.i = 1
  memory.iInScope = true
  addFrame('initialize', 5, 'for 的初始化只執行一次：宣告 i 並設為 1。i 的作用域只到這個 for 結束。')

  for (;;) {
    const condition = memory.i <= stableConfig.end
    addFrame('condition', 5,
      `判斷 ${memory.i} <= ${stableConfig.end}，結果為 ${condition ? 'true，進入本次迴圈本體。' : 'false，離開 for，接著輸出 sum。'}`,
      condition)
    if (!condition) break

    iterations += 1
    const matches = memory.i === stableConfig.trigger
    addFrame('branch', 6,
      `第 ${iterations} 次進入本體，判斷 ${memory.i} == ${stableConfig.trigger}：${matches ? `true，準備執行 ${stableConfig.mode}。` : 'false，略過 if 區塊，繼續累加與輸出。'}`,
      null, matches)
    if (matches && stableConfig.mode === 'break') {
      addFrame('break', 7,
        `break 立即離開這個 for；本次的累加與輸出都不執行，也不執行 i++。下一步直接輸出 sum = ${memory.sum}。`)
      break
    }
    if (matches) {
      addFrame('continue', 7,
        `continue 跳過本次剩下的累加與輸出；for 仍會先執行 i++，再重新判斷條件。sum 保持 ${memory.sum}。`)
    } else {
      const before = memory.sum
      memory.sum += memory.i
      addFrame('accumulate', 9, `執行 sum += i：${before} + ${memory.i} = ${memory.sum}。`)
      output.push(memory.i)
      addFrame('print-value', 10, `printf 輸出目前的 i = ${memory.i}。`)
    }

    const before = memory.i
    memory.i += 1
    addFrame('increment', 5, `執行 for 的更新 i++：${before} 變成 ${memory.i}，接著回到條件判斷。`)
  }

  memory.iInScope = false
  summary = `sum = ${memory.sum}`
  addFrame('print-summary', 12,
    `for 已結束，i 已離開作用域；main 的 sum 仍為 ${memory.sum}，printf 輸出「${summary}」。`)
  addFrame('return-main', 13, '執行 return 0，表示 main 正常結束；sum 此時仍在作用域內。')
  memory.inScope = false
  const message = `${stableConfig.mode} 範例完成：進入本體 ${iterations} 次，輸出 ${output.length ? output.join('、') : '（無迴圈輸出）'}，總和為 ${memory.sum}。`
  addFrame('done', 14, `${message}main 結束後，sum 也離開作用域。`)
  return result('completed', message)
}
