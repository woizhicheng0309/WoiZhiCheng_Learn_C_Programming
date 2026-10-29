export type StringSample = 'word' | 'digit-zero' | 'embedded-nul'
export type StringStop = 'nul' | 'digit-zero'

export interface StringPointerConfig {
  sample: StringSample
  stopAt: StringStop
}

export interface StringPointerSample {
  readonly id: StringSample
  readonly label: string
  /** Escaped C literal content, without the surrounding double quotes. */
  readonly literal: string
  /** Stored chars, including the implicit final NUL; NUL is actual U+0000. */
  readonly characters: readonly string[]
}

export const STRING_POINTER_SAMPLES: readonly StringPointerSample[] = Object.freeze([
  Object.freeze({ id: 'word', label: 'CODE：一般字串', literal: 'CODE', characters: Object.freeze(['C', 'O', 'D', 'E', '\0']) }),
  Object.freeze({ id: 'digit-zero', label: 'C0DE：包含數字字元 0', literal: 'C0DE', characters: Object.freeze(['C', '0', 'D', 'E', '\0']) }),
  Object.freeze({ id: 'embedded-nul', label: 'CO\\0DE：中途遇到空字元', literal: 'CO\\0DE', characters: Object.freeze(['C', 'O', '\0', 'D', 'E', '\0']) }),
])

export const DEFAULT_STRING_POINTER_CONFIG: Readonly<StringPointerConfig> = {
  sample: 'word',
  stopAt: 'nul',
}

export type StringPointerPhase =
  | 'enter-main'
  | 'initialize-string'
  | 'bind-pointer'
  | 'initialize-length'
  | 'condition'
  | 'read-character'
  | 'increment-length'
  | 'advance-pointer'
  | 'print-length'
  | 'return-main'
  | 'done'
  | 'blocked'

export interface StringPointerValidationIssue {
  field: keyof StringPointerConfig
  message: string
}

export interface StringPointerSourceLine {
  lineNumber: number
  code: string
  phases: readonly StringPointerPhase[]
}

export interface GeneratedStringPointerSource {
  lines: readonly StringPointerSourceLine[]
  sourceText: string
}

export interface StringPointerMemory {
  characters: readonly string[] | null
  pointerIndex: number | null
  length: number | null
  inScope: boolean
}

export interface StringPointerFrame {
  index: number
  phase: StringPointerPhase
  activeLine: number
  activePart: `line-${number}`
  explanation: string
  memory: Readonly<StringPointerMemory>
  /** Actual dereference index, never a fabricated one-past read. */
  readIndex: number | null
  conditionCharacter: string | null
  conditionResult: boolean | null
  output: readonly string[]
  /** Visualization of putchar bytes: raw NUL is displayed as two chars, \\0. */
  outputText: string
}

export interface StringPointerSimulationResult {
  config: Readonly<StringPointerConfig>
  source: GeneratedStringPointerSource
  frames: readonly StringPointerFrame[]
  output: readonly string[]
  outputText: string
  length: number | null
  status: 'completed' | 'blocked'
  blockReason: 'invalid-config' | 'out-of-bounds' | null
  validationIssues: readonly StringPointerValidationIssue[]
  message: string
}

export function getStringPointerSample(sample: StringSample): StringPointerSample | undefined {
  return STRING_POINTER_SAMPLES.find((candidate) => candidate.id === sample)
}

export function validateStringPointerConfig(
  config: StringPointerConfig = DEFAULT_STRING_POINTER_CONFIG,
): readonly StringPointerValidationIssue[] {
  const issues: StringPointerValidationIssue[] = []
  if (!getStringPointerSample(config.sample)) {
    issues.push({ field: 'sample', message: '請選擇 CODE、C0DE 或 CO\\0DE 字串範例。' })
  }
  if (config.stopAt !== 'nul' && config.stopAt !== 'digit-zero') {
    issues.push({ field: 'stopAt', message: "停止條件只能選擇空字元 '\\0' 或數字字元 '0'。" })
  }
  return issues
}

export function buildStringPointerSource(
  config: StringPointerConfig = DEFAULT_STRING_POINTER_CONFIG,
): GeneratedStringPointerSource {
  const sample = getStringPointerSample(config.sample) ?? STRING_POINTER_SAMPLES[0]
  const stop = config.stopAt === 'digit-zero' ? "'0'" : "'\\0'"
  const lines: StringPointerSourceLine[] = [
    { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
    { lineNumber: 2, code: '', phases: [] },
    { lineNumber: 3, code: 'int main(void) {', phases: ['enter-main'] },
    { lineNumber: 4, code: `  char text[] = "${sample.literal}";`, phases: ['initialize-string', 'blocked'] },
    { lineNumber: 5, code: '  char *p = text;', phases: ['bind-pointer'] },
    { lineNumber: 6, code: '  int length = 0;', phases: ['initialize-length'] },
    { lineNumber: 7, code: `  while (*p != ${stop}) {`, phases: ['condition', 'blocked'] },
    { lineNumber: 8, code: '    putchar(*p);', phases: ['read-character'] },
    { lineNumber: 9, code: '    length++;', phases: ['increment-length'] },
    { lineNumber: 10, code: '    p++;', phases: ['advance-pointer'] },
    { lineNumber: 11, code: '  }', phases: [] },
    { lineNumber: 12, code: '  printf("\\nlength = %d\\n", length);', phases: ['print-length'] },
    { lineNumber: 13, code: '  return 0;', phases: ['return-main'] },
    { lineNumber: 14, code: '}', phases: ['done'] },
  ]
  return { lines, sourceText: lines.map((line) => line.code).join('\n') }
}

function visualizeOutput(characters: readonly string[]): string {
  return characters.map((character) => character === '\0' ? '\\0' : character).join('')
}

function describeCharacter(character: string): string {
  return character === '\0' ? "空字元 '\\0'（碼值 0）" : `字元 '${character}'`
}

export function simulateStringPointerProgram(
  config: StringPointerConfig = DEFAULT_STRING_POINTER_CONFIG,
): StringPointerSimulationResult {
  const stableConfig = { sample: config.sample, stopAt: config.stopAt }
  const source = buildStringPointerSource(stableConfig)
  const validationIssues = validateStringPointerConfig(stableConfig)
  const frames: StringPointerFrame[] = []
  const output: string[] = []
  const memory: StringPointerMemory = {
    characters: null,
    pointerIndex: null,
    length: null,
    inScope: true,
  }
  const addFrame = (
    phase: StringPointerPhase,
    activeLine: number,
    explanation: string,
    options: { readIndex?: number; conditionCharacter?: string; conditionResult?: boolean } = {},
  ) => frames.push({
    index: frames.length,
    phase,
    activeLine,
    activePart: `line-${activeLine}`,
    explanation,
    memory: { ...memory, characters: memory.characters ? [...memory.characters] : null },
    readIndex: options.readIndex ?? null,
    conditionCharacter: options.conditionCharacter ?? null,
    conditionResult: options.conditionResult ?? null,
    output: [...output],
    outputText: visualizeOutput(output),
  })
  const result = (
    status: StringPointerSimulationResult['status'],
    blockReason: StringPointerSimulationResult['blockReason'],
    message: string,
  ): StringPointerSimulationResult => ({
    config: stableConfig,
    source,
    frames,
    output: [...output],
    outputText: visualizeOutput(output),
    length: memory.length,
    status,
    blockReason,
    validationIssues,
    message,
  })

  addFrame('enter-main', 3, '進入 main，準備建立可修改的 char 陣列，用指標逐字元走訪。')
  if (validationIssues.length > 0) {
    const message = validationIssues.map((issue) => issue.message).join(' ')
    addFrame('blocked', validationIssues[0].field === 'sample' ? 4 : 7, `輸入不符合練習限制，模擬器在初始化前停止：${message}`)
    return result('blocked', 'invalid-config', message)
  }

  const sample = getStringPointerSample(stableConfig.sample)!
  const stopCharacter = stableConfig.stopAt === 'nul' ? '\0' : '0'
  memory.characters = [...sample.characters]
  addFrame('initialize-string', 4, `char text[] 用字串常值初始化，複製出 ${sample.characters.length} 個 char 記憶格，包含隱含的最後一個 '\\0'。text 是陣列物件，不是指標變數。`)
  memory.pointerIndex = 0
  addFrame('bind-pointer', 5, '這個運算式中的 text 轉換為指向第一個元素的指標值，複製給 p；p 從 text[0] 開始。')
  memory.length = 0
  addFrame('initialize-length', 6, '把 length 初始化為 0，每輸出一個字元才會增加一次。')

  for (let index = 0; ; index += 1) {
    if (index >= sample.characters.length) {
      const message = `p 現在位於 text + ${sample.characters.length}，是可以形成、不可解參照的尾端下一格指標。模擬器在 while 讀取 *p 前停止；真實 C 程式若繼續存取會產生未定義行為，不能假定完整輸出。先前的 ${output.length} 個 putchar 輸出位元組保留在模擬紀錄中。`
      addFrame('blocked', 7, message)
      return result('blocked', 'out-of-bounds', message)
    }
    const character = sample.characters[index]
    const condition = character !== stopCharacter
    addFrame(
      'condition',
      7,
      `先合法讀取 text[${index}] 的${describeCharacter(character)}，再比較是否不等於${describeCharacter(stopCharacter)}：結果為 ${condition ? 'true，進入迴圈。' : 'false，停止走訪；本次不呼叫 putchar，也不增加 length。'}`,
      { readIndex: index, conditionCharacter: character, conditionResult: condition },
    )
    if (!condition) break

    output.push(character)
    addFrame(
      'read-character',
      8,
      character === '\0'
        ? `putchar(*p) 再次讀取 text[${index}]，輸出一個不可見的 NUL 位元組。畫面用 \\0 標記它，並非真的印出反斜線和 0；這不是正常的字串終止走訪。`
        : `putchar(*p) 再次讀取 text[${index}]，輸出字元 '${character}'。`,
      { readIndex: index },
    )
    memory.length += 1
    addFrame('increment-length', 9, `length++ 將計數增加為 ${memory.length}；它計算已執行 putchar 的次數，沒有再次讀取 *p。`)
    memory.pointerIndex = index + 1
    addFrame(
      'advance-pointer',
      10,
      `p++ 前進一個 char 元素，現在 p = text + ${memory.pointerIndex}；移動本身不會讀取該位置。${memory.pointerIndex === sample.characters.length ? '這是陣列尾端下一格，可以形成這個指標，但不可解參照。' : ''}`,
    )
  }

  addFrame('print-length', 12, `printf 換行後輸出 length = ${memory.length}；字元輸出區只記錄迴圈的 putchar 位元組，計數另外呈現。`)
  addFrame('return-main', 13, 'return 0 表示 main 正常結束。')
  memory.inScope = false
  const message = stableConfig.stopAt === 'nul'
    ? `遇到第一個空字元 '\\0' 時停止，字串長度為 ${memory.length}，終止空字元本身沒有輸出或計入長度。`
    : `遇到數字字元 '0' 時提前停止，計數為 ${memory.length}。在本課的 ASCII 範例中，'0' 的碼值是 48，與碼值為 0 的空字元 '\\0' 不同。`
  addFrame('done', 14, `${message}main 的區域變數已離開作用域。`)
  return result('completed', null, message)
}
