import {
  REALLOCATION_DATASETS,
  type ReallocationConfig,
  DEFAULT_REALLOCATION_CONFIG,
  validateReallocationConfig,
} from './reallocationConfig'

export {
  REALLOCATION_DATASETS,
  REALLOCATION_OUTCOMES,
  type ReallocationConfig,
  DEFAULT_REALLOCATION_CONFIG,
  validateReallocationConfig,
} from './reallocationConfig'

export type ReallocationPhase = 'prepare' | 'enter-main' | 'initialize-count' | 'allocate-original' | 'check-original'
  | 'initialize-original' | 'set-requested' | 'reallocate' | 'check-result' | 'adopt-result'
  | 'new-for-init' | 'new-for-condition' | 'initialize-new' | 'new-for-update' | 'update-count' | 'print-failure'
  | 'initialize-sum' | 'sum-for-init' | 'sum-for-condition' | 'accumulate' | 'sum-for-update' | 'print-result'
  | 'free' | 'clear-p' | 'clear-tmp' | 'return-main' | 'done' | 'blocked'
export type ReallocationPointer = 'undeclared' | 'A' | 'B' | 'invalidated' | 'null'
export interface ReallocationBlock {
  status: 'not-created' | 'live' | 'ended' | 'freed'
  capacity: number
  location: 'X' | 'Y' | null
  cells: readonly (number | null)[]
}
export interface ReallocationFrame {
  index: number
  phase: ReallocationPhase
  activeLine: number
  activePart: string
  explanation: string
  mainInScope: boolean
  p: ReallocationPointer
  tmp: ReallocationPointer
  original: Readonly<ReallocationBlock>
  resized: Readonly<ReallocationBlock>
  count: number | null
  requested: number | null
  i: number | null
  iInScope: boolean
  sum: number | null
  activeBlock: 'A' | 'B' | null
  activeCell: number | null
  condition: { expression: string; value: boolean } | null
  printedValues: readonly number[] | null
  exitCode: number | null
  output: readonly string[]
}
export function buildReallocationSource(config: ReallocationConfig = DEFAULT_REALLOCATION_CONFIG) {
  const safe = validateReallocationConfig(config).length ? DEFAULT_REALLOCATION_CONFIG : config
  const values = REALLOCATION_DATASETS[safe.dataset].values
  const code = ['#include <stdio.h>', '#include <stdlib.h>', '', 'int main(void) {', '  int count = 3;',
    '  int *p = malloc((size_t)count * sizeof *p);', '  if (p == NULL) {', '    return 1;', '  }',
    ...values.map((value, index) => `  p[${index}] = ${value};`), `  int requested = ${safe.requested};`,
    '  int *tmp = realloc(p, (size_t)requested * sizeof *p);', '  if (tmp != NULL) {', '    p = tmp;',
    '    for (int i = count; i < requested; i++) {', `      p[i] = ${safe.fill};`, '    }', '    count = requested;',
    '  } else {', '    puts("resize failed; original kept");', '  }', '  int sum = 0;',
    '  for (int i = 0; i < count; i++) {', '    sum += p[i];', '  }',
    '  printf("count=%d, sum=%d\\n", count, sum);', '  free(p);', '  p = NULL;', '  tmp = NULL;', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateReallocationProgram(config: ReallocationConfig = DEFAULT_REALLOCATION_CONFIG) {
  const stableConfig = { dataset: config.dataset, outcome: config.outcome, requested: config.requested, fill: config.fill }
  const source = buildReallocationSource(stableConfig)
  const issues = validateReallocationConfig(stableConfig)
  const frames: ReallocationFrame[] = []
  type MutableBlock = Omit<ReallocationBlock, 'cells'> & { cells: (number | null)[] }
  const original: MutableBlock = { status: 'not-created', capacity: 0, location: null, cells: [] }
  const resized: MutableBlock = { status: 'not-created', capacity: 0, location: null, cells: [] }
  let p: ReallocationPointer = 'undeclared'
  let tmp: ReallocationPointer = 'undeclared'
  let mainInScope = false
  let count: number | null = null
  let requested: number | null = null
  let i: number | null = null
  let iInScope = false
  let sum: number | null = null
  let printedValues: number[] | null = null
  let exitCode: number | null = null
  const output: string[] = []
  const snapshot = (block: MutableBlock): ReallocationBlock => ({ ...block, cells: [...block.cells] })
  const add = (phase: ReallocationPhase, activeLine: number, explanation: string, activeBlock: 'A' | 'B' | null = null,
    activeCell: number | null = null, condition: ReallocationFrame['condition'] = null, activePart = `line-${activeLine}`) => {
    frames.push({ index: frames.length, phase, activeLine, activePart, explanation, mainInScope, p, tmp,
      original: snapshot(original), resized: snapshot(resized), count, requested, i, iInScope, sum,
      activeBlock, activeCell, condition: condition ? { ...condition } : null,
      printedValues: printedValues ? [...printedValues] : null, exitCode, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({
    config: stableConfig, source, frames, status, message, original: snapshot(original), resized: snapshot(resized),
    p, tmp, sum, count, printedValues: printedValues ? [...printedValues] : null, exitCode, output: [...output],
  })
  add('prepare', 4, '準備建立原區塊 A，再透過暫存指標 tmp 接收容量調整結果。')
  if (issues.length) {
    add('blocked', 4, `設定超出本課範圍，在配置前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  mainInScope = true
  add('enter-main', 4, '進入 main；本課模擬第一次 malloc 成功，專注觀察 realloc 的結果。')
  count = 3
  add('initialize-count', 5, '原容量 count = 3。')
  Object.assign(original, { status: 'live', capacity: 3, location: 'X', cells: [null, null, null] })
  p = 'A'
  add('allocate-original', 6, '第一次 malloc 成功，p 指向 A；三個 int 尚未初始化。', 'A')
  add('check-original', 7, 'p == NULL 不成立，略過 return 1；真實程式仍需保留這項檢查。', null, null, { expression: 'p == NULL', value: false })
  REALLOCATION_DATASETS[stableConfig.dataset].values.forEach((value, index) => {
    original.cells[index] = value
    add('initialize-original', 10 + index, `先把 p[${index}] 寫入 ${value}，原三個元素會在調整前全部初始化。`, 'A', index)
  })
  requested = stableConfig.requested
  add('set-requested', 13, `requested = ${requested}，是目標容量；目前 count 仍為 3。`)
  const succeeded = stableConfig.outcome !== 'failure'
  if (succeeded) {
    resized.cells = Array.from({ length: requested }, (_, index) => index < 3 ? original.cells[index] : null)
    resized.capacity = requested; resized.location = stableConfig.outcome === 'in-place' ? 'X' : 'Y'; resized.status = 'live'
    original.cells = []; original.status = 'ended'
    p = 'invalidated'; tmp = 'B'
  } else tmp = 'null'
  add('reallocate', 14, succeeded ? 'realloc 成功，舊物件 A 的生命週期結束，tmp 指向結果 B。p 的舊值不可再使用；位置相同也要改用回傳值。'
    : 'realloc 失敗，tmp 是 NULL；原區塊 A 與 p 仍然有效，容量與內容保持不變。', succeeded ? 'B' : 'A')
  add('check-result', 15, succeeded ? 'tmp != NULL 成立，進入成功分支。' : 'tmp != NULL 不成立，進入保留原配置的分支。', null, null, { expression: 'tmp != NULL', value: succeeded })
  if (succeeded) {
    p = 'B'
    add('adopt-result', 16, '以 tmp 直接改寫 p，不讀取 p 的舊值。現在 p 與 tmp 都指向結果 B。', 'B')
    i = count; iInScope = true
    add('new-for-init', 17, '從原容量 count = 3 開始，只初始化新增元素，不覆寫保留下來的前綴。', null, null, null, 'new-for-init')
    while (true) {
      const valid = i < requested
      add('new-for-condition', 17, valid ? `${i} < ${requested} 成立，要寫入新增元素。` : `${i} < ${requested} 不成立，沒有下一個新增元素需要初始化。`,
        null, null, { expression: `${i} < ${requested}`, value: valid }, 'new-for-condition')
      if (!valid) { iInScope = false; break }
      resized.cells[i] = stableConfig.fill
      add('initialize-new', 18, `新增的 p[${i}] 先寫入 ${stableConfig.fill}，之後才能讀取加總。`, 'B', i)
      i++
      add('new-for-update', 17, `i++ 後 i = ${i}，回去檢查新增元素的界線。`, null, null, null, 'new-for-update')
    }
    count = requested
    add('update-count', 20, `成功後才把 count 改為 ${count}，供後面的走訪使用。`)
  } else {
    output.push('resize failed; original kept')
    add('print-failure', 22, '輸出調整失敗訊息，仍用原來的 count = 3 與 p 存取 A。', 'A')
  }
  sum = 0
  add('initialize-sum', 24, 'sum 從 0 開始，依目前有效容量走訪。')
  i = 0; iInScope = true
  add('sum-for-init', 25, '建立另一個獨立的迴圈變數 i = 0。', null, null, null, 'sum-for-init')
  const active = succeeded ? resized : original
  const blockId = succeeded ? 'B' : 'A'
  while (true) {
    const valid = i < count
    add('sum-for-condition', 25, valid ? `${i} < ${count} 成立，可讀取目前有效區塊的元素。` : `${i} < ${count} 不成立，不讀取容量之外的元素。`,
      null, null, { expression: `${i} < ${count}`, value: valid }, 'sum-for-condition')
    if (!valid) { iInScope = false; break }
    sum += active.cells[i]!
    add('accumulate', 26, `把已初始化的 p[${i}] 加入總和，目前 sum = ${sum}。`, blockId, i)
    i++
    add('sum-for-update', 25, `i++ 後 i = ${i}，先檢查條件再讀取下一格。`, null, null, null, 'sum-for-update')
  }
  printedValues = [count, sum]
  output.push(`count=${count}, sum=${sum}`)
  add('print-result', 28, '輸出目前有效容量與總和；失敗時保留原容量，成功時使用新容量。')
  active.cells = []; active.status = 'freed'; p = 'invalidated'
  if (succeeded) tmp = 'invalidated'
  add('free', 29, '只釋放目前有效區塊一次。指向它的指標值都失效，不讀取或比較這些舊值。')
  p = 'null'
  add('clear-p', 30, '直接改寫 p = NULL。')
  tmp = 'null'
  add('clear-tmp', 31, '直接改寫 tmp = NULL；不再透過任何別名存取已釋放區塊。')
  exitCode = 0
  add('return-main', 32, 'main 回傳 0，成功或失敗分支都已清理有效配置。')
  mainInScope = false
  add('done', 33, 'main 結束，所有區域變數離開作用域；主控台保留輸出。')
  return result('completed', `有效容量 ${count}，總和 ${sum}，配置已清理。`)
}
