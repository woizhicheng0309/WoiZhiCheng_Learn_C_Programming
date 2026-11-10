import {
  type PointerTarget,
  type PointerConfig,
  DEFAULT_POINTER_CONFIG,
  type PointerValidationIssue,
  validatePointerConfig,
} from './pointersConfig'

export {
  type PointerTarget,
  type PointerConfig,
  POINTER_LIMITS,
  DEFAULT_POINTER_CONFIG,
  type PointerValidationIssue,
  validatePointerConfig,
} from './pointersConfig'

export type PointerPhase =
  | 'enter-main'
  | 'declare-values'
  | 'bind-pointer'
  | 'read-pointer'
  | 'write-pointer'
  | 'print'
  | 'return-main'
  | 'done'
  | 'blocked'

export interface PointerSourceLine {
  lineNumber: number
  code: string
  phases: readonly PointerPhase[]
}

export interface GeneratedPointerSource {
  lines: readonly PointerSourceLine[]
  sourceText: string
}

export interface PointerMemory {
  x: number | null
  y: number | null
  /** null means p is not declared; 'null' means p holds the C null pointer. */
  pointerTarget: PointerTarget | null
  selected: number | null
  valuesDeclared: boolean
  pointerDeclared: boolean
  selectedDeclared: boolean
  inScope: boolean
}

export interface PointerFrame {
  index: number
  phase: PointerPhase
  activeLine: number
  activePart: `line-${number}`
  explanation: string
  memory: Readonly<PointerMemory>
  outputText: string | null
  accessKind: 'none' | 'read' | 'write'
}

export interface PointerSimulationResult {
  config: Readonly<PointerConfig>
  source: GeneratedPointerSource
  frames: readonly PointerFrame[]
  outputText: string | null
  selectedValue: number | null
  status: 'completed' | 'blocked'
  message: string
  validationIssues: readonly PointerValidationIssue[]
}

function integerLiteral(value: number): string {
  return Number.isFinite(value) && Number.isInteger(value)
    ? String(value)
    : '0 /* invalid integer: simulation blocked */'
}

export function buildPointerSource(
  config: PointerConfig = DEFAULT_POINTER_CONFIG,
): GeneratedPointerSource {
  const target = config.target === 'x' || config.target === 'y'
    ? `&${config.target}`
    : config.target === 'null'
      ? 'NULL'
      : 'NULL /* invalid target: simulation blocked */'
  const lines: PointerSourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    { lineNumber: 3, code: 'int main(void) {', phases: ['enter-main'] },
    { lineNumber: 4, code: `  int x = ${integerLiteral(config.x)};`, phases: [] },
    { lineNumber: 5, code: `  int y = ${integerLiteral(config.y)};`, phases: ['declare-values'] },
    { lineNumber: 6, code: `  int *p = ${target};`, phases: ['bind-pointer'] },
    { lineNumber: 7, code: '  int selected = *p;', phases: ['read-pointer', 'blocked'] },
    { lineNumber: 8, code: `  *p = ${integerLiteral(config.newValue)};`, phases: ['write-pointer'] },
    { lineNumber: 9, code: '  printf("%d -> %d\\n", selected, *p);', phases: ['print'] },
    { lineNumber: 10, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 11, code: '}', phases: ['done'] },
  ]
  return { lines, sourceText: lines.map((line) => line.code).join('\n') }
}

export function simulatePointerProgram(
  config: PointerConfig = DEFAULT_POINTER_CONFIG,
): PointerSimulationResult {
  const stableConfig = {
    x: config.x,
    y: config.y,
    newValue: config.newValue,
    target: config.target,
  }
  const source = buildPointerSource(stableConfig)
  const validationIssues = validatePointerConfig(stableConfig)
  const frames: PointerFrame[] = []
  const memory: PointerMemory = {
    x: null,
    y: null,
    pointerTarget: null,
    selected: null,
    valuesDeclared: false,
    pointerDeclared: false,
    selectedDeclared: false,
    inScope: true,
  }
  let outputText: string | null = null
  let selectedValue: number | null = null

  const addFrame = (
    phase: PointerPhase,
    activeLine: number,
    explanation: string,
    accessKind: PointerFrame['accessKind'] = 'none',
  ) => {
    frames.push({
      index: frames.length,
      phase,
      activeLine,
      activePart: `line-${activeLine}`,
      explanation,
      memory: { ...memory },
      outputText,
      accessKind,
    })
  }

  const result = (
    status: PointerSimulationResult['status'],
    message: string,
  ): PointerSimulationResult => ({
    config: stableConfig,
    source,
    frames,
    outputText,
    selectedValue,
    status,
    message,
    validationIssues,
  })

  addFrame('enter-main', 3, '進入 main，準備建立兩個整數變數與一個指標。')

  if (validationIssues.length > 0) {
    const lineByField = { x: 4, y: 5, target: 6, newValue: 8 }
    const message = validationIssues.map((issue) => issue.message).join(' ')
    addFrame('blocked', lineByField[validationIssues[0].field], `輸入不符合練習限制，模擬器停止：${message}`)
    return result('blocked', message)
  }

  memory.x = stableConfig.x
  memory.y = stableConfig.y
  memory.valuesDeclared = true
  addFrame('declare-values', 5, `宣告並初始化 x = ${memory.x}、y = ${memory.y}；兩者各自擁有一個記憶格。`)

  memory.pointerDeclared = true
  memory.pointerTarget = stableConfig.target
  addFrame(
    'bind-pointer',
    6,
    stableConfig.target === 'null'
      ? '將 p 設為 NULL。p 已初始化，但沒有指向任何可存取的 int 物件。'
      : `&${stableConfig.target} 取得 ${stableConfig.target} 的位址，p 保存這個位址；p 不會複製變數的整數值。`,
  )

  if (stableConfig.target === 'null') {
    const message = 'p 是 NULL，不能解參照。模擬器在讀取 *p 前停止；真實 C 程式的這項存取屬於未定義行為，不能假定會讀到 0 或固定結果。'
    addFrame('blocked', 7, message)
    return result('blocked', message)
  }

  const target = stableConfig.target
  selectedValue = memory[target]
  memory.selected = selectedValue
  memory.selectedDeclared = true
  addFrame('read-pointer', 7, `*p 沿著 p 保存的位址讀取 ${target}，把值 ${selectedValue} 複製給 selected。`, 'read')

  memory[target] = stableConfig.newValue
  addFrame('write-pointer', 8, `*p = ${stableConfig.newValue} 直接改寫 ${target} 的記憶格；p 仍指向 ${target}，selected 保留原值 ${selectedValue}。`, 'write')

  outputText = `${selectedValue} -> ${memory[target]}`
  addFrame('print', 9, `printf 輸出 selected 保存的舊值 ${selectedValue}，以及 *p 讀到的新值 ${memory[target]}。`, 'read')
  addFrame('return-main', 10, 'return 0 表示 main 正常結束。')
  memory.inScope = false
  const message = `程式正常完成：透過 p 將 ${target} 從 ${selectedValue} 改為 ${stableConfig.newValue}，輸出「${outputText}」。`
  addFrame('done', 11, `${message}main 的區域變數已離開作用域。`)
  return result('completed', message)
}
