export const INSERTION_SAMPLES = {
  mixed: [4, 3, 1, 5, 2], sorted: [1, 2, 3, 4, 5], reverse: [5, 4, 3, 2, 1], duplicates: [3, 1, 3, 2, 1],
} as const
export interface InsertionSortConfig { sample: keyof typeof INSERTION_SAMPLES; order: 'ascending' | 'descending' }
export const DEFAULT_INSERTION_SORT_CONFIG: Readonly<InsertionSortConfig> = { sample: 'mixed', order: 'ascending' }
export type InsertionVariable = 'i' | 'key' | 'j' | 'k'
export type InsertionSortPhase = 'enter-main' | 'initialize-values' | 'initialize-i' | 'outer-condition' | 'save-key' | 'initialize-j' | 'check-index' | 'compare-value' | 'shift' | 'decrement-j' | 'write-key' | 'end-pass' | 'increment-i' | 'initialize-k' | 'print-condition' | 'print' | 'increment-k' | 'return-main' | 'done' | 'blocked'
export interface InsertionSortFrame {
  index: number
  phase: InsertionSortPhase
  activeLine: number
  activePart: string
  explanation: string
  values: readonly number[] | null
  variables: Readonly<Record<InsertionVariable, Readonly<{ value: number | null; inScope: boolean }>>>
  mainInScope: boolean
  activeIndices: readonly number[]
  holeIndex: number | null
  sortedCount: number
  comparisons: number
  shifts: number
  firstPassValues: readonly number[] | null
  output: readonly number[]
}
export function validateInsertionSortConfig(config: InsertionSortConfig = DEFAULT_INSERTION_SORT_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Object.hasOwn(INSERTION_SAMPLES, config.sample)) issues.push('請選擇有效的陣列範例。')
  if (config.order !== 'ascending' && config.order !== 'descending') issues.push('請選擇升冪或降冪。')
  return issues
}
export function buildInsertionSortSource(config: InsertionSortConfig = DEFAULT_INSERTION_SORT_CONFIG) {
  const sample = Object.hasOwn(INSERTION_SAMPLES, config.sample) ? INSERTION_SAMPLES[config.sample] : INSERTION_SAMPLES.mixed
  const code = [
    '#include <stdio.h>', '', 'int main(void) {', `  int values[5] = {${sample.join(', ')}};`,
    '  for (int i = 1; i < 5; i++) {', '    int key = values[i];', '    int j = i - 1;',
    `    while (j >= 0 && values[j] ${config.order === 'descending' ? '<' : '>'} key) {`,
    '      values[j + 1] = values[j];', '      j--;', '    }', '    values[j + 1] = key;', '  }',
    '  for (int k = 0; k < 5; k++) {', '    printf("%d ", values[k]);', '  }', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateInsertionSortProgram(config: InsertionSortConfig = DEFAULT_INSERTION_SORT_CONFIG) {
  const stableConfig = { sample: config.sample, order: config.order }
  const source = buildInsertionSortSource(stableConfig)
  const issues = validateInsertionSortConfig(stableConfig)
  const frames: InsertionSortFrame[] = []
  const variables: Record<InsertionVariable, { value: number | null; inScope: boolean }> = {
    i: { value: null, inScope: false }, key: { value: null, inScope: false }, j: { value: null, inScope: false }, k: { value: null, inScope: false },
  }
  let values: number[] | null = null
  let mainInScope = true
  let holeIndex: number | null = null
  let sortedCount = 0
  let comparisons = 0
  let shifts = 0
  let firstPassValues: number[] | null = null
  const output: number[] = []
  const add = (phase: InsertionSortPhase, activeLine: number, explanation: string, activeIndices: number[] = [], activePart = `line-${activeLine}`) => {
    frames.push({ index: frames.length, phase, activeLine, activePart, explanation,
      values: values ? [...values] : null, variables: { i: { ...variables.i }, key: { ...variables.key }, j: { ...variables.j }, k: { ...variables.k } },
      mainInScope, holeIndex, activeIndices: [...activeIndices], sortedCount, comparisons, shifts,
      firstPassValues: firstPassValues ? [...firstPassValues] : null, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    values: values ? [...values] : null, comparisons, shifts, firstPassValues: firstPassValues ? [...firstPassValues] : null, output: [...output] })
  add('enter-main', 3, '進入 main，準備把每個 key 插入左側有序區段。')
  if (issues.length) {
    add('blocked', 3, `輸入不符合本練習範圍，模擬器在初始化前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  values = [...INSERTION_SAMPLES[stableConfig.sample]]
  sortedCount = 1
  add('initialize-values', 4, '第一格本身就是長度為 1 的有序前綴；後面的 key 仍可能插到它前面，並非已在最終位置。')
  variables.i = { value: 1, inScope: true }
  add('initialize-i', 5, 'i 從 1 開始，每輪把 values[i] 插入左側有序前綴。')
  for (let i = 1; ; i++) {
    add('outer-condition', 5, `${i} < 5 為 ${i < 5 ? 'true，取出下一個 key。' : 'false，全部排序完成。'}`)
    if (i >= 5) break
    const key = values[i]
    variables.key = { value: key, inScope: true }
    holeIndex = i
    add('save-key', 6, `把 values[${i}] = ${key} 複製到 key。待填位置只是演算法示意，陣列格子並未變成未初始化。`, [i])
    let j: number = i - 1
    variables.j = { value: j, inScope: true }
    add('initialize-j', 7, `j = i - 1 = ${j}，先檢查 key 左邊的一格。`)
    for (;;) {
      add('check-index', 8, `先判斷 ${j} >= 0：${j >= 0 ? 'true，才可讀取 values[j]。' : 'false，&& 短路；不計算右側，也不讀取 values[-1]。'}`, [], 'index-guard')
      if (j < 0) break
      const move = stableConfig.order === 'ascending' ? values[j] > key : values[j] < key
      comparisons++
      add('compare-value', 8, `比較 values[${j}] = ${values[j]} 與 key = ${key}：${move ? '需要右移，替 key 留位置。' : '不需右移，停止 while；相等時也停止。'}`, [j], 'value-compare')
      if (!move) break
      values[j + 1] = values[j]
      shifts++
      holeIndex = j
      add('shift', 9, `將 values[${j}] 複製到 values[${j + 1}]。key = ${key} 仍被保留，待填位置移到 ${j}。`, [j, j + 1])
      j--; variables.j.value = j
      add('decrement-j', 10, `j 減為 ${j}；下一步先檢查邊界，不直接讀取陣列。`)
    }
    values[j + 1] = key
    holeIndex = null
    add('write-key', 12, `把 key = ${key} 寫到 j + 1 = ${j + 1}；即使 j = -1，寫入位置也會是合法的 0。`, [j + 1])
    sortedCount = i + 1
    if (i === 1) firstPassValues = [...values]
    variables.key.inScope = false; variables.j.inScope = false
    add('end-pass', 13, `本輪完成，前 ${sortedCount} 格有序。key、j 離開本輪作用域；後續插入仍可能改動這些元素的位置。`)
    variables.i.value = i + 1
    add('increment-i', 5, `i 從 ${i} 變為 ${i + 1}。`)
  }
  variables.i.inScope = false
  variables.k = { value: 0, inScope: true }
  add('initialize-k', 14, '排序完成，i 離開作用域；建立輸出索引 k = 0。')
  for (let k = 0; ; k++) {
    add('print-condition', 14, `${k} < 5 為 ${k < 5 ? 'true，輸出這一格。' : 'false，輸出結束。'}`)
    if (k >= 5) break
    output.push(values[k])
    add('print', 15, `printf 輸出 values[${k}] = ${values[k]}。`, [k])
    variables.k.value = k + 1
    add('increment-k', 14, `k 從 ${k} 變為 ${k + 1}。`)
  }
  variables.k.inScope = false
  add('return-main', 17, 'k 離開作用域；return 0 表示 main 正常結束。')
  mainInScope = false
  add('done', 18, 'main 結束，values 離開作用域；主控台保留排序結果。')
  return result('completed', `排序完成：${output.join('、')}。元素比較 ${comparisons} 次、右移 ${shifts} 次。`)
}
