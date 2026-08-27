export const CONDITIONAL_LOGICAL_OPERATORS = ['&&', '||'] as const

export type ConditionalLogicalOperator =
  (typeof CONDITIONAL_LOGICAL_OPERATORS)[number]

export interface ConditionalConfig {
  score: number
  attendance: number
  logicalOperator: ConditionalLogicalOperator
}

export const CONDITIONAL_LIMITS = {
  score: { min: 0, max: 100 },
  attendance: { min: 0, max: 100 },
  scoreThreshold: 60,
  attendanceThreshold: 70,
} as const

export const DEFAULT_CONDITIONAL_CONFIG: Readonly<ConditionalConfig> = {
  score: 72,
  attendance: 65,
  logicalOperator: '&&',
}

export type ConditionalPhase =
  | 'main'
  | 'init-score'
  | 'init-attendance'
  | 'compare-score'
  | 'short-circuit'
  | 'compare-attendance'
  | 'combine'
  | 'if-branch'
  | 'else-branch'
  | 'print'
  | 'return'
  | 'done'

export type ConditionalSourcePart =
  | 'main-signature'
  | 'score-initializer'
  | 'attendance-initializer'
  | 'if-keyword'
  | 'score-comparison'
  | 'logical-operator'
  | 'attendance-comparison'
  | 'if-brace'
  | 'else-keyword'
  | 'printf-pass'
  | 'printf-practice'
  | 'return'
  | 'exit'

export interface ConditionalSourceLine {
  lineNumber: number
  code: string
  phases: readonly ConditionalPhase[]
}

export interface GeneratedConditionalSource {
  lines: readonly ConditionalSourceLine[]
  lineByPhase: Readonly<Record<ConditionalPhase, number>>
  partByPhase: Readonly<Record<ConditionalPhase, ConditionalSourcePart>>
  scoreExpression: string
  attendanceExpression: string
  conditionExpression: string
}

export type ConditionalBranch = 'if' | 'else' | null
export type ConditionalSkippedComparison = 'score' | 'attendance' | null

export interface ConditionalFrame {
  /** Stable zero-based position inside the complete execution trace. */
  index: number
  phase: ConditionalPhase
  score: number
  attendance: number
  scorePasses: boolean | null
  attendancePasses: boolean | null
  conditionResult: boolean | null
  selectedBranch: ConditionalBranch
  skippedComparison: ConditionalSkippedComparison
  output: readonly string[]
  activeLine: number
  activePart: ConditionalSourcePart
  explanation: string
}

export interface ConditionalSimulationResult {
  config: Readonly<ConditionalConfig>
  source: GeneratedConditionalSource
  frames: readonly ConditionalFrame[]
  output: readonly string[]
  scorePasses: boolean
  attendancePasses: boolean
  conditionResult: boolean
  selectedBranch: Exclude<ConditionalBranch, null>
  shortCircuited: boolean
  status: 'completed'
  message: string
}

const LINE_BY_PHASE: Readonly<Record<ConditionalPhase, number>> = {
  main: 3,
  'init-score': 4,
  'init-attendance': 5,
  'compare-score': 7,
  'short-circuit': 7,
  'compare-attendance': 7,
  combine: 7,
  'if-branch': 7,
  'else-branch': 9,
  print: 8,
  return: 12,
  done: 13,
}

const PART_BY_PHASE: Readonly<Record<ConditionalPhase, ConditionalSourcePart>> = {
  main: 'main-signature',
  'init-score': 'score-initializer',
  'init-attendance': 'attendance-initializer',
  'compare-score': 'score-comparison',
  'short-circuit': 'logical-operator',
  'compare-attendance': 'attendance-comparison',
  combine: 'logical-operator',
  'if-branch': 'if-keyword',
  'else-branch': 'else-keyword',
  print: 'printf-pass',
  return: 'return',
  done: 'exit',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeInteger(
  value: number,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return fallback
  return clamp(Math.trunc(value), min, max)
}

export function normalizeConditionalConfig(
  config: ConditionalConfig = DEFAULT_CONDITIONAL_CONFIG,
): Readonly<ConditionalConfig> {
  return {
    score: normalizeInteger(
      config.score,
      DEFAULT_CONDITIONAL_CONFIG.score,
      CONDITIONAL_LIMITS.score.min,
      CONDITIONAL_LIMITS.score.max,
    ),
    attendance: normalizeInteger(
      config.attendance,
      DEFAULT_CONDITIONAL_CONFIG.attendance,
      CONDITIONAL_LIMITS.attendance.min,
      CONDITIONAL_LIMITS.attendance.max,
    ),
    logicalOperator: CONDITIONAL_LOGICAL_OPERATORS.includes(config.logicalOperator)
      ? config.logicalOperator
      : DEFAULT_CONDITIONAL_CONFIG.logicalOperator,
  }
}

function booleanLabel(value: boolean): string {
  return value ? '真' : '假'
}

function buildConditionExpression(config: Readonly<ConditionalConfig>): string {
  return `score >= ${CONDITIONAL_LIMITS.scoreThreshold} ${config.logicalOperator} attendance >= ${CONDITIONAL_LIMITS.attendanceThreshold}`
}

export function buildConditionalSource(
  config: ConditionalConfig = DEFAULT_CONDITIONAL_CONFIG,
): GeneratedConditionalSource {
  const stableConfig = normalizeConditionalConfig(config)
  const scoreExpression = `score >= ${CONDITIONAL_LIMITS.scoreThreshold}`
  const attendanceExpression = `attendance >= ${CONDITIONAL_LIMITS.attendanceThreshold}`
  const conditionExpression = buildConditionExpression(stableConfig)

  return {
    lines: [
      { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
      { lineNumber: 2, code: '', phases: [] },
      { lineNumber: 3, code: 'int main(void) {', phases: ['main'] },
      {
        lineNumber: 4,
        code: `  int score = ${stableConfig.score};`,
        phases: ['init-score'],
      },
      {
        lineNumber: 5,
        code: `  int attendance = ${stableConfig.attendance};`,
        phases: ['init-attendance'],
      },
      { lineNumber: 6, code: '', phases: [] },
      {
        lineNumber: 7,
        code: `  if (${conditionExpression}) {`,
        phases: [
          'compare-score',
          'short-circuit',
          'compare-attendance',
          'combine',
          'if-branch',
        ],
      },
      {
        lineNumber: 8,
        code: '    printf("通過\\n");',
        phases: ['print'],
      },
      { lineNumber: 9, code: '  } else {', phases: ['else-branch'] },
      {
        lineNumber: 10,
        code: '    printf("再練習\\n");',
        phases: ['print'],
      },
      { lineNumber: 11, code: '  }', phases: [] },
      { lineNumber: 12, code: '  return 0;', phases: ['return'] },
      { lineNumber: 13, code: '}', phases: ['done'] },
    ],
    lineByPhase: LINE_BY_PHASE,
    partByPhase: PART_BY_PHASE,
    scoreExpression,
    attendanceExpression,
    conditionExpression,
  }
}

export function compareConditionalValues(
  value: number,
  threshold: number,
): boolean {
  return value >= threshold
}

export function combineConditionalValues(
  scorePasses: boolean,
  attendancePasses: boolean,
  logicalOperator: ConditionalLogicalOperator,
): boolean {
  return logicalOperator === '&&'
    ? scorePasses && attendancePasses
    : scorePasses || attendancePasses
}

export function simulateConditional(
  config: ConditionalConfig = DEFAULT_CONDITIONAL_CONFIG,
): ConditionalSimulationResult {
  const stableConfig = normalizeConditionalConfig(config)
  const source = buildConditionalSource(stableConfig)
  const frames: ConditionalFrame[] = []
  const output: string[] = []
  let scorePasses: boolean | null = null
  let attendancePasses: boolean | null = null
  let conditionResult: boolean | null = null
  let selectedBranch: ConditionalBranch = null
  let skippedComparison: ConditionalSkippedComparison = null

  const addFrame = (
    phase: ConditionalPhase,
    explanation: string,
    overrides: Partial<ConditionalFrame> = {},
  ) => {
    frames.push({
      index: frames.length,
      phase,
      score: stableConfig.score,
      attendance: stableConfig.attendance,
      scorePasses,
      attendancePasses,
      conditionResult,
      selectedBranch,
      skippedComparison,
      output: [...output],
      activeLine: source.lineByPhase[phase],
      activePart: source.partByPhase[phase],
      explanation,
      ...overrides,
    })
  }

  addFrame('main', '進入 main 函式，程式從這裡開始執行。')
  addFrame('init-score', `宣告 int score，並初始化為 ${stableConfig.score}。`)
  addFrame(
    'init-attendance',
    `宣告 int attendance，並初始化為 ${stableConfig.attendance}。`,
  )

  scorePasses = compareConditionalValues(
    stableConfig.score,
    CONDITIONAL_LIMITS.scoreThreshold,
  )
  addFrame(
    'compare-score',
    `先判斷 ${source.scoreExpression}，${stableConfig.score} >= ${CONDITIONAL_LIMITS.scoreThreshold} 為${booleanLabel(scorePasses)}。`,
  )

  const shouldShortCircuit = stableConfig.logicalOperator === '&&'
    ? !scorePasses
    : scorePasses

  if (shouldShortCircuit) {
    skippedComparison = 'attendance'
    conditionResult = scorePasses
    addFrame(
      'short-circuit',
      stableConfig.logicalOperator === '&&'
        ? '左側為假；&& 需要兩邊都為真，因此短路略過 attendance 的比較。'
        : '左側為真；|| 只要一邊為真，因此短路略過 attendance 的比較。',
    )
  } else {
    attendancePasses = compareConditionalValues(
      stableConfig.attendance,
      CONDITIONAL_LIMITS.attendanceThreshold,
    )
    addFrame(
      'compare-attendance',
      `再判斷 ${source.attendanceExpression}，${stableConfig.attendance} >= ${CONDITIONAL_LIMITS.attendanceThreshold} 為${booleanLabel(attendancePasses)}。`,
    )
  }

  if (attendancePasses === null) {
    conditionResult = scorePasses
  } else {
    conditionResult = combineConditionalValues(
      scorePasses,
      attendancePasses,
      stableConfig.logicalOperator,
    )
  }
  addFrame(
    'combine',
    `依 ${stableConfig.logicalOperator} 合併條件，整體結果為${booleanLabel(conditionResult)}。`,
  )

  selectedBranch = conditionResult ? 'if' : 'else'
  addFrame(
    selectedBranch === 'if' ? 'if-branch' : 'else-branch',
    conditionResult
      ? '條件為真，進入 if 分支。'
      : '條件為假，跳到 else 分支。',
  )

  const printedText = conditionResult ? '通過' : '再練習'
  output.push(printedText)
  addFrame('print', `printf 輸出「${printedText}」。`, {
    activeLine: conditionResult ? 8 : 10,
    activePart: conditionResult ? 'printf-pass' : 'printf-practice',
    selectedBranch,
  })
  addFrame('return', 'return 0，main 函式準備結束。', { selectedBranch })
  addFrame('done', '條件判斷完成，程式正常結束。', { selectedBranch })

  return {
    config: stableConfig,
    source,
    frames,
    output: [...output],
    scorePasses,
    attendancePasses: attendancePasses ?? false,
    conditionResult,
    selectedBranch,
    shortCircuited: skippedComparison !== null,
    status: 'completed',
    message: conditionResult
      ? '條件為真，程式輸出「通過」。'
      : '條件為假，程式輸出「再練習」。',
  }
}
