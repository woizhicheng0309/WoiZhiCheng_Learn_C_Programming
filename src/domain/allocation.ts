export const ALLOCATORS = {
  malloc: { label: 'malloc：內容未初始化' },
  calloc: { label: 'calloc：整數元素初始為 0' },
} as const
export interface AllocationConfig {
  allocator: keyof typeof ALLOCATORS
  outcome: 'success' | 'failure'
  count: number
  start: number
}
export const DEFAULT_ALLOCATION_CONFIG: Readonly<AllocationConfig> = { allocator: 'malloc', outcome: 'success', count: 3, start: 5 }
export type AllocationPhase = 'prepare' | 'enter-main' | 'initialize-count' | 'allocate' | 'check-allocation'
  | 'print-failure' | 'return-failure' | 'initialize-sum' | 'for-init' | 'for-condition'
  | 'initialize-cell' | 'accumulate' | 'for-update' | 'print-sum' | 'free' | 'clear-pointer'
  | 'return-success' | 'done' | 'blocked'
export type AllocationHeapStatus = 'not-requested' | 'live' | 'failed' | 'freed'
export interface AllocationFrame {
  index: number
  phase: AllocationPhase
  activeLine: number
  activePart: string
  explanation: string
  mainInScope: boolean
  count: number | null
  pointer: 'undeclared' | 'heap' | 'null' | 'invalidated'
  heapStatus: AllocationHeapStatus
  /** null is an uninitialized int, never a numeric zero. Freed blocks retain no readable cells. */
  cells: readonly (number | null)[]
  activeCell: number | null
  sum: number | null
  i: number | null
  iInScope: boolean
  condition: { expression: string; value: boolean } | null
  predictionValue: number | null
  exitCode: number | null
  output: readonly string[]
}

export function validateAllocationConfig(config: AllocationConfig = DEFAULT_ALLOCATION_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.allocator !== 'string' || !Object.hasOwn(ALLOCATORS, config.allocator)) issues.push('請選擇 malloc 或 calloc。')
  if (config.outcome !== 'success' && config.outcome !== 'failure') issues.push('請選擇有效的配置結果情境。')
  if (!Number.isSafeInteger(config.count) || config.count < 1 || config.count > 5) issues.push('元素數量必須是 1 到 5 的整數。')
  if (!Number.isSafeInteger(config.start) || config.start < 0 || config.start > 20) issues.push('起始值必須是 0 到 20 的整數。')
  return issues
}
export function buildAllocationSource(config: AllocationConfig = DEFAULT_ALLOCATION_CONFIG) {
  const safe = validateAllocationConfig(config).length ? DEFAULT_ALLOCATION_CONFIG : config
  const call = safe.allocator === 'calloc' ? 'calloc((size_t)count, sizeof *p)' : 'malloc((size_t)count * sizeof *p)'
  const code = ['#include <stdio.h>', '#include <stdlib.h>', '', 'int main(void) {', `  int count = ${safe.count};`,
    `  int *p = ${call};`, '  if (p == NULL) {', '    puts("allocation failed");', '    return 1;', '  }',
    '  int sum = 0;', '  for (int i = 0; i < count; i++) {', `    p[i] = ${safe.start} + i;`,
    '    sum += p[i];', '  }', '  printf("sum=%d\\n", sum);', '  free(p);', '  p = NULL;', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}

export function simulateAllocationProgram(config: AllocationConfig = DEFAULT_ALLOCATION_CONFIG) {
  const stableConfig = { allocator: config.allocator, outcome: config.outcome, count: config.count, start: config.start }
  const source = buildAllocationSource(stableConfig)
  const issues = validateAllocationConfig(stableConfig)
  const frames: AllocationFrame[] = []
  let mainInScope = false
  let count: number | null = null
  let pointer: AllocationFrame['pointer'] = 'undeclared'
  let heapStatus: AllocationHeapStatus = 'not-requested'
  let cells: (number | null)[] = []
  let sum: number | null = null
  let i: number | null = null
  let iInScope = false
  let predictionValue: number | null = null
  let exitCode: number | null = null
  const output: string[] = []
  const add = (phase: AllocationPhase, activeLine: number, explanation: string, activeCell: number | null = null,
    condition: AllocationFrame['condition'] = null, activePart = `line-${activeLine}`) => {
    frames.push({ index: frames.length, phase, activeLine, activePart, explanation, mainInScope, count, pointer,
      heapStatus, cells: [...cells], activeCell, sum, i, iInScope, condition: condition ? { ...condition } : null,
      predictionValue, exitCode, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({
    config: stableConfig, source, frames, status, message, heapStatus, cells: [...cells], pointer, sum, exitCode, output: [...output],
  })
  add('prepare', 4, '準備執行 main，目前尚未建立指標或請求動態記憶體。')
  if (issues.length) {
    add('blocked', 4, `設定超出本練習範圍，在配置前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  mainInScope = true
  add('enter-main', 4, '進入 main，接著決定要配置的 int 元素數量。')
  count = stableConfig.count
  add('initialize-count', 5, `count = ${count}；請求 ${count} × sizeof(int)，不假設每個 int 固定佔幾個位元組。`)
  if (stableConfig.outcome === 'failure') {
    pointer = 'null'; heapStatus = 'failed'
  } else {
    pointer = 'heap'; heapStatus = 'live'
    cells = Array.from({ length: count }, () => stableConfig.allocator === 'calloc' ? 0 : null)
  }
  add('allocate', 6, pointer === 'null' ? `${stableConfig.allocator} 在這次模擬情境回傳 NULL，沒有取得可用區塊。`
    : stableConfig.allocator === 'malloc' ? 'malloc 配置成功，但 int 元素尚未初始化；未寫入前不能把內容當成已知數值讀取。'
      : 'calloc 配置成功並將所有位元設為 0，本課的 int 元素初始值都是 0。')
  const failed = pointer === 'null'
  add('check-allocation', 7, failed ? 'p == NULL 成立，進入失敗分支，不進行陣列存取。'
    : 'p == NULL 不成立，略過失敗分支，接著初始化並使用區塊。', null, { expression: 'p == NULL', value: failed })
  if (failed) {
    output.push('allocation failed')
    add('print-failure', 8, '輸出失敗訊息；sum 尚未宣告，也沒有寫入或讀取任何元素。')
    exitCode = 1; predictionValue = 1
    add('return-failure', 9, 'main 回傳 1，這條路徑不會執行後面的迴圈、free 或正常回傳。')
    mainInScope = false
    add('done', 20, '失敗分支已處理，main 結束；沒有配置成功的區塊需要釋放。')
    return result('completed', '配置失敗已處理：main 回傳 1，未存取任何區塊。')
  }
  sum = 0
  add('initialize-sum', 11, 'sum 從 0 開始；接下來每格都先寫入，再加入總和。')
  i = 0; iInScope = true
  add('for-init', 12, '建立 i = 0，準備檢查索引界線。', null, null, 'for-init')
  while (true) {
    const valid = i < count
    add('for-condition', 12, valid ? `${i} < ${count} 成立，可以處理 p[${i}]。`
      : `${i} < ${count} 不成立，不存取尾端下一格。`, null, { expression: `${i} < ${count}`, value: valid }, 'for-condition')
    if (!valid) { iInScope = false; break }
    cells[i] = stableConfig.start + i
    add('initialize-cell', 13, `先寫入 p[${i}] = ${stableConfig.start} + ${i}，這格現在才有程式指定的數值 ${cells[i]}。`, i)
    sum += cells[i]!
    add('accumulate', 14, `讀取已初始化的 p[${i}]，sum 變成 ${sum}。`, i)
    i++
    add('for-update', 12, `i++ 後 i = ${i}，先檢查條件，再決定是否存取下一格。`, null, null, 'for-update')
  }
  output.push(`sum=${sum}`); predictionValue = sum
  add('print-sum', 16, '輸出總和；所有元素都已在讀取前寫入，i 已離開迴圈作用域。')
  heapStatus = 'freed'; pointer = 'invalidated'; cells = []
  add('free', 17, 'free(p) 結束配置區塊的生命週期。原指標值已失效，不讀取它，也不能再存取任何元素。')
  pointer = 'null'
  add('clear-pointer', 18, '直接把 p 指派為 NULL，不讀取舊指標值；這一步不會再釋放一次區塊。')
  exitCode = 0
  add('return-success', 19, 'main 正常回傳 0，配置成功的區塊已釋放。')
  mainInScope = false
  add('done', 20, 'main 結束，區域變數離開作用域；區塊已釋放，主控台保留輸出。')
  return result('completed', `sum = ${sum}，區塊已釋放，main 回傳 0。`)
}
