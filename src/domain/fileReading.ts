import {
  FILE_READING_DATASETS,
  type FileReadingConfig,
  DEFAULT_FILE_READING_CONFIG,
  validateFileReadingConfig,
} from './fileReadingConfig'

export {
  FILE_READING_DATASETS,
  FILE_READING_OUTCOMES,
  type FileReadingConfig,
  DEFAULT_FILE_READING_CONFIG,
  validateFileReadingConfig,
} from './fileReadingConfig'

export type FileReadingPhase = 'prepare' | 'enter-main' | 'open' | 'check-open' | 'print-open-failure' | 'return-open-failure'
  | 'declare-buffer' | 'initialize-reads' | 'read-attempt' | 'while-condition' | 'count-read' | 'print-chunk'
  | 'capture-read-error' | 'close' | 'check-errors' | 'print-io-failure' | 'return-io-failure'
  | 'print-summary' | 'return-success' | 'done' | 'blocked'
export type FileStreamStatus = 'not-opened' | 'open' | 'closed' | 'disassociated'
export interface FileReadingFrame {
  index: number
  phase: FileReadingPhase
  activeLine: number
  activePart: string
  explanation: string
  mainInScope: boolean
  pointer: 'undeclared' | 'stream' | 'null' | 'invalidated'
  streamStatus: FileStreamStatus
  /** Logical character index in the simulated text stream, not an ftell byte offset. */
  position: number | null
  buffer: readonly (string | null)[] | null
  bufferState: 'undeclared' | 'uninitialized' | 'valid' | 'indeterminate'
  currentString: string | null
  readResult: 'not-called' | 'buffer' | 'null'
  eof: boolean | null
  error: boolean | null
  reads: number | null
  readFailed: boolean | null
  closeFailed: boolean | null
  condition: { expression: string; value: boolean } | null
  printedValues: readonly number[] | null
  exitCode: number | null
  output: readonly string[]
}
export function buildFileReadingSource(config: FileReadingConfig = DEFAULT_FILE_READING_CONFIG) {
  const safe = validateFileReadingConfig(config).length ? DEFAULT_FILE_READING_CONFIG : config
  const code = ['#include <stdio.h>', '', 'int main(void) {', '  FILE *fp = fopen("notes.txt", "r");',
    '  if (fp == NULL) {', '    puts("open failed");', '    return 1;', '  }', `  char buffer[${safe.bufferSize}];`,
    '  int reads = 0;', '  while (fgets(buffer, sizeof buffer, fp) != NULL) {', '    reads++;',
    '    printf("[%d] %s", reads, buffer);', '  }', '  int read_failed = ferror(fp) != 0;',
    '  int close_failed = fclose(fp) != 0;', '  if (read_failed || close_failed) {', '    puts("\\nI/O failed");',
    '    return 2;', '  }', '  printf("\\nreads=%d\\n", reads);', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateFileReadingProgram(config: FileReadingConfig = DEFAULT_FILE_READING_CONFIG) {
  const stableConfig = { dataset: config.dataset, outcome: config.outcome, bufferSize: config.bufferSize }
  const source = buildFileReadingSource(stableConfig)
  const issues = validateFileReadingConfig(stableConfig)
  const frames: FileReadingFrame[] = []
  let mainInScope = false
  let pointer: FileReadingFrame['pointer'] = 'undeclared'
  let streamStatus: FileStreamStatus = 'not-opened'
  let position: number | null = null
  let buffer: (string | null)[] | null = null
  let bufferState: FileReadingFrame['bufferState'] = 'undeclared'
  let currentString: string | null = null
  let readResult: FileReadingFrame['readResult'] = 'not-called'
  let eof: boolean | null = null
  let error: boolean | null = null
  let reads: number | null = null
  let readFailed: boolean | null = null
  let closeFailed: boolean | null = null
  let printedValues: number[] | null = null
  let exitCode: number | null = null
  let successfulReads = 0
  let closeCalls = 0
  const chunks: string[] = []
  const output: string[] = []
  const add = (phase: FileReadingPhase, activeLine: number, explanation: string,
    condition: FileReadingFrame['condition'] = null, activePart = `line-${activeLine}`) => {
    frames.push({ index: frames.length, phase, activeLine, activePart, explanation, mainInScope, pointer, streamStatus, position,
      buffer: buffer ? [...buffer] : null, bufferState, currentString, readResult, eof, error, reads, readFailed, closeFailed,
      condition: condition ? { ...condition } : null, printedValues: printedValues ? [...printedValues] : null, exitCode, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({
    config: stableConfig, source, frames, status, message, successfulReads, closeCalls, chunks: [...chunks], exitCode,
    streamStatus, output: [...output], stdout: output.join(''), printedValues: printedValues ? [...printedValues] : null,
  })
  add('prepare', 3, '準備使用虛擬 notes.txt 的文字串流，fp 與 buffer 尚未建立。')
  if (issues.length) {
    add('blocked', 3, `設定超出本課範圍，在開啟前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  mainInScope = true
  add('enter-main', 3, '進入 main，準備以唯讀文字模式開啟檔案。')
  const openFailed = stableConfig.outcome === 'open-failure'
  pointer = openFailed ? 'null' : 'stream'
  if (!openFailed) { streamStatus = 'open'; position = 0; eof = false; error = false }
  add('open', 4, openFailed ? 'fopen 回傳 NULL，沒有取得有效串流。' : 'fopen 成功，fp 指向有效串流；EOF 與錯誤指標尚未設定。')
  add('check-open', 5, openFailed ? 'fp == NULL 成立，進入開啟失敗分支。' : 'fp == NULL 不成立，接著建立讀取緩衝區。', { expression: 'fp == NULL', value: openFailed })
  if (openFailed) {
    output.push('open failed\n')
    add('print-open-failure', 6, '輸出開啟失敗訊息。reads 尚未宣告，成功讀取次數為 0。')
    exitCode = 1; printedValues = [0, 1]
    add('return-open-failure', 7, 'main 回傳 1；不呼叫 fgets，也不對 NULL 呼叫 fclose。')
    mainInScope = false
    add('done', 23, '開啟失敗分支已處理，沒有有效串流需要關閉。')
    return result('completed', '開啟失敗已處理，main 回傳 1。')
  }
  buffer = Array.from({ length: stableConfig.bufferSize }, () => null); bufferState = 'uninitialized'
  add('declare-buffer', 9, `建立 ${stableConfig.bufferSize} 格 char 緩衝區，內容尚未初始化；每次 fgets 最多讀 ${stableConfig.bufferSize - 1} 個字元，留一格給空字元。`)
  reads = 0
  add('initialize-reads', 10, 'reads = 0，計算成功取得字串的次數，並非直接計算文字行數。')
  const text = FILE_READING_DATASETS[stableConfig.dataset].text
  let cursor = 0
  while (true) {
    if (stableConfig.outcome === 'read-failure') {
      // This scenario injects an error before any input on the first call.
      error = true; bufferState = 'indeterminate'; buffer.fill(null); currentString = null; readResult = 'null'
    } else {
      let chunk = ''
      while (chunk.length < stableConfig.bufferSize - 1) {
        if (cursor >= text.length) { eof = true; break }
        const character = text[cursor++]
        chunk += character
        if (character === '\n') break
      }
      position = cursor
      if (chunk.length === 0) readResult = 'null'
      else {
        for (let i = 0; i < chunk.length; i++) buffer[i] = chunk[i]
        buffer[chunk.length] = '\0'
        currentString = chunk; bufferState = 'valid'; readResult = 'buffer'
      }
    }
    add('read-attempt', 11, error ? '第一次 fgets 遇到讀取錯誤，回傳 NULL，buffer 內容不確定；不能把它拿去輸出。'
      : readResult === 'buffer' ? `成功讀到 ${currentString!.length} 個字元，保留讀到的換行，並補上空字元。${eof ? '這次也已碰到 EOF，但仍有字元可供處理。' : ''}`
        : '遇到 EOF 且這次沒有讀到任何字元，回傳 NULL；buffer 保持原狀。', null, 'fgets-call')
    const succeeded = readResult === 'buffer'
    add('while-condition', 11, succeeded ? '回傳值不是 NULL，進入迴圈，處理這次取得的字串。' : '回傳 NULL，不進入迴圈；稍後用 ferror 分辨讀取錯誤。',
      { expression: 'fgets(...) != NULL', value: succeeded }, 'fgets-check')
    if (!succeeded) break
    reads++; successfulReads++; chunks.push(currentString!)
    add('count-read', 12, `reads 增加為 ${reads}。緩衝區裝不下一整行時，同一行可能增加多次。`)
    output.push(`[${reads}] ${currentString}`)
    add('print-chunk', 13, 'printf 只輸出 buffer 中空字元之前的字串；不替這次讀取額外補換行。')
  }
  readFailed = error === true
  add('capture-read-error', 15, `串流仍有效時，將 ferror 的布林結果 ${readFailed ? 1 : 0} 保存到 read_failed。`)
  closeFailed = stableConfig.outcome === 'close-failure'; closeCalls++
  streamStatus = closeFailed ? 'disassociated' : 'closed'; pointer = 'invalidated'; eof = null; error = null
  add('close', 16, closeFailed ? 'fclose 回報錯誤；不論成功與否，串流都已解除檔案關聯，不能重用 fp。'
    : 'fclose 成功，關閉檔案並解除串流關聯。後面只使用已保存的狀態，不再查詢 fp。')
  const ioFailed = readFailed || closeFailed
  add('check-errors', 17, ioFailed ? 'read_failed || close_failed 成立，進入 I/O 失敗分支。' : '兩項狀態皆為 0，正常輸出成功讀取次數。',
    { expression: 'read_failed || close_failed', value: ioFailed })
  if (ioFailed) {
    output.push('\nI/O failed\n')
    add('print-io-failure', 18, '輸出 I/O 失敗訊息，不執行後面的正常摘要。')
    exitCode = 2; printedValues = [successfulReads, 2]
    add('return-io-failure', 19, 'main 回傳 2，區分開啟失敗與後續 I/O 錯誤。')
  } else {
    output.push(`\nreads=${reads}\n`)
    add('print-summary', 21, '輸出成功讀取次數；最後那次回傳 NULL 的呼叫沒有被計入。')
    exitCode = 0; printedValues = [successfulReads, 0]
    add('return-success', 22, 'main 正常回傳 0，串流已關閉。')
  }
  mainInScope = false
  add('done', 23, 'main 結束，區域變數離開作用域，主控台保留輸出。')
  return result('completed', `成功讀取 ${successfulReads} 次，main 回傳 ${exitCode}。`)
}
