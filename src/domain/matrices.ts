import {
  MATRIX_ROWS,
  MATRIX_COLUMNS,
  type MatrixConfig,
  DEFAULT_MATRIX_CONFIG,
  validateMatrixConfig,
} from './matricesConfig'

export {
  MATRIX_ROWS,
  MATRIX_COLUMNS,
  type MatrixConfig,
  DEFAULT_MATRIX_CONFIG,
  validateMatrixConfig,
} from './matricesConfig'

export const MATRIX_VALUES: readonly (readonly number[])[] = [[1, 2, 3], [4, 5, 6]]
export type MatrixPhase = 'enter-main' | 'initialize-grid' | 'read-selected' | 'print-selected' | 'initialize-sum' | 'initialize-outer' | 'outer-condition' | 'initialize-inner' | 'inner-condition' | 'accumulate' | 'print-value' | 'increment-inner' | 'increment-outer' | 'print-sum' | 'return-main' | 'done' | 'blocked'
export interface MatrixVisit { row: number; column: number; offset: number; value: number }
export interface MatrixFrame {
  index: number
  phase: MatrixPhase
  activeLine: number
  activePart: string
  explanation: string
  grid: readonly (readonly number[])[] | null
  mainInScope: boolean
  row: number | null
  column: number | null
  rowInScope: boolean
  columnInScope: boolean
  selected: number | null
  sum: number | null
  activeCell: MatrixVisit | null
  visits: readonly Readonly<MatrixVisit>[]
  output: readonly number[]
  selectedOutput: string | null
  summary: string | null
}
export function buildMatrixSource(config: MatrixConfig = DEFAULT_MATRIX_CONFIG) {
  const literal = (value: number) => Number.isSafeInteger(value) ? String(value) : '0 /* invalid index */'
  const rowFirst = config.mode !== 'column-first'
  const code = [
    '#include <stdio.h>', '', 'int main(void) {', '  int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};',
    `  int selected = grid[${literal(config.targetRow)}][${literal(config.targetColumn)}];`,
    '  printf("selected = %d\\n", selected);', '  int sum = 0;',
    rowFirst ? '  for (int row = 0; row < 2; row++) {' : '  for (int col = 0; col < 3; col++) {',
    rowFirst ? '    for (int col = 0; col < 3; col++) {' : '    for (int row = 0; row < 2; row++) {',
    '      sum += grid[row][col];', '      printf("%d ", grid[row][col]);', '    }', '  }',
    '  printf("\\nsum = %d\\n", sum);', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateMatrixProgram(config: MatrixConfig = DEFAULT_MATRIX_CONFIG) {
  const stableConfig = { mode: config.mode, targetRow: config.targetRow, targetColumn: config.targetColumn }
  const source = buildMatrixSource(stableConfig)
  const issues = validateMatrixConfig(stableConfig)
  const frames: MatrixFrame[] = []
  let grid: number[][] | null = null
  let mainInScope = true
  let selected: number | null = null
  let sum: number | null = null
  let selectedOutput: string | null = null
  let summary: string | null = null
  const output: number[] = []
  const visits: MatrixVisit[] = []
  const coordinates = { row: null as number | null, column: null as number | null }
  const scopes = { row: false, column: false }
  const add = (phase: MatrixPhase, activeLine: number, explanation: string, activeCell: MatrixVisit | null = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      grid: grid?.map(row => [...row]) ?? null, mainInScope, row: coordinates.row, column: coordinates.column,
      rowInScope: scopes.row, columnInScope: scopes.column, selected, sum,
      activeCell: activeCell ? { ...activeCell } : null, visits: visits.map(visit => ({ ...visit })), output: [...output], selectedOutput, summary })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    selected, sum, visits: visits.map(visit => ({ ...visit })), output: [...output] })
  add('enter-main', 3, '進入 main，準備建立二維陣列。')
  if (stableConfig.mode !== 'row-first' && stableConfig.mode !== 'column-first') {
    add('blocked', 3, issues.join(' '))
    return result('blocked', issues.join(' '))
  }
  grid = MATRIX_VALUES.map(row => [...row])
  add('initialize-grid', 4, '建立 2 列、每列 3 格的 grid；C 依逐列順序存放元素：1、2、3、4、5、6。')
  if (issues.length) {
    const message = `模擬器在讀取前停止：${issues.join(' ')}每個索引都必須在自己的維度內；下一列存在也不代表 grid[0][3] 合法。`
    add('blocked', 5, message)
    return result('blocked', message)
  }
  selected = grid[stableConfig.targetRow][stableConfig.targetColumn]
  const target = { row: stableConfig.targetRow, column: stableConfig.targetColumn, offset: stableConfig.targetRow * MATRIX_COLUMNS + stableConfig.targetColumn, value: selected }
  add('read-selected', 5, `grid[${target.row}][${target.column}] = ${selected}；第一個索引選列，第二個索引選欄。元素偏移為 ${target.row} × 3 + ${target.column} = ${target.offset}。`, target)
  selectedOutput = `selected = ${selected}`
  add('print-selected', 6, `printf 輸出「${selectedOutput}」。`, target)
  sum = 0
  add('initialize-sum', 7, 'sum 從 0 開始。走訪時只讀取 grid，不改寫它的排列或內容。')
  const outer = stableConfig.mode === 'row-first' ? 'row' : 'column'
  const inner = outer === 'row' ? 'column' : 'row'
  const limit = { row: MATRIX_ROWS, column: MATRIX_COLUMNS }
  const name = { row: 'row', column: 'col' }
  coordinates[outer] = 0; scopes[outer] = true
  add('initialize-outer', 8, `外層 ${name[outer]} 初始化為 0。`)
  for (;;) {
    const outerValue: number = coordinates[outer]!
    add('outer-condition', 8, `${name[outer]} < ${limit[outer]}：${outerValue} < ${limit[outer]} 為 ${outerValue < limit[outer] ? 'true，進入本體。' : 'false，結束外層。'}`)
    if (outerValue >= limit[outer]) break
    coordinates[inner] = 0; scopes[inner] = true
    add('initialize-inner', 9, `每次進入外層本體，都重新建立 ${name[inner]} = 0。`)
    for (;;) {
      const innerValue: number = coordinates[inner]!
      add('inner-condition', 9, `${name[inner]} < ${limit[inner]}：${innerValue} < ${limit[inner]} 為 ${innerValue < limit[inner] ? 'true，讀取元素。' : 'false，結束內層。'}`)
      if (innerValue >= limit[inner]) break
      const row = coordinates.row!, column = coordinates.column!
      const visit = { row, column, offset: row * MATRIX_COLUMNS + column, value: grid[row][column] }
      sum += visit.value
      visits.push(visit)
      add('accumulate', 10, `讀取 grid[${row}][${column}] = ${visit.value}，加入後 sum = ${sum}。`, visit)
      output.push(visit.value)
      add('print-value', 11, `printf 輸出 ${visit.value}；記憶體中的元素偏移是 ${visit.offset}。`, visit)
      coordinates[inner] = innerValue + 1
      add('increment-inner', 9, `內層更新：${name[inner]} 從 ${innerValue} 變為 ${innerValue + 1}。`)
    }
    scopes[inner] = false
    coordinates[outer] = outerValue + 1
    add('increment-outer', 8, `內層變數已離開作用域；外層 ${name[outer]} 從 ${outerValue} 變為 ${outerValue + 1}。`)
  }
  scopes[outer] = false
  summary = `sum = ${sum}`
  add('print-sum', 14, `兩層迴圈皆已結束，row、col 都離開作用域。輸出「${summary}」；兩種走訪的總和相同。`)
  add('return-main', 15, 'return 0 表示 main 正常結束。')
  mainInScope = false
  add('done', 16, 'main 結束，grid、selected 與 sum 離開作用域；主控台保留輸出。')
  return result('completed', `依序讀取 ${output.join('、')}，總和 ${sum}。`)
}
