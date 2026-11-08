export const INTEGER_INPUT_PRESETS = {
  prefix: { label: '有尾端文字：42abc', text: '42abc' },
  valid: { label: '完整數字：42', text: '42' },
  zero: { label: '合法零值：0', text: '0' },
  spaces: { label: '空白、負號與尾端空白', text: ' \t-17 \n' },
  noDigits: { label: '只有空白與正號', text: ' +' },
  empty: { label: '空字串', text: '' },
  decimal: { label: '指定十進位：010', text: '010' },
  max32: { label: '32 位元上界', text: '2147483647' },
  over32: { label: '超過 32 位元上界', text: '2147483648' },
  min64: { label: '64 位元下界', text: '-9223372036854775808' },
  over64: { label: '超過 64 位元上界', text: '9223372036854775808' },
} as const
export interface IntegerParsingConfig { text: string; longBits: 32 | 64; allowTrailingSpace: boolean }
export const DEFAULT_INTEGER_PARSING_CONFIG: Readonly<IntegerParsingConfig> = { text: '42abc', longBits: 32, allowTrailingSpace: false }
export type IntegerParsingPhase = 'prepare' | 'enter-main' | 'declare-input' | 'declare-end' | 'clear-errno'
  | 'begin-conversion' | 'skip-leading-space' | 'read-sign' | 'read-digit' | 'finish-conversion'
  | 'check-conversion' | 'print-no-digits' | 'return-no-digits' | 'check-range' | 'print-range' | 'return-range'
  | 'set-policy' | 'check-policy' | 'tail-condition' | 'advance-end' | 'check-tail' | 'print-tail' | 'return-tail'
  | 'print-value' | 'return-success' | 'done' | 'blocked'
export interface IntegerParsingFrame {
  index: number
  phase: IntegerParsingPhase
  activeLine: number
  activePart: string
  explanation: string
  mainInScope: boolean
  textDeclared: boolean
  endDeclared: boolean
  endIndex: number | null
  conversionEnd: number | null
  value: string | null
  errno: 'unknown' | '0' | 'ERANGE'
  allowTrailingSpace: boolean | null
  scanIndex: number | null
  magnitude: string | null
  sign: 1 | -1 | null
  digitCount: number
  condition: { expression: string; value: boolean } | null
  predictionValue: number | null
  exitCode: number | null
  output: readonly string[]
}
export const isAsciiSpace = (value: string | undefined) => value !== undefined && /^[ \t\n\r\v\f]$/.test(value)
export function longModelLimits(bits: 32 | 64) {
  const edge = 1n << BigInt(bits - 1)
  return { min: (-edge).toString(), max: (edge - 1n).toString() }
}
export function validateIntegerParsingConfig(config: IntegerParsingConfig = DEFAULT_INTEGER_PARSING_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.text !== 'string' || config.text.length > 40 || !Array.from(config.text).every(character => {
    const code = character.charCodeAt(0)
    return (code >= 9 && code <= 13) || (code >= 32 && code <= 126)
  })) issues.push('輸入限 40 個 ASCII 字元，可包含空白、Tab 與換行，不包含內嵌空字元。')
  if (config.longBits !== 32 && config.longBits !== 64) issues.push('請選擇 32 或 64 位元 long 模型。')
  if (typeof config.allowTrailingSpace !== 'boolean') issues.push('請選擇是否接受尾端空白。')
  return issues
}
export function escapeIntegerInput(text: string) {
  const escapes: Record<string, string> = { '\\': '\\\\', '"': '\\"', '?': '\\?', '\t': '\\t', '\n': '\\n', '\r': '\\r', '\v': '\\v', '\f': '\\f' }
  return Array.from(text, character => escapes[character] ?? character).join('')
}
export function buildIntegerParsingSource(config: IntegerParsingConfig = DEFAULT_INTEGER_PARSING_CONFIG) {
  const safe = validateIntegerParsingConfig(config).length ? DEFAULT_INTEGER_PARSING_CONFIG : config
  const code = ['#include <stdio.h>', '#include <stdlib.h>', '#include <errno.h>', '#include <ctype.h>', '', 'int main(void) {',
    `  const char text[] = "${escapeIntegerInput(safe.text)}";`, '  char *end;', '  errno = 0;', '  long value = strtol(text, &end, 10);',
    '  if (end == text) {', '    puts("no digits");', '    return 1;', '  }', '  if (errno == ERANGE) {',
    '    puts("out of range");', '    return 2;', '  }', `  int allow_trailing_space = ${Number(safe.allowTrailingSpace)};`,
    '  if (allow_trailing_space) {', '    while (isspace((unsigned char)*end)) {', '      end++;', '    }', '  }',
    "  if (*end != '\\0') {", '    puts("trailing data");', '    return 3;', '  }', '  printf("value=%ld\\n", value);', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateIntegerParsingProgram(config: IntegerParsingConfig = DEFAULT_INTEGER_PARSING_CONFIG) {
  const stableConfig = { text: config.text, longBits: config.longBits, allowTrailingSpace: config.allowTrailingSpace }
  const source = buildIntegerParsingSource(stableConfig)
  const issues = validateIntegerParsingConfig(stableConfig)
  const frames: IntegerParsingFrame[] = []
  let mainInScope = false, textDeclared = false, endDeclared = false
  let endIndex: number | null = null, conversionEnd: number | null = null
  let value: string | null = null
  let errno: IntegerParsingFrame['errno'] = 'unknown'
  let allowTrailingSpace: boolean | null = null
  let scanIndex: number | null = null, magnitude: string | null = null
  let sign: 1 | -1 | null = null
  let digitCount = 0
  let predictionValue: number | null = null, exitCode: number | null = null
  const output: string[] = []
  const add = (phase: IntegerParsingPhase, activeLine: number, explanation: string, condition: IntegerParsingFrame['condition'] = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      mainInScope, textDeclared, endDeclared, endIndex, conversionEnd, value, errno, allowTrailingSpace,
      scanIndex, magnitude, sign, digitCount, condition: condition ? { ...condition } : null, predictionValue, exitCode, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    value, conversionEnd, endIndex, errno, exitCode, output: [...output], stdout: output.join('') })
  const finish = (code: number, phase: IntegerParsingPhase, line: number) => {
    exitCode = code; predictionValue = code
    add(phase, line, `main 回傳 ${code}，這個分支已完成檢查。`)
    mainInScope = false
    add('done', 31, 'main 結束，區域變數離開作用域，主控台保留輸出。')
    return result('completed', `main 回傳 ${code}。`)
  }
  add('prepare', 6, '準備解析十進位 long；尚未建立輸入物件或 end 指標。')
  if (issues.length) { add('blocked', 6, issues.join(' ')); return result('blocked', issues.join(' ')) }
  const text = stableConfig.text
  mainInScope = true; add('enter-main', 6, '進入 main，本課以 C locale 與 ASCII 字元說明解析。')
  textDeclared = true; add('declare-input', 7, '建立以空字元結尾的 text 陣列；字串長度不含最後的空字元。')
  endDeclared = true; add('declare-end', 8, '宣告 end，尚未取得停止位址；&end 讓 strtol 可以改寫這個指標變數。')
  errno = '0'; add('clear-errno', 9, '在呼叫前將 errno 設為 0，避免把先前的錯誤當成這次結果。')
  scanIndex = 0; magnitude = '0'; sign = 1
  add('begin-conversion', 10, '展開 strtol 的概念追蹤：先略過前導空白，再讀可選符號與十進位數字。')
  let cursor = 0
  while (isAsciiSpace(text[cursor])) { cursor++; scanIndex = cursor; add('skip-leading-space', 10, `略過前導空白，概念掃描位置移到 ${cursor}。`) }
  if (text[cursor] === '+' || text[cursor] === '-') {
    sign = text[cursor] === '-' ? -1 : 1; cursor++; scanIndex = cursor
    add('read-sign', 10, `讀取${sign === -1 ? '負' : '正'}號；還需要至少一個數字才算有轉換。`)
  }
  let accumulator = 0n
  while (cursor < text.length && text[cursor] >= '0' && text[cursor] <= '9') {
    accumulator = accumulator * 10n + BigInt(text[cursor]); cursor++; digitCount++; scanIndex = cursor; magnitude = accumulator.toString()
    add('read-digit', 10, `讀到第 ${digitCount} 個十進位數字；概念量值為 ${magnitude}。main 的 value 與 end 尚未收到回傳結果。`)
  }
  const limits = longModelLimits(stableConfig.longBits)
  const mathematical = sign === -1 ? -accumulator : accumulator
  const low = BigInt(limits.min), high = BigInt(limits.max)
  const ranged = digitCount > 0 && (mathematical < low || mathematical > high)
  value = (digitCount === 0 ? 0n : mathematical < low ? low : mathematical > high ? high : mathematical).toString()
  endIndex = digitCount === 0 ? 0 : cursor; conversionEnd = endIndex; errno = ranged ? 'ERANGE' : '0'
  add('finish-conversion', 10, digitCount === 0 ? '沒有可轉換的數字：回傳 0，end 指回輸入起點，即使曾略過空白或讀到符號。'
    : ranged ? `超出所選 long 模型，回傳對應邊界 ${value} 並設定 ERANGE；end 仍記錄數字序列的停止位置。`
      : `回傳 long 值 ${value}，end 指向索引 ${endIndex}。這還不表示整份輸入都合格。`)
  const noDigits = endIndex === 0
  add('check-conversion', 11, noDigits ? 'end == text 成立，沒有數字可轉換。' : 'end 已離開起點，至少有一個數字被轉換。', { expression: 'end == text', value: noDigits })
  if (noDigits) { output.push('no digits\n'); add('print-no-digits', 12, '輸出無數字訊息；不能只靠回傳值 0 判斷這種情況。'); return finish(1, 'return-no-digits', 13) }
  add('check-range', 15, ranged ? 'errno == ERANGE 成立，這次轉換超出 long 範圍。' : '沒有 ERANGE，繼續檢查尾端內容。', { expression: 'errno == ERANGE', value: ranged })
  if (ranged) { output.push('out of range\n'); add('print-range', 16, '邊界回傳值不代表輸入合法；依 ERANGE 回報範圍錯誤。'); return finish(2, 'return-range', 17) }
  allowTrailingSpace = stableConfig.allowTrailingSpace
  add('set-policy', 19, `設定本程式的尾端空白規則為 ${Number(allowTrailingSpace)}；這不是 strtol 自動驗證整串的規則。`)
  add('check-policy', 20, allowTrailingSpace ? '允許尾端空白，逐字略過。' : '要求數字後立刻是空字元，不略過尾端空白。', { expression: 'allow_trailing_space', value: allowTrailingSpace })
  if (allowTrailingSpace) while (true) {
    const space = isAsciiSpace(text[endIndex])
    add('tail-condition', 21, space ? '目前尾端字元是空白，準備移動 end。' : '目前字元不是空白，停止移動；空字元也不是空白。', { expression: 'isspace((unsigned char)*end)', value: space })
    if (!space) break
    endIndex++; add('advance-end', 22, `end 移到索引 ${endIndex}。原本的 strtol 停止位置仍保留在追蹤紀錄中。`)
  }
  const trailing = endIndex < text.length
  add('check-tail', 25, trailing ? 'end 尚未指到空字元，有剩餘資料，拒絕這份輸入。' : 'end 指向空字元，整份輸入符合本程式的規則。', { expression: "*end != '\\0'", value: trailing })
  if (trailing) { output.push('trailing data\n'); add('print-tail', 26, '轉換出前綴數字不等於完整輸入合格。'); return finish(3, 'return-tail', 27) }
  output.push(`value=${value}\n`); add('print-value', 29, '所有檢查都通過，用 %ld 輸出 long 值。')
  return finish(0, 'return-success', 30)
}
