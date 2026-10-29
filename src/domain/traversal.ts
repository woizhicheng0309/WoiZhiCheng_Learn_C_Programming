import { INITIAL_SCORES } from './arrays'

export type TraversalMode = 'index' | 'pointer'

export interface TraversalConfig {
  count: number
  mode: TraversalMode
}

export const TRAVERSAL_LIMITS = { min: 0, max: 6 } as const
export const TRAVERSAL_VALUES: readonly number[] = Object.freeze([...INITIAL_SCORES])
export const DEFAULT_TRAVERSAL_CONFIG: Readonly<TraversalConfig> = {
  count: 5,
  mode: 'pointer',
}

export type TraversalPhase =
  | 'enter-main'
  | 'initialize-array'
  | 'bind-pointer'
  | 'init-index'
  | 'condition'
  | 'read-element'
  | 'advance-pointer'
  | 'increment-index'
  | 'return-main'
  | 'done'
  | 'blocked'

export interface TraversalValidationIssue {
  field: keyof TraversalConfig
  message: string
}

export interface TraversalSourceLine {
  lineNumber: number
  code: string
  phases: readonly TraversalPhase[]
}

export interface GeneratedTraversalSource {
  lines: readonly TraversalSourceLine[]
  sourceText: string
}

export interface TraversalMemory {
  scores: readonly number[] | null
  /** Element displacement from scores, not a physical byte address. */
  pointerIndex: number | null
  i: number | null
  indexInScope: boolean
  inScope: boolean
}

export interface TraversalFrame {
  index: number
  phase: TraversalPhase
  activeLine: number
  activePart: `line-${number}`
  explanation: string
  memory: Readonly<TraversalMemory>
  conditionResult: boolean | null
  highlightedIndex: number | null
  output: readonly number[]
  outputText: string
}

export interface TraversalSimulationResult {
  config: Readonly<TraversalConfig>
  source: GeneratedTraversalSource
  frames: readonly TraversalFrame[]
  output: readonly number[]
  outputText: string
  status: 'completed' | 'blocked'
  blockReason: 'invalid-config' | 'out-of-bounds' | null
  validationIssues: readonly TraversalValidationIssue[]
  message: string
}

export function validateTraversalConfig(
  config: TraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): readonly TraversalValidationIssue[] {
  const issues: TraversalValidationIssue[] = []
  if (!Number.isFinite(config.count) || !Number.isInteger(config.count)) {
    issues.push({ field: 'count', message: '走訪次數必須是有限整數。' })
  } else if (config.count < TRAVERSAL_LIMITS.min || config.count > TRAVERSAL_LIMITS.max) {
    issues.push({ field: 'count', message: `這個練習的走訪次數必須介於 ${TRAVERSAL_LIMITS.min} 到 ${TRAVERSAL_LIMITS.max}。` })
  }
  if (config.mode !== 'index' && config.mode !== 'pointer') {
    issues.push({ field: 'mode', message: '請選擇索引或指標走訪。' })
  }
  return issues
}

export function buildTraversalSource(
  config: TraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): GeneratedTraversalSource {
  const pointerMode = config.mode === 'pointer'
  const countLiteral = Number.isInteger(config.count)
    && config.count >= TRAVERSAL_LIMITS.min && config.count <= TRAVERSAL_LIMITS.max
    ? String(config.count) : '0 /* invalid count: simulation blocked */'
  const lines: TraversalSourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    { lineNumber: 3, code: 'int main(void) {', phases: ['enter-main'] },
    { lineNumber: 4, code: `  int scores[${TRAVERSAL_VALUES.length}] = {${TRAVERSAL_VALUES.join(', ')}};`, phases: ['initialize-array'] },
    { lineNumber: 5, code: pointerMode ? '  int *p = scores;' : '  /* index mode: use scores[i] */', phases: ['bind-pointer', 'blocked'] },
    { lineNumber: 6, code: `  for (int i = 0; i < ${countLiteral}; i++) {`, phases: ['init-index', 'condition', 'increment-index', 'blocked'] },
    { lineNumber: 7, code: pointerMode ? '    printf("%d ", *p);' : '    printf("%d ", scores[i]);', phases: ['read-element', 'blocked'] },
    { lineNumber: 8, code: pointerMode ? '    p++;' : '    /* next index is set by i++ */', phases: ['advance-pointer'] },
    { lineNumber: 9, code: '  }', phases: [] },
    { lineNumber: 10, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 11, code: '}', phases: ['done'] },
  ]
  return { lines, sourceText: lines.map((line) => line.code).join('\n') }
}

export function simulateTraversalProgram(
  config: TraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): TraversalSimulationResult {
  const stableConfig = { count: config.count, mode: config.mode }
  const source = buildTraversalSource(stableConfig)
  const validationIssues = validateTraversalConfig(stableConfig)
  const frames: TraversalFrame[] = []
  const output: number[] = []
  const memory: TraversalMemory = {
    scores: null,
    pointerIndex: null,
    i: null,
    indexInScope: false,
    inScope: true,
  }
  const addFrame = (
    phase: TraversalPhase,
    activeLine: number,
    explanation: string,
    options: { conditionResult?: boolean; highlightedIndex?: number } = {},
  ) => frames.push({
    index: frames.length,
    phase,
    activeLine,
    activePart: `line-${activeLine}`,
    explanation,
    memory: { ...memory, scores: memory.scores ? [...memory.scores] : null },
    conditionResult: options.conditionResult ?? null,
    highlightedIndex: options.highlightedIndex ?? null,
    output: [...output],
    outputText: output.join(' '),
  })
  const result = (
    status: TraversalSimulationResult['status'],
    blockReason: TraversalSimulationResult['blockReason'],
    message: string,
  ): TraversalSimulationResult => ({
    config: stableConfig,
    source,
    frames,
    output: [...output],
    outputText: output.join(' '),
    status,
    blockReason,
    validationIssues,
    message,
  })

  addFrame('enter-main', 3, '進入 main，準備用索引或指標依序讀取同一個陣列。')
  if (validationIssues.length > 0) {
    const message = validationIssues.map((issue) => issue.message).join(' ')
    addFrame('blocked', validationIssues[0].field === 'count' ? 6 : 5, `輸入不符合練習限制，模擬器在初始化前停止：${message}`)
    return result('blocked', 'invalid-config', message)
  }

  memory.scores = [...TRAVERSAL_VALUES]
  addFrame('initialize-array', 4, `建立 ${TRAVERSAL_VALUES.length} 個連續的 int 元素，合法索引是 0 到 ${TRAVERSAL_VALUES.length - 1}。陣列物件和指標變數是不同的概念。`)

  const pointerMode = stableConfig.mode === 'pointer'
  if (pointerMode) {
    memory.pointerIndex = 0
    addFrame('bind-pointer', 5, '在這個運算式中，scores 轉換成指向第一個元素的指標值，再複製給 p；因此 p 指向 scores[0]。', { highlightedIndex: 0 })
  }
  memory.i = 0
  memory.indexInScope = true
  addFrame('init-index', 6, 'for 的區域變數 i 從 0 開始，用來記錄已完成的走訪次數。')

  for (let i = 0; ; i += 1) {
    const condition = i < stableConfig.count
    const readIndex = pointerMode ? memory.pointerIndex! : i
    if (!condition) memory.indexInScope = false
    addFrame(
      'condition',
      6,
      condition
        ? `判斷 i < ${stableConfig.count}：${i} < ${stableConfig.count} 是 true，準備讀取下一個元素；條件為真不代表該位置一定合法。`
        : `判斷 i < ${stableConfig.count}：${i} < ${stableConfig.count} 是 false，離開 for；i 離開作用域，數值 ${i} 僅保留為追蹤紀錄。`,
      {
        conditionResult: condition,
        ...(condition && readIndex < TRAVERSAL_VALUES.length ? { highlightedIndex: readIndex } : {}),
      },
    )
    if (!condition) break

    if (readIndex >= TRAVERSAL_VALUES.length) {
      const message = pointerMode
        ? `p 現在等於 scores + ${TRAVERSAL_VALUES.length}，是合法形成的尾端下一格指標，但不可解參照。模擬器在讀取 *p 前停止；先前的 ${output.length} 筆輸出保留，沒有第六筆值。`
        : `scores[${i}] 超出合法索引 0 到 ${TRAVERSAL_VALUES.length - 1}。模擬器在存取前停止；先前的 ${output.length} 筆輸出保留，不能假定越界位置的值。`
      addFrame('blocked', 7, message)
      return result('blocked', 'out-of-bounds', message)
    }

    const value = TRAVERSAL_VALUES[readIndex]
    output.push(value)
    addFrame('read-element', 7, pointerMode
      ? `透過 *p 讀取 scores[${readIndex}]，輸出 ${value}；這一步只讀值，不會改變陣列。`
      : `用 i = ${i} 讀取 scores[${i}]，輸出 ${value}；這一步只讀值，不會改變陣列。`,
    { highlightedIndex: readIndex })

    if (pointerMode) {
      memory.pointerIndex = readIndex + 1
      const onePast = memory.pointerIndex === TRAVERSAL_VALUES.length
      addFrame('advance-pointer', 8,
        `p++ 前進一個 int 元素，也就是 sizeof(*p) bytes；不一定是 4 bytes，更不是固定的一個 byte。現在 p = scores + ${memory.pointerIndex}。${onePast ? '這是尾端下一格，可形成這個指標，但不能讀取 *p。' : ''}`,
        onePast ? {} : { highlightedIndex: memory.pointerIndex })
    }
    memory.i = i + 1
    addFrame('increment-index', 6, `執行 i++，i 從 ${i} 變為 ${memory.i}，接著重新判斷迴圈條件。`)
  }

  addFrame('return-main', 10, 'for 已結束，return 0 表示 main 正常完成。')
  memory.inScope = false
  const message = `走訪完成，共輸出 ${output.length} 筆${output.length > 0 ? `：「${output.join(' ')}」` : '，沒有讀取任何元素'}。`
  addFrame('done', 11, `${message}main 的陣列${pointerMode ? '與指標' : ''}也已離開作用域。`)
  return result('completed', null, message)
}
