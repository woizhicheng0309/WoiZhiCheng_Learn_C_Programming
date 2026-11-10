import {
  BUBBLE_SORT_SAMPLES,
  type BubbleSortConfig,
  DEFAULT_BUBBLE_SORT_CONFIG,
  validateBubbleSortConfig,
} from './bubbleSortConfig'

export {
  BUBBLE_SORT_SAMPLES,
  type BubbleSortConfig,
  DEFAULT_BUBBLE_SORT_CONFIG,
  validateBubbleSortConfig,
} from './bubbleSortConfig'

export type BubbleSortVariable = 'end' | 'j' | 'swapped' | 'temp' | 'k'
export type BubbleSortPhase = 'enter-main' | 'initialize-values' | 'initialize-end' | 'outer-condition' | 'reset-swapped' | 'initialize-j' | 'inner-condition' | 'compare' | 'save-temp' | 'write-left' | 'write-right' | 'mark-swapped' | 'finish-swap' | 'increment-j' | 'end-pass' | 'check-early-exit' | 'break' | 'continue-passes' | 'finish-pass' | 'decrement-end' | 'initialize-k' | 'print-condition' | 'print' | 'increment-k' | 'return-main' | 'done' | 'blocked'
export interface BubbleSortFrame {
  index: number
  phase: BubbleSortPhase
  activeLine: number
  activePart: string
  explanation: string
  values: readonly number[] | null
  variables: Readonly<Record<BubbleSortVariable, Readonly<{ value: number | null; inScope: boolean }>>>
  mainInScope: boolean
  activeIndices: readonly number[]
  sortedCount: number
  comparisons: number
  swaps: number
  passes: number
  firstPassValues: readonly number[] | null
  output: readonly number[]
}
export function buildBubbleSortSource(config: BubbleSortConfig = DEFAULT_BUBBLE_SORT_CONFIG) {
  const sample = Object.hasOwn(BUBBLE_SORT_SAMPLES, config.sample) ? BUBBLE_SORT_SAMPLES[config.sample] : BUBBLE_SORT_SAMPLES.mixed
  const code = [
    '#include <stdio.h>', '', 'int main(void) {', `  int values[5] = {${sample.join(', ')}};`,
    '  for (int end = 4; end > 0; end--) {', '    int swapped = 0;', '    for (int j = 0; j < end; j++) {',
    `      if (values[j] ${config.order === 'descending' ? '<' : '>'} values[j + 1]) {`,
    '        int temp = values[j];', '        values[j] = values[j + 1];', '        values[j + 1] = temp;',
    '        swapped = 1;', '      }', '    }',
    config.earlyExit === true ? '    if (!swapped) break;' : '    // 提前結束已關閉，繼續下一輪。',
    '  }', '  for (int k = 0; k < 5; k++) {', '    printf("%d ", values[k]);', '  }', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateBubbleSortProgram(config: BubbleSortConfig = DEFAULT_BUBBLE_SORT_CONFIG) {
  const stableConfig = { sample: config.sample, order: config.order, earlyExit: config.earlyExit }
  const source = buildBubbleSortSource(stableConfig)
  const issues = validateBubbleSortConfig(stableConfig)
  const frames: BubbleSortFrame[] = []
  const variables: Record<BubbleSortVariable, { value: number | null; inScope: boolean }> = {
    end: { value: null, inScope: false }, j: { value: null, inScope: false }, swapped: { value: null, inScope: false },
    temp: { value: null, inScope: false }, k: { value: null, inScope: false },
  }
  let values: number[] | null = null
  let mainInScope = true
  let sortedCount = 0
  let comparisons = 0
  let swaps = 0
  let passes = 0
  let firstPassValues: number[] | null = null
  const output: number[] = []
  const add = (phase: BubbleSortPhase, activeLine: number, explanation: string, activeIndices: number[] = []) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      values: values ? [...values] : null,
      variables: { end: { ...variables.end }, j: { ...variables.j }, swapped: { ...variables.swapped }, temp: { ...variables.temp }, k: { ...variables.k } },
      mainInScope, activeIndices: [...activeIndices], sortedCount, comparisons, swaps, passes,
      firstPassValues: firstPassValues ? [...firstPassValues] : null, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    values: values ? [...values] : null, comparisons, swaps, passes, firstPassValues: firstPassValues ? [...firstPassValues] : null, output: [...output] })
  add('enter-main', 3, '進入 main，準備逐對比較相鄰元素。')
  if (issues.length) {
    add('blocked', 3, `輸入不符合本練習範圍，模擬器在初始化前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  values = [...BUBBLE_SORT_SAMPLES[stableConfig.sample]]
  add('initialize-values', 4, '建立五格 values；升冪時每輪把最大值推向尚未排序區段的右端。')
  variables.end = { value: 4, inScope: true }
  add('initialize-end', 5, 'end = 4 是本輪最右邊的位置。j 必須小於 end，才能安全讀取 j + 1。')
  for (let end = 4; ; end--) {
    add('outer-condition', 5, `${end} > 0 為 ${end > 0 ? 'true，開始一輪相鄰比較。' : 'false，最後一格也已確定。'}`)
    if (end <= 0) break
    let swapped = false
    variables.swapped = { value: 0, inScope: true }
    add('reset-swapped', 6, '每輪重新設定 swapped = 0；這一輪只要交換過一次，就會改成 1。')
    variables.j = { value: 0, inScope: true }
    add('initialize-j', 7, 'j 從 0 開始，依序比較左格與緊鄰的右格。')
    for (let j = 0; ; j++) {
      add('inner-condition', 7, `${j} < ${end} 為 ${j < end ? 'true，可以比較 j 與 j + 1。' : 'false，本輪相鄰比較結束；不再讀取右邊格子。'}`)
      if (j >= end) break
      const outOfOrder = stableConfig.order === 'ascending' ? values[j] > values[j + 1] : values[j] < values[j + 1]
      comparisons++
      add('compare', 8, `比較 values[${j}] = ${values[j]} 與 values[${j + 1}] = ${values[j + 1]}：${outOfOrder ? '順序相反，需要交換。' : '順序正確，保持原位；相等時也不交換。'}`, [j, j + 1])
      if (outOfOrder) {
        variables.temp = { value: values[j], inScope: true }
        add('save-temp', 9, `先把左格的 ${values[j]} 存入 temp，避免覆蓋後遺失。`, [j])
        values[j] = values[j + 1]
        add('write-left', 10, `把右格的 ${values[j + 1]} 寫到左格；舊的左格仍保存在 temp。`, [j, j + 1])
        values[j + 1] = variables.temp.value!
        swaps++
        add('write-right', 11, `把 temp = ${variables.temp.value} 寫入右格，完成一次相鄰交換。`, [j, j + 1])
        swapped = true; variables.swapped.value = 1
        add('mark-swapped', 12, '本輪發生過交換，設定 swapped = 1；後面沒有交換也不會改回 0。')
        variables.temp.inScope = false
        add('finish-swap', 13, '離開 if 區塊，temp 離開作用域。')
      }
      variables.j.value = j + 1
      add('increment-j', 7, `j 從 ${j} 更新為 ${j + 1}，接著比較下一對。`)
    }
    variables.j.inScope = false
    passes++
    sortedCount = 5 - end
    if (end === 4) firstPassValues = [...values]
    add('end-pass', 14, `第 ${passes} 輪結束，右側 ${sortedCount} 格已在最終位置；j 離開作用域。`)
    if (stableConfig.earlyExit) {
      add('check-early-exit', 15, `swapped = ${swapped ? 1 : 0}，!swapped 為 ${swapped ? 'false，還需檢查下一輪。' : 'true，整輪沒有交換，整個陣列已有序。'}`)
      if (!swapped) {
        sortedCount = 5
        add('break', 15, 'break 跳出外層迴圈，不執行 end--，也不再次判斷 end > 0。整輪沒有交換才能保證可提前結束。')
        break
      }
    } else add('continue-passes', 15, '提前結束已關閉；即使本輪沒有交換，仍會執行後續各輪。')
    variables.swapped.inScope = false
    add('finish-pass', 16, '離開本輪區塊，swapped 離開作用域；下一輪會重新宣告為 0。')
    variables.end.value = end - 1
    add('decrement-end', 5, `end 從 ${end} 更新為 ${end - 1}，右側已放好的元素不再參與比較。`)
  }
  variables.end.inScope = false
  variables.swapped.inScope = false
  sortedCount = 5
  variables.k = { value: 0, inScope: true }
  add('initialize-k', 17, '排序迴圈結束，end 與 swapped 已離開作用域。建立輸出索引 k = 0。')
  for (let k = 0; ; k++) {
    add('print-condition', 17, `${k} < 5 為 ${k < 5 ? 'true，輸出這一格。' : 'false，輸出完成。'}`)
    if (k >= 5) break
    output.push(values[k])
    add('print', 18, `printf 輸出 values[${k}] = ${values[k]}。`, [k])
    variables.k.value = k + 1
    add('increment-k', 17, `k 從 ${k} 更新為 ${k + 1}。`)
  }
  variables.k.inScope = false
  add('return-main', 20, '輸出迴圈結束，k 離開作用域；return 0 表示 main 正常結束。')
  mainInScope = false
  add('done', 21, 'main 結束，values 離開作用域；主控台保留排序結果。')
  return result('completed', `排序完成：${output.join('、')}。共 ${passes} 輪、比較 ${comparisons} 次、交換 ${swaps} 次。`)
}
