export const ARRAY_LENGTH = 5

export const INITIAL_SCORES: readonly number[] = [4, 7, 2, 9, 5]

export interface ArrayConfig {
  index: number
  newValue: number
}

export const ARRAY_LIMITS = {
  index: { min: 0, max: ARRAY_LENGTH - 1 },
  newValue: { min: -20, max: 100 },
} as const

export const DEFAULT_ARRAY_CONFIG: Readonly<ArrayConfig> = {
  index: 2,
  newValue: 10,
}

export type ArrayPhase =
  | 'enter-main'
  | 'declare-array'
  | 'initialize-array'
  | 'init-index'
  | 'read-element'
  | 'write-element'
  | 'print'
  | 'return-main'
  | 'done'
  | 'blocked'

export type ArraySourcePart =
  | 'main-signature'
  | 'array-declaration'
  | 'array-initializer'
  | 'index-initializer'
  | 'array-read'
  | 'array-write'
  | 'printf'
  | 'return'
  | 'exit'

export interface ArraySourceLine {
  lineNumber: number
  code: string
  phases: readonly ArrayPhase[]
}

export interface GeneratedArraySource {
  lines: readonly ArraySourceLine[]
  lineByPhase: Readonly<Record<ArrayPhase, number>>
  partByPhase: Readonly<Record<ArrayPhase, ArraySourcePart>>
  sourceText: string
  arrayName: 'scores'
  arrayLength: typeof ARRAY_LENGTH
  accessExpression: 'scores[index]'
}

export interface ArrayMemoryCell {
  /** Zero-based subscript shown underneath the contiguous memory cell. */
  index: number
  /** Conceptual byte displacement for an int in this visual model. */
  byteOffset: number
  declared: boolean
  initialized: boolean
  inScope: boolean
  value: number | null
}

export interface ArrayScalarState {
  declared: boolean
  initialized: boolean
  inScope: boolean
  value: number | null
}

export interface ArrayMemorySnapshot {
  scores: readonly Readonly<ArrayMemoryCell>[]
  indexVariable: Readonly<ArrayScalarState>
  selected: Readonly<ArrayScalarState>
}

export type ArrayAccessKind = 'none' | 'read' | 'write'

export interface ArrayFrame {
  /** Stable zero-based position inside the complete execution trace. */
  index: number
  phase: ArrayPhase
  memoryBefore: Readonly<ArrayMemorySnapshot>
  memoryAfter: Readonly<ArrayMemorySnapshot>
  /** Convenient copy of the post-step cells for memory-strip rendering. */
  scores: readonly Readonly<ArrayMemoryCell>[]
  highlightedIndex: number | null
  accessKind: ArrayAccessKind
  accessExpression: string
  resolvedAccessExpression: string | null
  readValue: number | null
  writtenValue: number | null
  output: readonly number[]
  outputText: string | null
  activeLine: number
  activePart: ArraySourcePart
  explanation: string
}

export type ArraySimulationStatus = 'completed' | 'blocked'

export type ArrayBlockReason =
  | 'invalid-index-number'
  | 'index-integer-required'
  | 'index-out-of-bounds'
  | 'invalid-new-value-number'
  | 'new-value-integer-required'
  | 'new-value-out-of-range'

export interface ArrayValidationIssue {
  code: ArrayBlockReason
  field: keyof ArrayConfig
  message: string
}

export interface ArraySimulationResult {
  config: Readonly<ArrayConfig>
  source: GeneratedArraySource
  frames: readonly ArrayFrame[]
  initialScores: readonly number[]
  finalScores: readonly number[]
  output: readonly number[]
  outputText: string | null
  selectedValue: number | null
  status: ArraySimulationStatus
  blockReason: ArrayBlockReason | null
  validationIssues: readonly ArrayValidationIssue[]
  message: string
}

const LINE_BY_PHASE: Readonly<Record<ArrayPhase, number>> = {
  'enter-main': 3,
  'declare-array': 4,
  'initialize-array': 4,
  'init-index': 5,
  'read-element': 6,
  'write-element': 7,
  print: 8,
  'return-main': 9,
  done: 10,
  blocked: 5,
}

const PART_BY_PHASE: Readonly<Record<ArrayPhase, ArraySourcePart>> = {
  'enter-main': 'main-signature',
  'declare-array': 'array-declaration',
  'initialize-array': 'array-initializer',
  'init-index': 'index-initializer',
  'read-element': 'array-read',
  'write-element': 'array-write',
  print: 'printf',
  'return-main': 'return',
  done: 'exit',
  blocked: 'index-initializer',
}

interface MutableArrayMemory {
  scores: ArrayMemoryCell[]
  indexVariable: ArrayScalarState
  selected: ArrayScalarState
}

function copyConfig(config: ArrayConfig): Readonly<ArrayConfig> {
  return { index: config.index, newValue: config.newValue }
}

function emptyScalar(): ArrayScalarState {
  return {
    declared: false,
    initialized: false,
    inScope: false,
    value: null,
  }
}

function createInitialMemory(): MutableArrayMemory {
  return {
    scores: INITIAL_SCORES.map((_, index) => ({
      index,
      byteOffset: index * 4,
      declared: false,
      initialized: false,
      inScope: false,
      value: null,
    })),
    indexVariable: emptyScalar(),
    selected: emptyScalar(),
  }
}

function cloneMemory(
  memory: Readonly<ArrayMemorySnapshot>,
): MutableArrayMemory {
  return {
    scores: memory.scores.map((cell) => ({ ...cell })),
    indexVariable: { ...memory.indexVariable },
    selected: { ...memory.selected },
  }
}

function safeIntegerLiteral(value: number, field: keyof ArrayConfig): string {
  if (Number.isFinite(value) && Number.isInteger(value)) return String(value)
  return `0 /* invalid ${field}: simulation blocked */`
}

export function validateArrayConfig(
  config: ArrayConfig = DEFAULT_ARRAY_CONFIG,
): readonly ArrayValidationIssue[] {
  const issues: ArrayValidationIssue[] = []

  if (!Number.isFinite(config.index)) {
    issues.push({
      code: 'invalid-index-number',
      field: 'index',
      message: '索引必須是有限整數。',
    })
  } else {
    if (!Number.isInteger(config.index)) {
      issues.push({
        code: 'index-integer-required',
        field: 'index',
        message: '陣列索引必須是整數。',
      })
    }

    if (
      config.index < ARRAY_LIMITS.index.min
      || config.index > ARRAY_LIMITS.index.max
    ) {
      issues.push({
        code: 'index-out-of-bounds',
        field: 'index',
        message: `scores 有 ${ARRAY_LENGTH} 格，合法索引只有 ${ARRAY_LIMITS.index.min} 到 ${ARRAY_LIMITS.index.max}。`,
      })
    }
  }

  if (!Number.isFinite(config.newValue)) {
    issues.push({
      code: 'invalid-new-value-number',
      field: 'newValue',
      message: '新分數必須是有限整數。',
    })
  } else {
    if (!Number.isInteger(config.newValue)) {
      issues.push({
        code: 'new-value-integer-required',
        field: 'newValue',
        message: 'int 陣列只能寫入整數。',
      })
    }

    if (
      config.newValue < ARRAY_LIMITS.newValue.min
      || config.newValue > ARRAY_LIMITS.newValue.max
    ) {
      issues.push({
        code: 'new-value-out-of-range',
        field: 'newValue',
        message: `這個練習的新值必須介於 ${ARRAY_LIMITS.newValue.min} 到 ${ARRAY_LIMITS.newValue.max}。`,
      })
    }
  }

  return issues
}

export function buildArraySource(
  config: ArrayConfig = DEFAULT_ARRAY_CONFIG,
): GeneratedArraySource {
  const stableConfig = copyConfig(config)
  const values = INITIAL_SCORES.join(', ')
  const lines: ArraySourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    { lineNumber: 3, code: 'int main(void) {', phases: ['enter-main'] },
    {
      lineNumber: 4,
      code: `  int scores[${ARRAY_LENGTH}] = {${values}};`,
      phases: ['declare-array', 'initialize-array'],
    },
    {
      lineNumber: 5,
      code: `  int index = ${safeIntegerLiteral(stableConfig.index, 'index')};`,
      phases: ['init-index', 'blocked'],
    },
    {
      lineNumber: 6,
      code: '  int selected = scores[index];',
      phases: ['read-element'],
    },
    {
      lineNumber: 7,
      code: `  scores[index] = ${safeIntegerLiteral(stableConfig.newValue, 'newValue')};`,
      phases: ['write-element'],
    },
    {
      lineNumber: 8,
      code: '  printf("%d -> %d\\n", selected, scores[index]);',
      phases: ['print'],
    },
    { lineNumber: 9, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 10, code: '}', phases: ['done'] },
  ]

  return {
    lines,
    lineByPhase: { ...LINE_BY_PHASE },
    partByPhase: { ...PART_BY_PHASE },
    sourceText: lines.map((line) => line.code).join('\n'),
    arrayName: 'scores',
    arrayLength: ARRAY_LENGTH,
    accessExpression: 'scores[index]',
  }
}

export function simulateArrayProgram(
  config: ArrayConfig = DEFAULT_ARRAY_CONFIG,
): ArraySimulationResult {
  const stableConfig = copyConfig(config)
  const source = buildArraySource(stableConfig)
  const validationIssues = validateArrayConfig(stableConfig).map((issue) => ({
    ...issue,
  }))
  const indexIssues = validationIssues.filter((issue) => issue.field === 'index')
  const newValueIssues = validationIssues.filter(
    (issue) => issue.field === 'newValue',
  )
  const frames: ArrayFrame[] = []
  const output: number[] = []
  let memory = createInitialMemory()
  let readValue: number | null = null
  let writtenValue: number | null = null
  let outputText: string | null = null

  const addFrame = (
    phase: ArrayPhase,
    explanation: string,
    mutate?: (nextMemory: MutableArrayMemory) => void,
    options: {
      highlightedIndex?: number | null
      accessKind?: ArrayAccessKind
      activeLine?: number
      activePart?: ArraySourcePart
    } = {},
  ) => {
    const memoryBefore = cloneMemory(memory)
    const memoryAfter = cloneMemory(memory)
    mutate?.(memoryAfter)
    memory = memoryAfter
    const frameMemory = cloneMemory(memoryAfter)
    const canResolveIndex = Number.isInteger(stableConfig.index)
      && stableConfig.index >= 0
      && stableConfig.index < ARRAY_LENGTH

    frames.push({
      index: frames.length,
      phase,
      memoryBefore,
      memoryAfter: cloneMemory(frameMemory),
      scores: frameMemory.scores.map((cell) => ({ ...cell })),
      highlightedIndex: options.highlightedIndex ?? null,
      accessKind: options.accessKind ?? 'none',
      accessExpression: source.accessExpression,
      resolvedAccessExpression: canResolveIndex
        ? `scores[${stableConfig.index}]`
        : null,
      readValue,
      writtenValue,
      output: [...output],
      outputText,
      activeLine: options.activeLine ?? source.lineByPhase[phase],
      activePart: options.activePart ?? source.partByPhase[phase],
      explanation,
    })
  }

  const blockedResult = (
    issue: ArrayValidationIssue,
    activeLine: number,
    activePart: ArraySourcePart,
    context: string,
  ): ArraySimulationResult => {
    const message = validationIssues.map((item) => item.message).join(' ')
    addFrame('blocked', `${context}${message}`, undefined, {
      activeLine,
      activePart,
    })

    return {
      config: stableConfig,
      source,
      frames,
      initialScores: [...INITIAL_SCORES],
      finalScores: [...INITIAL_SCORES],
      output: [],
      outputText: null,
      selectedValue: readValue,
      status: 'blocked',
      blockReason: issue.code,
      validationIssues: validationIssues.map((item) => ({ ...item })),
      message,
    }
  }

  addFrame('enter-main', '進入 main 函式，準備建立固定長度為 5 的 int 陣列。')

  addFrame(
    'declare-array',
    `宣告 scores[${ARRAY_LENGTH}]，一次保留 ${ARRAY_LENGTH} 個連續的 int 記憶格；此刻尚未放入初始值。`,
    (next) => {
      for (const cell of next.scores) {
        cell.declared = true
        cell.inScope = true
      }
    },
  )

  addFrame(
    'initialize-array',
    `依序把 ${INITIAL_SCORES.join('、')} 放進 scores[0] 到 scores[${ARRAY_LENGTH - 1}]。`,
    (next) => {
      next.scores.forEach((cell, index) => {
        cell.initialized = true
        cell.value = INITIAL_SCORES[index]
      })
    },
  )

  const invalidIndexIssue = indexIssues.find(
    (issue) => issue.code !== 'index-out-of-bounds',
  )
  if (invalidIndexIssue) {
    return blockedResult(
      invalidIndexIssue,
      5,
      'index-initializer',
      'index 無法安全建立：',
    )
  }

  addFrame(
    'init-index',
    `宣告 index 並設為 ${stableConfig.index}；索引從 0 起算。`,
    (next) => {
      next.indexVariable = {
        declared: true,
        initialized: true,
        inScope: true,
        value: stableConfig.index,
      }
    },
    {
      highlightedIndex: indexIssues.some(
        (issue) => issue.code === 'index-out-of-bounds',
      )
        ? null
        : stableConfig.index,
    },
  )

  const outOfBoundsIssue = indexIssues.find(
    (issue) => issue.code === 'index-out-of-bounds',
  )
  if (outOfBoundsIssue) {
    return blockedResult(
      outOfBoundsIssue,
      6,
      'array-read',
      `即將讀取 scores[${stableConfig.index}]，但這個位置不屬於陣列。模擬器在真正存取前停止：`,
    )
  }

  const originalValue = memory.scores[stableConfig.index].value
  if (originalValue === null) {
    throw new Error('Array initialization invariant violated before reading.')
  }
  readValue = originalValue
  addFrame(
    'read-element',
    `讀取 scores[index]，也就是 scores[${stableConfig.index}] 的值 ${readValue}，並複製給 selected。`,
    (next) => {
      next.selected = {
        declared: true,
        initialized: true,
        inScope: true,
        value: readValue,
      }
    },
    { highlightedIndex: stableConfig.index, accessKind: 'read' },
  )

  if (newValueIssues.length > 0) {
    return blockedResult(
      newValueIssues[0],
      7,
      'array-write',
      `即將寫入 scores[${stableConfig.index}]，但新值不符合本練習限制：`,
    )
  }

  writtenValue = stableConfig.newValue
  addFrame(
    'write-element',
    `把 ${stableConfig.newValue} 寫入 scores[${stableConfig.index}]；只改變這一格，selected 仍保留先前讀到的 ${readValue}。`,
    (next) => {
      next.scores[stableConfig.index].value = stableConfig.newValue
    },
    { highlightedIndex: stableConfig.index, accessKind: 'write' },
  )

  output.push(originalValue, stableConfig.newValue)
  outputText = `${originalValue} -> ${stableConfig.newValue}`
  addFrame(
    'print',
    `printf 先輸出 selected 的舊值 ${readValue}，再讀取同一索引的新值 ${stableConfig.newValue}。`,
    undefined,
    { highlightedIndex: stableConfig.index, accessKind: 'read' },
  )

  addFrame('return-main', 'return 0 表示 main 正常結束。')

  const message = `程式正常完成：scores[${stableConfig.index}] 從 ${readValue} 改為 ${stableConfig.newValue}，輸出「${outputText}」。`
  addFrame('done', message, (next) => {
    for (const cell of next.scores) cell.inScope = false
    next.indexVariable.inScope = false
    next.selected.inScope = false
  })

  return {
    config: stableConfig,
    source,
    frames,
    initialScores: [...INITIAL_SCORES],
    finalScores: memory.scores.map((cell) => cell.value as number),
    output: [...output],
    outputText,
    selectedValue: originalValue,
    status: 'completed',
    blockReason: null,
    validationIssues: [],
    message,
  }
}

/** Short alias for consumers that name simulators after the chapter topic. */
export const simulateArray = simulateArrayProgram
