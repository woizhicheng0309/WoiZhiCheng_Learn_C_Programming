import {
  MULTIPLICATION_TABLE_LIMITS,
  simulateNestedMultiplicationTable,
} from './nestedLoopSimulator'

describe('nested-loop multiplication table simulator', () => {
  it('builds a complete 9 by 9 table by default', () => {
    const simulation = simulateNestedMultiplicationTable(9, 9)

    expect(simulation.cells).toHaveLength(81)
    expect(simulation.frames).toHaveLength(83)
    expect(simulation.cells[0]).toMatchObject({ row: 1, column: 1, product: 1 })
    expect(simulation.cells.at(-1)).toMatchObject({ row: 9, column: 9, product: 81 })
    expect(simulation.frames.at(-1)).toMatchObject({ phase: 'done', completedCells: 81 })
  })

  it('walks cells in row-major order like two nested for loops', () => {
    const simulation = simulateNestedMultiplicationTable(2, 3)

    expect(simulation.cells.map(({ row, column }) => [row, column])).toEqual([
      [1, 1], [1, 2], [1, 3],
      [2, 1], [2, 2], [2, 3],
    ])
    expect(simulation.frames[3].explanation).toContain('j 重設為 1')
    expect(simulation.frames[3].explanation).toContain('i 增加為 2')
  })

  it('generates source code with adjustable a and b limits', () => {
    const simulation = simulateNestedMultiplicationTable(3, 4)

    expect(simulation.sourceLines).toContain('int a = 3;')
    expect(simulation.sourceLines).toContain('int b = 4;')
    expect(simulation.cells).toHaveLength(12)
    expect(simulation.cells.at(-1)?.product).toBe(12)
  })

  it('clamps unsafe dimensions to the supported range', () => {
    const simulation = simulateNestedMultiplicationTable(0, 99)

    expect(simulation.rows).toBe(MULTIPLICATION_TABLE_LIMITS.min)
    expect(simulation.columns).toBe(MULTIPLICATION_TABLE_LIMITS.max)
    expect(simulation.cells).toHaveLength(12)
  })
})
