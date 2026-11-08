export const STRING_COMPARISON_SAMPLES = {
  different: { label: 'CAT 與 CAR：後段不同', left: 'CAT', right: 'CAR' },
  prefix: { label: 'CAR 與 CART：前綴', left: 'CAR', right: 'CART' },
  equal: { label: 'CODE 與 CODE：相等', left: 'CODE', right: 'CODE' },
  empty: { label: '空字串與 C', left: '', right: 'C' },
  'embedded-nul': { label: 'CO\\0Z 與 CO\\0A：結尾後的資料', left: 'CO\\0Z', right: 'CO\\0A' },
  'first-character': { label: 'Z 與 AAAA：長度不是依據', left: 'Z', right: 'AAAA' },
  case: { label: 'apple 與 Banana：ASCII 大小寫', left: 'apple', right: 'Banana' },
} as const
export const COMPARISON_SIGNS = ['negative', 'zero', 'positive'] as const
export type ComparisonSign = (typeof COMPARISON_SIGNS)[number]
export interface StringComparisonConfig { sample: keyof typeof STRING_COMPARISON_SAMPLES; reversed: boolean }
export const DEFAULT_STRING_COMPARISON_CONFIG: Readonly<StringComparisonConfig> = { sample: 'different', reversed: false }
export type StringComparisonPhase = 'enter-main' | 'initialize-left' | 'initialize-right' | 'initialize-i' | 'check-terminator' | 'compare-pair' | 'increment-i' | 'end-while' | 'read-a' | 'read-b' | 'calculate-manual' | 'call-strcmp' | 'print-manual' | 'check-negative' | 'check-positive' | 'print-relation' | 'return-main' | 'done' | 'blocked'
export interface StringComparisonFrame {
  index: number
  phase: StringComparisonPhase
  activeLine: number
  activePart: string
  explanation: string
  left: readonly string[] | null
  right: readonly string[] | null
  i: number | null
  a: number | null
  b: number | null
  manual: -1 | 0 | 1 | null
  librarySign: ComparisonSign | null
  mainInScope: boolean
  leftReadIndex: number | null
  rightReadIndex: number | null
  matchedIndices: readonly number[]
  decisiveIndex: number | null
  output: readonly string[]
}
const signOf = (value: number): ComparisonSign => value < 0 ? 'negative' : value > 0 ? 'positive' : 'zero'
function sampleFor(config: StringComparisonConfig) {
  const sample = typeof config.sample === 'string' && Object.hasOwn(STRING_COMPARISON_SAMPLES, config.sample) ? STRING_COMPARISON_SAMPLES[config.sample] : STRING_COMPARISON_SAMPLES.different
  return config.reversed === true ? { left: sample.right, right: sample.left } : { left: sample.left, right: sample.right }
}
function characters(literal: string): string[] { return [...literal.replaceAll('\\0', '\0'), '\0'] }
export function validateStringComparisonConfig(config: StringComparisonConfig = DEFAULT_STRING_COMPARISON_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.sample !== 'string' || !Object.hasOwn(STRING_COMPARISON_SAMPLES, config.sample)) issues.push('請選擇有效的字串比較範例。')
  if (typeof config.reversed !== 'boolean') issues.push('請選擇是否交換左右字串。')
  return issues
}
export function buildStringComparisonSource(config: StringComparisonConfig = DEFAULT_STRING_COMPARISON_CONFIG) {
  const sample = sampleFor(config)
  const code = [
    '#include <stdio.h>', '#include <string.h>', '', 'int main(void) {',
    `  char left[] = "${sample.left}";`, `  char right[] = "${sample.right}";`, '  int i = 0;',
    "  while (left[i] != '\\0' && left[i] == right[i]) {", '    i++;', '  }',
    '  unsigned char a = (unsigned char)left[i];', '  unsigned char b = (unsigned char)right[i];',
    '  int manual = (a > b) - (a < b);', '  int library = strcmp(left, right);',
    '  printf("manual=%d\\n", manual);', '  if (library < 0) printf("strcmp: negative\\n");',
    '  else if (library > 0) printf("strcmp: positive\\n");', '  else printf("strcmp: zero\\n");',
    '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateStringComparisonProgram(config: StringComparisonConfig = DEFAULT_STRING_COMPARISON_CONFIG) {
  const stableConfig = { sample: config.sample, reversed: config.reversed }
  const source = buildStringComparisonSource(stableConfig)
  const issues = validateStringComparisonConfig(stableConfig)
  const frames: StringComparisonFrame[] = []
  let left: string[] | null = null
  let right: string[] | null = null
  let i: number | null = null
  let a: number | null = null
  let b: number | null = null
  let manual: -1 | 0 | 1 | null = null
  let librarySign: ComparisonSign | null = null
  let mainInScope = true
  let decisiveIndex: number | null = null
  const matchedIndices: number[] = []
  const output: string[] = []
  const add = (phase: StringComparisonPhase, activeLine: number, explanation: string, leftReadIndex: number | null = null, rightReadIndex: number | null = null, activePart = `line-${activeLine}`) => {
    frames.push({ index: frames.length, phase, activeLine, activePart, explanation,
      left: left ? [...left] : null, right: right ? [...right] : null, i, a, b, manual, librarySign, mainInScope,
      leftReadIndex, rightReadIndex, matchedIndices: [...matchedIndices], decisiveIndex, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    left: left ? [...left] : null, right: right ? [...right] : null, manual, librarySign, decisiveIndex,
    matchedIndices: [...matchedIndices], output: [...output] })
  add('enter-main', 4, '進入 main，先用手寫程式追蹤逐字比較，再查看 strcmp 回傳值的符號。')
  if (issues.length) {
    add('blocked', 4, `設定不符合本練習範圍，在建立字元陣列前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  const sample = sampleFor(stableConfig)
  left = characters(sample.left)
  add('initialize-left', 5, '建立 left 字元陣列；字串常值會自動附加結尾空字元。')
  right = characters(sample.right)
  add('initialize-right', 6, '建立獨立的 right 陣列，比較的是字元內容，不是兩個陣列的位址。')
  i = 0
  add('initialize-i', 7, 'i 從 0 開始，記錄目前要比對的位置。')
  for (let index = 0; ; index++) {
    const notTerminator = left[index] !== '\0'
    add('check-terminator', 8, `先讀 left[${index}]：${notTerminator ? '不是空字元，繼續判斷右半部。' : "已是 '\\0'；&& 短路，這次條件不讀取 right[i]。"}`, index, null, 'terminator-guard')
    if (!notTerminator) break
    const equal = left[index] === right[index]
    if (equal) matchedIndices.push(index)
    add('compare-pair', 8, `比較索引 ${index} 的字元：${equal ? '兩邊相等，可以前進。' : '兩邊不同，停止；後面的字元不再影響排序。'}`, index, index, 'pair-equality')
    if (!equal) break
    i = index + 1
    add('increment-i', 9, `i 從 ${index} 變成 ${index + 1}。`)
  }
  add('end-while', 10, '離開 while；i 宣告在 main 裡，仍在作用域，保留比較停止的位置。')
  a = left[i].charCodeAt(0)
  add('read-a', 11, `以 unsigned char 讀取 left[${i}] 的位元組值 ${a}；本單元範例採 ASCII。`, i)
  b = right[i].charCodeAt(0)
  decisiveIndex = i
  add('read-b', 12, `讀取 right[${i}] 的位元組值 ${b}。這一對決定結果，包括一方或雙方的空字元。`, null, i)
  manual = a > b ? 1 : a < b ? -1 : 0
  add('calculate-manual', 13, `C 的比較式產生 0 或 1，所以 (a > b) - (a < b) 得到 ${manual}。這是手寫版本固定選用的回傳數值。`)
  librarySign = signOf(manual)
  add('call-strcmp', 14, `strcmp 的結果符號為 ${librarySign}；只記錄負、零或正，不假設非零結果一定是 -1 或 1。`)
  output.push(`manual=${manual}`)
  add('print-manual', 15, `輸出手寫比較的 manual=${manual}。`)
  add('check-negative', 16, `library < 0 為 ${librarySign === 'negative' ? 'true，左字串較小。' : 'false，繼續下一個判斷。'}`)
  if (librarySign !== 'negative') add('check-positive', 17, `library > 0 為 ${librarySign === 'positive' ? 'true，左字串較大。' : 'false，兩個字串相等。'}`)
  output.push(`strcmp: ${librarySign}`)
  add('print-relation', librarySign === 'negative' ? 16 : librarySign === 'positive' ? 17 : 18, `輸出 strcmp: ${librarySign}。比較的是從開頭到第一個空字元的內容。`)
  add('return-main', 19, 'main 回傳 0；這個 0 是程式結束狀態，不是字串比較的結果。')
  mainInScope = false
  add('done', 20, 'main 結束，兩個陣列與區域變數離開作用域，主控台保留輸出。')
  return result('completed', `結果符號為 ${librarySign}；判定位置是索引 ${decisiveIndex}。`)
}
