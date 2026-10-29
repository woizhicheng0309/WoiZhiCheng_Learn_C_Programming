import { compareLoopValue } from './loopSimulator'
import { COMPARATORS, type Comparator } from './types'

export type WhileMode = 'while' | 'do-while'

export interface WhileConfig {
  mode: WhileMode
  start: number
  end: number
  comparator: Comparator
  step: number
}

export const DEFAULT_WHILE_CONFIG: Readonly<WhileConfig> = {
  mode: 'while', start: 0, end: 3, comparator: '<', step: 1,
}

export const WHILE_LIMITS = {
  start: { min: -20, max: 20 },
  end: { min: -20, max: 20 },
  step: { min: -5, max: 5 },
  maxIterations: 100,
} as const

export type WhilePhase =
  | 'enter-main'
  | 'initialize'
  | 'condition'
  | 'body'
  | 'increment'
  | 'return-main'
  | 'done'
  | 'blocked'

export interface WhileValidationIssue {
  field: keyof WhileConfig
  message: string
}

export interface WhileSourceLine {
  lineNumber: number
  code: string
  phases: readonly WhilePhase[]
}

export interface GeneratedWhileSource {
  lines: readonly WhileSourceLine[]
  sourceText: string
}

export interface WhileMemory {
  i: number | null
  inScope: boolean
}

export interface WhileFrame {
  index: number
  phase: WhilePhase
  activeLine: number
  activePart: `line-${number}`
  explanation: string
  memory: Readonly<WhileMemory>
  /** Number of loop-body printf calls already executed. */
  iteration: number
  conditionExpression: string
  conditionResult: boolean | null
  output: readonly number[]
  outputText: string
}

export interface WhileSimulationResult {
  config: Readonly<WhileConfig>
  source: GeneratedWhileSource
  frames: readonly WhileFrame[]
  output: readonly number[]
  outputText: string
  iterations: number
  status: 'completed' | 'blocked'
  blockReason: 'invalid-config' | 'step-zero' | 'wrong-direction' | 'iteration-limit' | null
  validationIssues: readonly WhileValidationIssue[]
  message: string
}

export function validateWhileConfig(
  config: WhileConfig = DEFAULT_WHILE_CONFIG,
): readonly WhileValidationIssue[] {
  const issues: WhileValidationIssue[] = []
  for (const field of ['start', 'end', 'step'] as const) {
    const value = config[field]
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      issues.push({ field, message: `${field} 必須是有限整數。` })
    } else if (value < WHILE_LIMITS[field].min || value > WHILE_LIMITS[field].max) {
      issues.push({ field, message: `這個練習的 ${field} 必須介於 ${WHILE_LIMITS[field].min} 到 ${WHILE_LIMITS[field].max}。` })
    }
  }
  if (config.mode !== 'while' && config.mode !== 'do-while') {
    issues.push({ field: 'mode', message: '請選擇 while 或 do-while。' })
  }
  if (!COMPARATORS.includes(config.comparator)) {
    issues.push({ field: 'comparator', message: '比較運算子只能選擇 <、<=、> 或 >=。' })
  }
  return issues
}

function validInteger(value: number, field: 'start' | 'end' | 'step'): boolean {
  return Number.isFinite(value) && Number.isInteger(value)
    && value >= WHILE_LIMITS[field].min && value <= WHILE_LIMITS[field].max
}

function integerLiteral(value: number, field: 'start' | 'end' | 'step'): string {
  return validInteger(value, field) ? String(value) : `0 /* invalid ${field}: simulation blocked */`
}

export function buildWhileSource(
  config: WhileConfig = DEFAULT_WHILE_CONFIG,
): GeneratedWhileSource {
  const doWhile = config.mode === 'do-while'
  const comparator = COMPARATORS.includes(config.comparator) ? config.comparator : '<'
  const condition = `i ${comparator} ${integerLiteral(config.end, 'end')}`
  const step = validInteger(config.step, 'step') ? config.step : 0
  const update = validInteger(config.step, 'step')
    ? `i ${step < 0 ? '-=' : '+='} ${Math.abs(step)};`
    : 'i += 0 /* invalid step: simulation blocked */;'
  const lines: WhileSourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    { lineNumber: 3, code: 'int main(void) {', phases: ['enter-main'] },
    { lineNumber: 4, code: `  int i = ${integerLiteral(config.start, 'start')};`, phases: ['initialize', 'blocked'] },
    { lineNumber: 5, code: doWhile ? '  do {' : `  while (${condition}) {`, phases: doWhile ? [] : ['condition', 'blocked'] },
    { lineNumber: 6, code: '    printf("%d ", i);', phases: ['body'] },
    { lineNumber: 7, code: `    ${update}`, phases: ['increment', 'blocked'] },
    { lineNumber: 8, code: doWhile ? `  } while (${condition});` : '  }', phases: doWhile ? ['condition', 'blocked'] : [] },
    { lineNumber: 9, code: '', phases: [] },
    { lineNumber: 10, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 11, code: '}', phases: ['done'] },
  ]
  return { lines, sourceText: lines.map((line) => line.code).join('\n') }
}

function nonTerminationReason(config: WhileConfig): 'step-zero' | 'wrong-direction' | null {
  if (config.step === 0) return 'step-zero'
  const needsPositiveStep = config.comparator === '<' || config.comparator === '<='
  return (needsPositiveStep && config.step < 0) || (!needsPositiveStep && config.step > 0)
    ? 'wrong-direction' : null
}

export function simulateWhileProgram(
  config: WhileConfig = DEFAULT_WHILE_CONFIG,
): WhileSimulationResult {
  const stableConfig = {
    mode: config.mode, start: config.start, end: config.end,
    comparator: config.comparator, step: config.step,
  }
  const source = buildWhileSource(stableConfig)
  const validationIssues = validateWhileConfig(stableConfig)
  const frames: WhileFrame[] = []
  const output: number[] = []
  const memory: WhileMemory = { i: null, inScope: true }
  let iterations = 0
  const conditionLine = stableConfig.mode === 'do-while' ? 8 : 5
  const safeComparator = COMPARATORS.includes(stableConfig.comparator) ? stableConfig.comparator : '<'
  const safeEnd = validInteger(stableConfig.end, 'end') ? String(stableConfig.end) : 'end'
  const addFrame = (
    phase: WhilePhase,
    activeLine: number,
    explanation: string,
    conditionResult: boolean | null = null,
  ) => frames.push({
    index: frames.length,
    phase,
    activeLine,
    activePart: `line-${activeLine}`,
    explanation,
    memory: { ...memory },
    iteration: iterations,
    conditionExpression: `${memory.i === null ? 'i' : memory.i} ${safeComparator} ${safeEnd}`,
    conditionResult,
    output: [...output],
    outputText: output.join(' '),
  })
  const result = (
    status: WhileSimulationResult['status'],
    blockReason: WhileSimulationResult['blockReason'],
    message: string,
  ): WhileSimulationResult => ({
    config: stableConfig, source, frames, output: [...output], outputText: output.join(' '),
    iterations, status, blockReason, validationIssues, message,
  })

  addFrame('enter-main', 3, '進入 main，準備比較先判斷的 while 與先執行一次的 do-while。')
  if (validationIssues.length > 0) {
    const lineByField = { start: 4, end: conditionLine, step: 7, mode: conditionLine, comparator: conditionLine }
    const message = validationIssues.map((issue) => issue.message).join(' ')
    addFrame('blocked', lineByField[validationIssues[0].field], `輸入不符合練習限制，模擬器在初始化前停止：${message}`)
    return result('blocked', 'invalid-config', message)
  }

  memory.i = stableConfig.start
  addFrame('initialize', 4, `在 main 中宣告 i 並初始化為 ${memory.i}。i 的作用域持續到 main 結束。`)
  let checkBeforeBody = stableConfig.mode === 'while'
  for (;;) {
    if (checkBeforeBody) {
      const condition = compareLoopValue(memory.i, stableConfig.comparator, stableConfig.end)
      addFrame('condition', conditionLine,
        `判斷 ${memory.i} ${stableConfig.comparator} ${stableConfig.end}，結果為 ${condition ? 'true，準備進入下一次本體。' : 'false，離開迴圈；i 仍在 main 的作用域內。'}`,
        condition)
      if (!condition) break

      const reason = nonTerminationReason(stableConfig)
      if (reason) {
        const message = reason === 'step-zero'
          ? '條件為 true，但 step = 0 使 i 不改變。模擬器在下一次本體前停止，避免持續重複；這是模擬器保護，C 語言本身不會因此自動停止。'
          : '條件為 true，但步進方向無法讓這個條件變為 false。模擬器在下一次本體前停止；真實 C 沒有這項保護，不能假定持續更新後仍有定義的輸出。'
        addFrame('blocked', conditionLine, message)
        return result('blocked', reason, message)
      }
      if (iterations >= WHILE_LIMITS.maxIterations) {
        const message = `已執行 ${WHILE_LIMITS.maxIterations} 次本體，模擬器在下一次本體前達到保護上限並停止；這不是 C 語言的自動限制。`
        addFrame('blocked', conditionLine, message)
        return result('blocked', 'iteration-limit', message)
      }
    }

    output.push(memory.i)
    iterations += 1
    addFrame('body', 6, `執行第 ${iterations} 次本體，printf 輸出目前的 i = ${memory.i}。${!checkBeforeBody ? 'do-while 會先執行這一次，尚未判斷條件。' : ''}`)
    const before = memory.i
    memory.i += stableConfig.step
    addFrame('increment', 7, `更新 i：${before} ${stableConfig.step < 0 ? '-' : '+'} ${Math.abs(stableConfig.step)} = ${memory.i}，接著才判斷條件。`)
    checkBeforeBody = true
  }

  addFrame('return-main', 10, '迴圈已結束，i 仍然存在；return 0 表示 main 正常結束。')
  memory.inScope = false
  const message = `${stableConfig.mode} 正常完成，共執行 ${iterations} 次本體${output.length ? `，輸出「${output.join(' ')}」` : '，沒有輸出'}。`
  addFrame('done', 11, `${message}i 隨 main 結束而離開作用域。`)
  return result('completed', null, message)
}
