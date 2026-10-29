export type SwapMode = 'value' | 'pointer'

export interface SwapConfig {
  x: number
  y: number
  mode: SwapMode
}

export const SWAP_LIMITS = { min: -20, max: 100 } as const
export const DEFAULT_SWAP_CONFIG: Readonly<SwapConfig> = {
  x: 5,
  y: 9,
  mode: 'value',
}

export type SwapPhase =
  | 'enter-main'
  | 'init-x'
  | 'init-y'
  | 'call-swap'
  | 'bind-parameters'
  | 'save-temp'
  | 'write-first'
  | 'write-second'
  | 'return-swap'
  | 'print'
  | 'return-main'
  | 'done'
  | 'blocked'

export interface SwapValidationIssue {
  field: keyof SwapConfig
  message: string
}

export interface SwapSourceLine {
  lineNumber: number
  code: string
  phases: readonly SwapPhase[]
}

export interface GeneratedSwapSource {
  lines: readonly SwapSourceLine[]
  sourceText: string
}

export interface SwapMemory {
  main: {
    x: number | null
    y: number | null
    status: 'active' | 'suspended' | 'returned'
  }
  swap: {
    a: number | '&x' | '&y' | null
    b: number | '&x' | '&y' | null
    temp: number | null
    status: 'not-created' | 'active' | 'returned'
  }
}

export interface SwapFrame {
  index: number
  phase: SwapPhase
  activeLine: number
  activePart: `line-${number}`
  explanation: string
  activeFunction: 'main' | 'swap' | null
  changedVariable: 'x' | 'y' | 'a' | 'b' | 'temp' | null
  memory: {
    readonly main: Readonly<SwapMemory['main']>
    readonly swap: Readonly<SwapMemory['swap']>
  }
  outputText: string | null
}

export interface SwapSimulationResult {
  config: Readonly<SwapConfig>
  source: GeneratedSwapSource
  frames: readonly SwapFrame[]
  outputText: string | null
  status: 'completed' | 'blocked'
  validationIssues: readonly SwapValidationIssue[]
  message: string
}

export function validateSwapConfig(
  config: SwapConfig = DEFAULT_SWAP_CONFIG,
): readonly SwapValidationIssue[] {
  const issues: SwapValidationIssue[] = []
  for (const field of ['x', 'y'] as const) {
    const value = config[field]
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      issues.push({ field, message: `${field} 必須是有限整數。` })
    } else if (value < SWAP_LIMITS.min || value > SWAP_LIMITS.max) {
      issues.push({
        field,
        message: `這個練習的 ${field} 必須介於 ${SWAP_LIMITS.min} 到 ${SWAP_LIMITS.max}。`,
      })
    }
  }
  if (config.mode !== 'value' && config.mode !== 'pointer') {
    issues.push({ field: 'mode', message: '請選擇複製整數值或複製位址的交換方式。' })
  }
  return issues
}

function integerLiteral(value: number): string {
  return Number.isFinite(value) && Number.isInteger(value)
    ? String(value)
    : '0 /* invalid integer: simulation blocked */'
}

export function buildSwapSource(
  config: SwapConfig = DEFAULT_SWAP_CONFIG,
): GeneratedSwapSource {
  const pointerMode = config.mode === 'pointer'
  const lines: SwapSourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    {
      lineNumber: 3,
      code: pointerMode ? 'void swap(int *a, int *b) {' : 'void swap(int a, int b) {',
      phases: ['bind-parameters'],
    },
    { lineNumber: 4, code: pointerMode ? '  int temp = *a;' : '  int temp = a;', phases: ['save-temp'] },
    { lineNumber: 5, code: pointerMode ? '  *a = *b;' : '  a = b;', phases: ['write-first'] },
    { lineNumber: 6, code: pointerMode ? '  *b = temp;' : '  b = temp;', phases: ['write-second'] },
    { lineNumber: 7, code: '}', phases: ['return-swap'] },
    { lineNumber: 8, code: '', phases: [] },
    { lineNumber: 9, code: 'int main(void) {', phases: ['enter-main'] },
    { lineNumber: 10, code: `  int x = ${integerLiteral(config.x)};`, phases: ['init-x', 'blocked'] },
    { lineNumber: 11, code: `  int y = ${integerLiteral(config.y)};`, phases: ['init-y', 'blocked'] },
    { lineNumber: 12, code: pointerMode ? '  swap(&x, &y);' : '  swap(x, y);', phases: ['call-swap', 'blocked'] },
    { lineNumber: 13, code: '  printf("%d %d\\n", x, y);', phases: ['print'] },
    { lineNumber: 14, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 15, code: '}', phases: ['done'] },
  ]
  return { lines, sourceText: lines.map((line) => line.code).join('\n') }
}

export function simulateSwapProgram(
  config: SwapConfig = DEFAULT_SWAP_CONFIG,
): SwapSimulationResult {
  const stableConfig = { x: config.x, y: config.y, mode: config.mode }
  const source = buildSwapSource(stableConfig)
  const validationIssues = validateSwapConfig(stableConfig)
  const frames: SwapFrame[] = []
  const memory: SwapMemory = {
    main: { x: null, y: null, status: 'active' },
    swap: { a: null, b: null, temp: null, status: 'not-created' },
  }
  let outputText: string | null = null
  const addFrame = (
    phase: SwapPhase,
    activeLine: number,
    explanation: string,
    activeFunction: SwapFrame['activeFunction'],
    changedVariable: SwapFrame['changedVariable'] = null,
  ) => frames.push({
    index: frames.length,
    phase,
    activeLine,
    activePart: `line-${activeLine}`,
    explanation,
    activeFunction,
    changedVariable,
    memory: { main: { ...memory.main }, swap: { ...memory.swap } },
    outputText,
  })
  const result = (
    status: SwapSimulationResult['status'],
    message: string,
  ): SwapSimulationResult => ({
    config: stableConfig,
    source,
    frames,
    outputText,
    status,
    validationIssues,
    message,
  })

  addFrame('enter-main', 9, '從 main 開始執行，swap 的函式框架尚未建立。', 'main')
  if (validationIssues.length > 0) {
    const lineByField = { x: 10, y: 11, mode: 12 }
    const message = validationIssues.map((issue) => issue.message).join(' ')
    addFrame('blocked', lineByField[validationIssues[0].field], `輸入不符合練習限制，模擬器停止：${message}`, 'main')
    return result('blocked', message)
  }

  memory.main.x = stableConfig.x
  addFrame('init-x', 10, `在 main 的框架中宣告 x，初始化為 ${stableConfig.x}。`, 'main', 'x')
  memory.main.y = stableConfig.y
  addFrame('init-y', 11, `在 main 的框架中宣告 y，初始化為 ${stableConfig.y}。`, 'main', 'y')

  const pointerMode = stableConfig.mode === 'pointer'
  addFrame(
    'call-swap',
    12,
    pointerMode
      ? '呼叫 swap(&x, &y)：計算 x、y 的位址，準備把這兩個位址值複製給參數。C 的引數一律以值傳遞。'
      : `呼叫 swap(x, y)：讀取 ${stableConfig.x} 與 ${stableConfig.y}，準備把整數值複製給參數。C 的引數一律以值傳遞。`,
    'main',
  )
  memory.main.status = 'suspended'
  memory.swap.status = 'active'
  memory.swap.a = pointerMode ? '&x' : stableConfig.x
  memory.swap.b = pointerMode ? '&y' : stableConfig.y
  addFrame(
    'bind-parameters',
    3,
    pointerMode
      ? '建立 swap 框架：a 收到 &x 的位址副本，b 收到 &y 的位址副本。參數本身仍是區域變數；main 暫停等待。'
      : `建立 swap 框架：a 收到 ${stableConfig.x} 的整數副本，b 收到 ${stableConfig.y} 的整數副本。它們與 main 的 x、y 是不同變數。`,
    'swap',
  )

  memory.swap.temp = stableConfig.x
  addFrame(
    'save-temp',
    4,
    pointerMode
      ? `沿著 a 保存的位址讀取 x，把原值 ${stableConfig.x} 複製到 swap 的 temp，避免接著改寫時遺失。`
      : `先把區域參數 a 的原值 ${stableConfig.x} 複製到 temp，保留交換前的值。`,
    'swap',
    'temp',
  )

  if (pointerMode) memory.main.x = stableConfig.y
  else memory.swap.a = stableConfig.y
  addFrame(
    'write-first',
    5,
    pointerMode
      ? `*a = *b 讀取 y 的 ${stableConfig.y}，寫入 x。main 的 x 現在是 ${stableConfig.y}；a、b 保存的位址副本不變。`
      : `a = b 把 ${stableConfig.y} 寫進 swap 的 a；main 的 x 仍是 ${stableConfig.x}，沒有被改寫。`,
    'swap',
    pointerMode ? 'x' : 'a',
  )

  if (pointerMode) memory.main.y = memory.swap.temp
  else memory.swap.b = memory.swap.temp
  addFrame(
    'write-second',
    6,
    pointerMode
      ? `*b = temp 將保留的 ${stableConfig.x} 寫回 y，完成 x、y 的交換；a 仍保存 &x，b 仍保存 &y。`
      : `b = temp 把保留的 ${stableConfig.x} 寫進 swap 的 b。只交換了區域副本，main 的 x、y 都保持原值。`,
    'swap',
    pointerMode ? 'y' : 'b',
  )

  memory.swap.status = 'returned'
  memory.main.status = 'active'
  addFrame('return-swap', 7, 'swap 執行完畢，a、b、temp 離開作用域，控制流程回到 main。框架中的數值僅保留為追蹤紀錄。', 'main')

  outputText = `${memory.main.x} ${memory.main.y}`
  addFrame('print', 13, `main 讀取自己的 x、y，printf 輸出「${outputText}」。`, 'main')
  addFrame('return-main', 14, 'return 0 表示 main 正常結束。', 'main')
  memory.main.status = 'returned'
  const message = pointerMode
    ? `交換完成，main 輸出「${outputText}」；複製位址讓 swap 可以透過指標改寫呼叫端的變數。`
    : `main 輸出「${outputText}」；swap 只交換自己的整數副本，沒有改變呼叫端的變數。`
  addFrame('done', 15, `${message}main 的區域變數也已離開作用域。`, null)
  return result('completed', message)
}
