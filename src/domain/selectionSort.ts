export const SORT_SAMPLES = {
  mixed: [4, 1, 5, 2, 3], sorted: [1, 2, 3, 4, 5], reverse: [5, 4, 3, 2, 1], duplicates: [3, 1, 3, 2, 1],
} as const
export interface SelectionSortConfig { sample: keyof typeof SORT_SAMPLES; order: 'ascending' | 'descending' }
export const DEFAULT_SELECTION_SORT_CONFIG: Readonly<SelectionSortConfig> = { sample: 'mixed', order: 'ascending' }
export type SortVariable = 'i' | 'j' | 'best' | 'temp' | 'k'
export type SelectionSortPhase = 'enter-main' | 'initialize-values' | 'initialize-i' | 'outer-condition' | 'initialize-best' | 'initialize-j' | 'inner-condition' | 'compare' | 'update-best' | 'increment-j' | 'check-swap' | 'save-temp' | 'write-front' | 'write-best' | 'finish-swap' | 'end-pass' | 'increment-i' | 'initialize-k' | 'print-condition' | 'print' | 'increment-k' | 'return-main' | 'done' | 'blocked'
export interface SelectionSortFrame {
  index: number
  phase: SelectionSortPhase
  activeLine: number
  activePart: string
  explanation: string
  values: readonly number[] | null
  variables: Readonly<Record<SortVariable, Readonly<{ value: number | null; inScope: boolean }>>>
  mainInScope: boolean
  activeIndices: readonly number[]
  sortedCount: number
  comparisons: number
  swaps: number
  firstPassValues: readonly number[] | null
  output: readonly number[]
}
export function validateSelectionSortConfig(config: SelectionSortConfig = DEFAULT_SELECTION_SORT_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Object.hasOwn(SORT_SAMPLES, config.sample)) issues.push('請選擇有效的陣列範例。')
  if (config.order !== 'ascending' && config.order !== 'descending') issues.push('請選擇升冪或降冪。')
  return issues
}
export function buildSelectionSortSource(config: SelectionSortConfig = DEFAULT_SELECTION_SORT_CONFIG) {
  const sample = Object.hasOwn(SORT_SAMPLES, config.sample) ? SORT_SAMPLES[config.sample] : SORT_SAMPLES.mixed
  const code = [
    '#include <stdio.h>', '', 'int main(void) {', `  int values[5] = {${sample.join(', ')}};`,
    '  for (int i = 0; i < 4; i++) {', '    int best = i;', '    for (int j = i + 1; j < 5; j++) {',
    `      if (values[j] ${config.order === 'descending' ? '>' : '<'} values[best]) {`, '        best = j;', '      }', '    }',
    '    if (best != i) {', '      int temp = values[i];', '      values[i] = values[best];', '      values[best] = temp;', '    }', '  }',
    '  for (int k = 0; k < 5; k++) {', '    printf("%d ", values[k]);', '  }', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateSelectionSortProgram(config: SelectionSortConfig = DEFAULT_SELECTION_SORT_CONFIG) {
  const stableConfig = { sample: config.sample, order: config.order }
  const source = buildSelectionSortSource(stableConfig)
  const issues = validateSelectionSortConfig(stableConfig)
  const frames: SelectionSortFrame[] = []
  const variables: Record<SortVariable, { value: number | null; inScope: boolean }> = {
    i: { value: null, inScope: false }, j: { value: null, inScope: false }, best: { value: null, inScope: false },
    temp: { value: null, inScope: false }, k: { value: null, inScope: false },
  }
  let values: number[] | null = null
  let mainInScope = true
  let sortedCount = 0
  let comparisons = 0
  let swaps = 0
  let firstPassValues: number[] | null = null
  const output: number[] = []
  const add = (phase: SelectionSortPhase, activeLine: number, explanation: string, activeIndices: number[] = []) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      values: values ? [...values] : null, variables: { i: { ...variables.i }, j: { ...variables.j }, best: { ...variables.best }, temp: { ...variables.temp }, k: { ...variables.k } },
      mainInScope, activeIndices: [...activeIndices], sortedCount, comparisons, swaps,
      firstPassValues: firstPassValues ? [...firstPassValues] : null, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    values: values ? [...values] : null, comparisons, swaps, firstPassValues: firstPassValues ? [...firstPassValues] : null, output: [...output] })
  add('enter-main', 3, '進入 main，準備用選擇排序逐輪放好元素。')
  if (issues.length) {
    add('blocked', 3, `輸入不符合本練習範圍，模擬器在初始化前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  values = [...SORT_SAMPLES[stableConfig.sample]]
  add('initialize-values', 4, '建立五格 values；排序會改寫元素位置，不會改變元素數量。')
  variables.i = { value: 0, inScope: true }
  add('initialize-i', 5, '外層 i 從 0 開始，代表這一輪要放好的位置。')
  for (let i = 0; ; i++) {
    add('outer-condition', 5, `${i} < 4 為 ${i < 4 ? 'true，開始下一輪。' : 'false；前四格已放好，最後一格也就確定了。'}`)
    if (i >= 4) break
    let best: number = i
    variables.best = { value: best, inScope: true }
    add('initialize-best', 6, `best 先指向 i = ${i}，再檢查右邊尚未排序的格子。`, [i])
    variables.j = { value: i + 1, inScope: true }
    add('initialize-j', 7, `j 從 ${i + 1} 開始；已排序的前 ${i} 格不必再參與本輪比較。`)
    for (let j = i + 1; ; j++) {
      add('inner-condition', 7, `${j} < 5 為 ${j < 5 ? 'true，才能比較這一格。' : 'false，本輪候選已確定。'}`)
      if (j >= 5) break
      const better = stableConfig.order === 'ascending' ? values[j] < values[best] : values[j] > values[best]
      comparisons++
      add('compare', 8, `比較 values[${j}] = ${values[j]} 與 values[${best}] = ${values[best]}：${better ? '找到更適合的候選。' : '保留目前 best；相等時也不更新。'}`, [j, best])
      if (better) {
        best = j; variables.best.value = best
        add('update-best', 9, `best 更新為索引 ${best}，不是元素值 ${values[best]}。`, [best])
      }
      variables.j.value = j + 1
      add('increment-j', 7, `j 從 ${j} 變為 ${j + 1}。`)
    }
    variables.j.inScope = false
    add('check-swap', 12, `best = ${best}，i = ${i}；${best !== i ? '位置不同，需要交換。' : '位置相同，不需要交換。'}`, [i, best])
    if (best !== i) {
      variables.temp = { value: values[i], inScope: true }
      add('save-temp', 13, `先把 values[${i}] 的舊值 ${values[i]} 存入 temp，避免被覆蓋後遺失。`, [i])
      values[i] = values[best]
      add('write-front', 14, `把候選值 ${values[best]} 寫到位置 ${i}；此刻兩格可能相同，但原值仍在 temp。`, [i, best])
      values[best] = variables.temp.value!
      swaps++
      add('write-best', 15, `把 temp = ${variables.temp.value} 寫回位置 ${best}，完成一次交換。`, [i, best])
      variables.temp.inScope = false
      add('finish-swap', 16, '離開 if 區塊，temp 離開作用域。')
    }
    sortedCount = i + 1
    if (i === 0) firstPassValues = [...values]
    variables.best.inScope = false
    add('end-pass', 17, `第 ${i + 1} 輪結束，前 ${sortedCount} 格已在最終位置；best 離開本輪作用域。`)
    variables.i.value = i + 1
    add('increment-i', 5, `i 從 ${i} 更新為 ${i + 1}，接著只處理右側尚未排序區段。`)
  }
  variables.i.inScope = false
  sortedCount = 5
  variables.k = { value: 0, inScope: true }
  add('initialize-k', 18, '排序完成，i 已離開作用域。建立輸出迴圈的 k = 0。')
  for (let k = 0; ; k++) {
    add('print-condition', 18, `${k} < 5 為 ${k < 5 ? 'true，輸出這一格。' : 'false，輸出完成。'}`)
    if (k >= 5) break
    output.push(values[k])
    add('print', 19, `printf 輸出 values[${k}] = ${values[k]}。`, [k])
    variables.k.value = k + 1
    add('increment-k', 18, `k 從 ${k} 更新為 ${k + 1}。`)
  }
  variables.k.inScope = false
  add('return-main', 21, '輸出迴圈結束，k 離開作用域；return 0 表示 main 正常結束。')
  mainInScope = false
  add('done', 22, 'main 結束，values 離開作用域；主控台保留排序結果。')
  return result('completed', `排序完成：${output.join('、')}。共比較 ${comparisons} 次、交換 ${swaps} 次。`)
}
