import { FILE_READING_OUTCOMES, type FileStreamStatus } from './fileReading'

export const FILE_CHARACTER_DATASETS = {
  text: { label: 'A、0、換行、B、9', bytes: [65, 48, 10, 66, 57] },
  nul: { label: 'A、0x00、B、9', bytes: [65, 0, 66, 57] },
  high: { label: '0xFF、0、換行、9', bytes: [255, 48, 10, 57] },
  digits: { label: '0、1、9', bytes: [48, 49, 57] },
  empty: { label: '空檔案', bytes: [] },
} as const
export interface FileCharacterConfig {
  dataset: keyof typeof FILE_CHARACTER_DATASETS
  outcome: keyof typeof FILE_READING_OUTCOMES
  stopAtNewline: boolean
}
export const DEFAULT_FILE_CHARACTER_CONFIG: Readonly<FileCharacterConfig> = { dataset: 'text', outcome: 'success', stopAtNewline: false }
export type FileCharacterPhase = 'prepare' | 'enter-main' | 'open' | 'check-open' | 'print-open-failure' | 'return-open-failure'
  | 'declare-ch' | 'initialize-counters' | 'set-stop' | 'read-attempt' | 'while-condition' | 'check-stop' | 'break'
  | 'count-byte' | 'check-digit' | 'count-digit' | 'print-code' | 'capture-read-error' | 'close' | 'check-errors'
  | 'print-io-failure' | 'return-io-failure' | 'print-summary' | 'return-success' | 'done' | 'blocked'
export interface FileCharacterFrame {
  index: number
  phase: FileCharacterPhase
  activeLine: number
  activePart: string
  explanation: string
  mainInScope: boolean
  pointer: 'undeclared' | 'stream' | 'null' | 'invalidated'
  streamStatus: FileStreamStatus
  position: number | null
  chDeclared: boolean
  /** EOF remains a tag: its negative int value is not assumed to be -1. */
  ch: number | 'EOF' | null
  count: number | null
  digits: number | null
  stopAtNewline: boolean | null
  retrieved: readonly number[]
  processed: readonly number[]
  activeByte: number | null
  eof: boolean | null
  error: boolean | null
  readFailed: boolean | null
  closeFailed: boolean | null
  condition: { expression: string; value: boolean } | null
  printedValues: readonly number[] | null
  exitCode: number | null
  output: readonly string[]
}
export function validateFileCharacterConfig(config: FileCharacterConfig = DEFAULT_FILE_CHARACTER_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(FILE_CHARACTER_DATASETS, config.dataset)) issues.push('請選擇有效的位元組資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(FILE_READING_OUTCOMES, config.outcome)) issues.push('請選擇有效的 I/O 情境。')
  if (typeof config.stopAtNewline !== 'boolean') issues.push('請選擇是否在換行時提早停止。')
  return issues
}
export function buildFileCharacterSource(config: FileCharacterConfig = DEFAULT_FILE_CHARACTER_CONFIG) {
  const safe = validateFileCharacterConfig(config).length ? DEFAULT_FILE_CHARACTER_CONFIG : config
  const code = ['#include <stdio.h>', '', 'int main(void) {', '  FILE *fp = fopen("bytes.bin", "rb");',
    '  if (fp == NULL) {', '    puts("open failed");', '    return 1;', '  }', '  int ch;', '  int count = 0, digits = 0;',
    `  int stop_at_newline = ${Number(safe.stopAtNewline)};`, '  while ((ch = fgetc(fp)) != EOF) {',
    "    if (stop_at_newline && ch == '\\n') {", '      break;', '    }', '    count++;',
    "    if (ch >= '0' && ch <= '9') {", '      digits++;', '    }', '    printf("code=%d\\n", ch);', '  }',
    '  int read_failed = ferror(fp) != 0;', '  int close_failed = fclose(fp) != 0;', '  if (read_failed || close_failed) {',
    '    puts("I/O failed");', '    return 2;', '  }', '  printf("count=%d, digits=%d\\n", count, digits);', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateFileCharacterProgram(config: FileCharacterConfig = DEFAULT_FILE_CHARACTER_CONFIG) {
  const stableConfig = { dataset: config.dataset, outcome: config.outcome, stopAtNewline: config.stopAtNewline }
  const source = buildFileCharacterSource(stableConfig)
  const issues = validateFileCharacterConfig(stableConfig)
  const frames: FileCharacterFrame[] = []
  let mainInScope = false
  let pointer: FileCharacterFrame['pointer'] = 'undeclared'
  let streamStatus: FileStreamStatus = 'not-opened'
  let position: number | null = null
  let chDeclared = false
  let ch: FileCharacterFrame['ch'] = null
  let count: number | null = null
  let digits: number | null = null
  let stopAtNewline: boolean | null = null
  let eof: boolean | null = null
  let error: boolean | null = null
  let readFailed: boolean | null = null
  let closeFailed: boolean | null = null
  let printedValues: number[] | null = null
  let exitCode: number | null = null
  let readCalls = 0
  let closeCalls = 0
  const retrieved: number[] = []
  const processed: number[] = []
  const output: string[] = []
  const add = (phase: FileCharacterPhase, activeLine: number, explanation: string, activeByte: number | null = null,
    condition: FileCharacterFrame['condition'] = null, activePart = `line-${activeLine}`) => {
    frames.push({ index: frames.length, phase, activeLine, activePart, explanation, mainInScope, pointer, streamStatus, position,
      chDeclared, ch, count, digits, stopAtNewline, retrieved: [...retrieved], processed: [...processed], activeByte,
      eof, error, readFailed, closeFailed, condition: condition ? { ...condition } : null,
      printedValues: printedValues ? [...printedValues] : null, exitCode, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({
    config: stableConfig, source, frames, status, message, retrieved: [...retrieved], processed: [...processed], readCalls, closeCalls,
    printedValues: printedValues ? [...printedValues] : null, exitCode, streamStatus, output: [...output], stdout: output.join(''),
  })
  add('prepare', 3, '準備使用虛擬 bytes.bin，尚未開啟串流或宣告 ch。')
  if (issues.length) {
    add('blocked', 3, `設定超出本課範圍，在開啟前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  mainInScope = true
  add('enter-main', 3, '進入 main，以二進位模式逐位元組讀取。')
  const openFailed = stableConfig.outcome === 'open-failure'
  pointer = openFailed ? 'null' : 'stream'
  if (!openFailed) { streamStatus = 'open'; position = 0; eof = false; error = false }
  add('open', 4, openFailed ? 'fopen 回傳 NULL，沒有有效串流。' : 'fopen 成功；本課採每位元組 8 位元與 ASCII 示意，int 能保存 0 到 255 的資料值。')
  add('check-open', 5, openFailed ? '開啟失敗，提早回傳。' : 'fp 不是 NULL，繼續建立變數。', null, { expression: 'fp == NULL', value: openFailed })
  if (openFailed) {
    output.push('open failed\n')
    add('print-open-failure', 6, '輸出失敗訊息，還沒有 count 與 digits 變數，成功處理事件皆為 0。')
    exitCode = 1; printedValues = [0, 0]
    add('return-open-failure', 7, 'main 回傳 1，不讀取也不對 NULL 呼叫 fclose。')
    mainInScope = false
    add('done', 30, '開啟失敗已處理，沒有有效串流需要關閉。')
    return result('completed', '開啟失敗，沒有處理資料，main 回傳 1。')
  }
  chDeclared = true
  add('declare-ch', 9, 'ch 宣告為 int，尚未初始化；第一次 fgetc 賦值後才檢查它。')
  count = 0; digits = 0
  add('initialize-counters', 10, 'count 計算通過提早停止檢查的資料量，digits 計算其中的數字字元。')
  stopAtNewline = stableConfig.stopAtNewline
  add('set-stop', 11, stopAtNewline ? '啟用換行提早停止，在 count++ 之前 break。' : '不因換行停止，持續讀到 EOF 或讀取錯誤。')
  const bytes = FILE_CHARACTER_DATASETS[stableConfig.dataset].bytes
  let cursor = 0
  while (true) {
    readCalls++
    let activeByte: number | null = null
    if (stableConfig.outcome === 'read-failure') { ch = 'EOF'; error = true }
    else if (cursor >= bytes.length) { ch = 'EOF'; eof = true }
    else { ch = bytes[cursor]; activeByte = cursor++; position = cursor; retrieved.push(ch) }
    add('read-attempt', 12, ch === 'EOF' ? error ? '第一次讀取遇到錯誤，ch 得到 EOF，設定錯誤指標。' : '沒有下一個位元組，ch 得到 EOF，設定 EOF 指標；EOF 不佔檔案中的一格。'
      : `fgetc 取得資料值 ${ch}，以 unsigned char 的值轉成 int 保存；尚未計入 count。`, activeByte, null, 'fgetc-call')
    const available = ch !== 'EOF'
    add('while-condition', 12, available ? `${ch} 是資料，不是 EOF，進入迴圈。` : 'ch 等於 EOF，不進入處理資料的迴圈。', activeByte,
      { expression: 'ch != EOF', value: available }, 'eof-check')
    if (ch === 'EOF') break
    const stop = stopAtNewline && ch === 10
    add('check-stop', 13, !stopAtNewline ? '開關為 0，&& 短路，繼續處理這個資料位元組。'
      : stop ? '已讀到換行，在 count++ 之前提早停止。' : '這個位元組不是換行，繼續處理。', activeByte,
      { expression: 'stop_at_newline && ch == \'\\n\'', value: stop })
    if (stop) { add('break', 14, 'break 直接離開迴圈。換行已被讀取，但沒有計入 count；也不再讀到 EOF。', activeByte); break }
    count++; processed.push(ch)
    add('count-byte', 16, `count 增加為 ${count}。資料 0 與 255 也都是有效位元組。`, activeByte)
    const digit = ch >= 48 && ch <= 57
    add('check-digit', 17, digit ? '這個資料值是 ASCII 數字字元，準備增加 digits。' : '不是數字字元，略過 digits++。', activeByte,
      { expression: "ch >= '0' && ch <= '9'", value: digit })
    if (digit) { digits++; add('count-digit', 18, `digits 增加為 ${digits}。字元 '0' 的資料值是 48，不是位元組 0。`, activeByte) }
    output.push(`code=${ch}\n`)
    add('print-code', 20, '輸出這次處理的 int 資料值；EOF 不會經過這個敘述。', activeByte)
  }
  readFailed = error === true
  add('capture-read-error', 22, `串流仍有效時，將 ferror 的布林結果 ${Number(readFailed)} 保存到區域變數。`)
  closeFailed = stableConfig.outcome === 'close-failure'; closeCalls++
  streamStatus = closeFailed ? 'disassociated' : 'closed'; pointer = 'invalidated'; eof = null; error = null
  add('close', 23, closeFailed ? 'fclose 回報錯誤，串流仍已解除檔案關聯，不能再使用 fp。' : 'fclose 成功並解除串流關聯，後面只查看保存的狀態。')
  const failed = readFailed || closeFailed
  add('check-errors', 24, failed ? '有 I/O 錯誤，回報失敗。' : '沒有 I/O 錯誤，輸出統計。', null, { expression: 'read_failed || close_failed', value: failed })
  if (failed) {
    output.push('I/O failed\n'); add('print-io-failure', 25, '輸出 I/O 失敗訊息，略過正常統計輸出。')
    exitCode = 2; printedValues = [processed.length, digits]
    add('return-io-failure', 26, 'main 回傳 2，已處理的資料統計保留在本次追蹤中。')
  } else {
    output.push(`count=${count}, digits=${digits}\n`); add('print-summary', 28, '輸出已處理資料與數字字元的數量。')
    exitCode = 0; printedValues = [count, digits]
    add('return-success', 29, 'main 正常回傳 0，串流已清理。')
  }
  mainInScope = false
  add('done', 30, 'main 結束，變數離開作用域，主控台保留輸出。')
  return result('completed', `處理 ${count} 個位元組，其中 ${digits} 個數字字元；main 回傳 ${exitCode}。`)
}
