export const MULTIPLICATION_TABLE_LIMITS = {
  min: 1,
  max: 12,
  defaultRows: 9,
  defaultColumns: 9,
} as const

export type NestedLoopPhase = 'ready' | 'cell' | 'done'

export type NestedLoopSourcePart = 'outer-loop' | 'body' | 'outer-exit'

export interface MultiplicationCell {
  index: number
  row: number
  column: number
  product: number
}

export interface NestedLoopFrame {
  index: number
  phase: NestedLoopPhase
  outerValue: number
  innerValue: number
  activeCell: MultiplicationCell | null
  completedCells: number
  activeLine: number
  activePart: NestedLoopSourcePart
  explanation: string
}

export interface NestedLoopSimulation {
  rows: number
  columns: number
  cells: readonly MultiplicationCell[]
  frames: readonly NestedLoopFrame[]
  sourceLines: readonly string[]
}

function normalizeLimit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(
    MULTIPLICATION_TABLE_LIMITS.max,
    Math.max(MULTIPLICATION_TABLE_LIMITS.min, Math.trunc(value)),
  )
}

/** Build the row-major execution trace for an a-by-b multiplication table. */
export function simulateNestedMultiplicationTable(
  requestedRows: number,
  requestedColumns: number,
): NestedLoopSimulation {
  const rows = normalizeLimit(requestedRows, MULTIPLICATION_TABLE_LIMITS.defaultRows)
  const columns = normalizeLimit(requestedColumns, MULTIPLICATION_TABLE_LIMITS.defaultColumns)
  const cells: MultiplicationCell[] = []

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      cells.push({
        index: cells.length,
        row,
        column,
        product: row * column,
      })
    }
  }

  const frames: NestedLoopFrame[] = [
    {
      index: 0,
      phase: 'ready',
      outerValue: 1,
      innerValue: 1,
      activeCell: null,
      completedCells: 0,
      activeLine: 3,
      activePart: 'outer-loop',
      explanation: `準備建立 ${rows} 列 × ${columns} 欄的乘法表。外層迴圈從 i = 1 開始。`,
    },
  ]

  cells.forEach((cell) => {
    const isLastColumn = cell.column === columns
    const isLastCell = cell.index === cells.length - 1
    let nextStep: string

    if (isLastCell) {
      nextStep = '這是最後一格；內層與外層迴圈接著都會結束。'
    } else if (isLastColumn) {
      nextStep = `第 ${cell.row} 列完成；j 重設為 1，外層 i 增加為 ${cell.row + 1}。`
    } else {
      nextStep = `外層 i 保持 ${cell.row}，內層 j 增加為 ${cell.column + 1}。`
    }

    frames.push({
      index: frames.length,
      phase: 'cell',
      outerValue: cell.row,
      innerValue: cell.column,
      activeCell: cell,
      completedCells: cell.index + 1,
      activeLine: 5,
      activePart: 'body',
      explanation: `計算 ${cell.row} × ${cell.column} = ${cell.product}。${nextStep}`,
    })
  })

  frames.push({
    index: frames.length,
    phase: 'done',
    outerValue: rows + 1,
    innerValue: columns + 1,
    activeCell: null,
    completedCells: cells.length,
    activeLine: 8,
    activePart: 'outer-exit',
    explanation: `完成 ${rows * columns} 次乘法，${rows} 列 × ${columns} 欄的乘法表已全部產生。`,
  })

  return {
    rows,
    columns,
    cells,
    frames,
    sourceLines: [
      `int a = ${rows};`,
      `int b = ${columns};`,
      'for (int i = 1; i <= a; i++) {',
      '  for (int j = 1; j <= b; j++) {',
      '    printf("%d x %d = %d\\n", i, j, i * j);',
      '  }',
      '  printf("\\n");',
      '}',
    ],
  }
}
