export const SEARCH_VALUES: readonly number[] = [4, 7, 2, 7, 5]
export interface SearchConfig { target: number; mode: 'first' | 'last' }
export const DEFAULT_SEARCH_CONFIG: Readonly<SearchConfig> = { target: 7, mode: 'first' }
export const SEARCH_LIMITS = { target: { min: -5, max: 15 } } as const
export type SearchPhase = 'enter-main' | 'initialize-values' | 'initialize-target' | 'initialize-found' | 'initialize-index' | 'condition' | 'compare' | 'record' | 'break' | 'increment' | 'print' | 'return-main' | 'done' | 'blocked'
export interface SearchFrame {
  index: number
  phase: SearchPhase
  activeLine: number
  activePart: string
  explanation: string
  values: readonly number[] | null
  target: number | null
  found: number | null
  i: number | null
  iInScope: boolean
  mainInScope: boolean
  activeIndex: number | null
  matched: boolean | null
  comparedIndices: readonly number[]
  output: string | null
}
export function validateSearchConfig(config: SearchConfig = DEFAULT_SEARCH_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Number.isInteger(config.target) || config.target < -5 || config.target > 15) issues.push('target 必須是 -5 到 15 的整數。')
  if (config.mode !== 'first' && config.mode !== 'last') issues.push('請選擇第一筆或最後一筆。')
  return issues
}
export function buildSearchSource(config: SearchConfig = DEFAULT_SEARCH_CONFIG) {
  const literal = Number.isSafeInteger(config.target) ? String(config.target) : '0 /* invalid target */'
  const code = [
    '#include <stdio.h>', '', 'int main(void) {', '  int values[5] = {4, 7, 2, 7, 5};',
    `  int target = ${literal};`, '  int found = -1;', '  for (int i = 0; i < 5; i++) {',
    '    if (values[i] == target) {', '      found = i;',
    config.mode === 'first' ? '      break;' : '      /* keep searching */',
    '    }', '  }', '  printf("index = %d\\n", found);', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateSearchProgram(config: SearchConfig = DEFAULT_SEARCH_CONFIG) {
  const stableConfig = { target: config.target, mode: config.mode }
  const source = buildSearchSource(stableConfig)
  const issues = validateSearchConfig(stableConfig)
  const frames: SearchFrame[] = []
  let values: number[] | null = null
  let target: number | null = null
  let found: number | null = null
  let i: number | null = null
  let iInScope = false
  let mainInScope = true
  let output: string | null = null
  const comparedIndices: number[] = []
  const add = (phase: SearchPhase, activeLine: number, explanation: string, activeIndex: number | null = null, matched: boolean | null = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      values: values ? [...values] : null, target, found, i, iInScope, mainInScope, activeIndex, matched,
      comparedIndices: [...comparedIndices], output })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message, found,
    comparedIndices: [...comparedIndices], comparisons: comparedIndices.length, output })
  add('enter-main', 3, '進入 main，準備逐格比較陣列元素。')
  if (issues.length) {
    const message = `設定不符合本練習範圍，模擬器在初始化前停止：${issues.join(' ')}`
    add('blocked', stableConfig.mode === 'first' || stableConfig.mode === 'last' ? 5 : 3, message)
    return result('blocked', message)
  }
  values = [...SEARCH_VALUES]
  add('initialize-values', 4, '建立 values：4、7、2、7、5。索引從 0 開始，7 分別出現在索引 1 與 3。')
  target = stableConfig.target
  add('initialize-target', 5, `target 初始化為 ${target}；搜尋時比較的是元素值，不是索引。`)
  found = -1
  add('initialize-found', 6, 'found 先設為 -1，代表尚未找到。合法索引是 0 到 4，所以 -1 不會與它們混淆。')
  i = 0; iInScope = true
  add('initialize-index', 7, 'for 建立 i = 0，從第一格開始搜尋。')
  for (;;) {
    add('condition', 7, `判斷 ${i} < 5 為 ${i < 5 ? 'true，才可讀取 values[i]。' : 'false，結束搜尋；不讀取 values[5]。'}`)
    if (i >= values.length) break
    const matched = values[i] === target
    comparedIndices.push(i)
    add('compare', 8, `比較 values[${i}] = ${values[i]} 與 target = ${target}：${matched ? '相等，準備記錄索引。' : '不相等，保留 found。'}`, i, matched)
    if (matched) {
      found = i
      add('record', 9, `找到相符元素，把索引 ${i} 記到 found；元素值仍是 ${values[i]}。`, i)
      if (stableConfig.mode === 'first') {
        add('break', 10, '找到第一筆就 break；不再比較後面的格子，也不再執行 i++。', i)
        break
      }
    }
    const before: number = i
    i += 1
    add('increment', 7, `i 從 ${before} 更新為 ${i}，再判斷下一次條件。${matched ? '保留目前找到的位置，後面若再次相符才覆寫。' : ''}`)
  }
  iInScope = false
  output = `index = ${found}`
  add('print', 13, `for 已結束，i 離開作用域。輸出「${output}」；${found === -1 ? '找不到時不得以 -1 讀取陣列。' : `這是索引，不是元素值 ${values[found!]}。`}`)
  add('return-main', 14, 'return 0 表示 main 正常結束。')
  mainInScope = false
  add('done', 15, 'main 結束，區域變數離開作用域；主控台保留搜尋結果。')
  return result('completed', `共比較 ${comparedIndices.length} 格，${output}。`)
}
