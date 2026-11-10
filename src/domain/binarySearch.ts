import {
  type BinarySearchConfig,
  DEFAULT_BINARY_SEARCH_CONFIG,
  validateBinarySearchConfig,
} from './binarySearchConfig'

export {
  type BinarySearchConfig,
  DEFAULT_BINARY_SEARCH_CONFIG,
  BINARY_SEARCH_LIMITS,
  validateBinarySearchConfig,
} from './binarySearchConfig'

export const BINARY_VALUES: readonly number[] = [2, 4, 7, 9, 12, 15, 18]
export type BinarySearchPhase = 'enter-main' | 'initialize-values' | 'initialize-target' | 'initialize-count' | 'initialize-left' | 'initialize-right' | 'initialize-found' | 'condition' | 'initialize-mid' | 'compare-equal' | 'record' | 'break' | 'compare-less' | 'move-left' | 'move-right' | 'end-iteration' | 'print' | 'return-main' | 'done' | 'blocked'
export interface BinarySearchFrame {
  index: number
  phase: BinarySearchPhase
  activeLine: number
  activePart: string
  explanation: string
  values: readonly number[] | null
  target: number | null
  count: number | null
  left: number | null
  right: number | null
  mid: number | null
  midInScope: boolean
  mainInScope: boolean
  found: number | null
  activeIndex: number | null
  inspectedIndices: readonly number[]
  output: string | null
}
export function buildBinarySearchSource(config: BinarySearchConfig = DEFAULT_BINARY_SEARCH_CONFIG) {
  const literal = (value: number) => Number.isSafeInteger(value) ? String(value) : '0 /* invalid input */'
  const code = [
    '#include <stdio.h>', '', 'int main(void) {', '  int values[7] = {2, 4, 7, 9, 12, 15, 18};',
    `  int target = ${literal(config.target)};`, `  int n = ${literal(config.count)};`,
    '  int left = 0;', '  int right = n - 1;', '  int found = -1;', '  while (left <= right) {',
    '    int mid = left + (right - left) / 2;', '    if (values[mid] == target) {',
    '      found = mid;', '      break;', '    }', '    if (values[mid] < target) {',
    '      left = mid + 1;', '    } else {', '      right = mid - 1;', '    }', '  }',
    '  printf("index = %d\\n", found);', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateBinarySearchProgram(config: BinarySearchConfig = DEFAULT_BINARY_SEARCH_CONFIG) {
  const stableConfig = { target: config.target, count: config.count }
  const source = buildBinarySearchSource(stableConfig)
  const issues = validateBinarySearchConfig(stableConfig)
  const frames: BinarySearchFrame[] = []
  let values: number[] | null = null
  let target: number | null = null
  let count: number | null = null
  let left: number | null = null
  let right: number | null = null
  let mid: number | null = null
  let midInScope = false
  let mainInScope = true
  let found: number | null = null
  let output: string | null = null
  const inspectedIndices: number[] = []
  const add = (phase: BinarySearchPhase, activeLine: number, explanation: string, activeIndex: number | null = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      values: values ? [...values] : null, target, count, left, right, mid, midInScope, mainInScope, found,
      activeIndex, inspectedIndices: [...inspectedIndices], output })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message, found, output,
    inspectedIndices: [...inspectedIndices], inspections: inspectedIndices.length })
  add('enter-main', 3, '進入 main，準備在已遞增排序的資料中縮小搜尋區間。')
  if (issues.length) {
    const message = `輸入超出本練習範圍，模擬器在初始化前停止：${issues.join(' ')}`
    add('blocked', issues[0].startsWith('target') ? 5 : 6, message)
    return result('blocked', message)
  }
  values = [...BINARY_VALUES]
  add('initialize-values', 4, '建立已遞增排序的 values：2、4、7、9、12、15、18。資料有序才能依大小排除一半區間。')
  target = stableConfig.target
  add('initialize-target', 5, `target 設為 ${target}。`)
  count = stableConfig.count
  add('initialize-count', 6, `只搜尋前 ${count} 格。n = 0 代表沒有待搜尋的元素，不是建立長度為 0 的 C 陣列。`)
  left = 0
  add('initialize-left', 7, 'left 設為 0。使用包含左右端點的閉區間 [left, right]。')
  right = count - 1
  add('initialize-right', 8, `right = n - 1 = ${right}。${count === 0 ? '因此一開始就是空區間。' : '這是最後一個可搜尋索引，不是元素數量。'}`)
  found = -1
  add('initialize-found', 9, 'found 設為 -1，表示尚未找到；-1 不能拿來讀取陣列。')
  while (true) {
    add('condition', 10, `${left} <= ${right} 為 ${left <= right ? 'true，區間非空，才計算 mid。' : 'false，區間已空，不再讀取陣列。'}`)
    if (left > right) break
    mid = left + Math.floor((right - left) / 2)
    midInScope = true
    add('initialize-mid', 11, `mid = ${left} + (${right} - ${left}) / 2 = ${mid}；整數除法捨去非負商的小數部分。`)
    inspectedIndices.push(mid)
    const value = values[mid]
    add('compare-equal', 12, `讀取 values[${mid}] = ${value}，與 ${target} ${value === target ? '相等，準備記錄索引。' : '不相等，再判斷大小。'}`, mid)
    if (value === target) {
      found = mid
      add('record', 13, `found 記錄中點索引 ${mid}，不是元素值 ${value}。`, mid)
      add('break', 14, '找到目標後 break，直接離開 while。', mid)
      break
    }
    add('compare-less', 16, `${value} < ${target} 為 ${value < target ? 'true，排除中點與左半邊。' : 'false，排除中點與右半邊。'}`, mid)
    if (value < target) {
      left = mid + 1
      add('move-left', 17, `left = mid + 1 = ${left}。中點已確認不相等，因此不保留它。`, mid)
    } else {
      right = mid - 1
      add('move-right', 19, `right = mid - 1 = ${right}。中點已確認不相等，因此不保留它。`, mid)
    }
    midInScope = false
    add('end-iteration', 21, '本輪結束，區域變數 mid 離開作用域；回到 while 判斷縮小後的區間。')
  }
  midInScope = false
  output = `index = ${found}`
  add('print', 22, `while 結束，輸出「${output}」。${found === -1 ? '目標不在前 n 格中。' : '這是找到的位置，不是元素值。'}left 與 right 定義在 main，仍在作用域內。`)
  add('return-main', 23, 'return 0 表示 main 正常結束。')
  mainInScope = false
  add('done', 24, 'main 結束，區域變數離開作用域；主控台保留輸出。')
  return result('completed', `檢查 ${inspectedIndices.length} 個中點，${output}。`)
}
