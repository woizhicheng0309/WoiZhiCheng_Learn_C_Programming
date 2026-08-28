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
    expect(simulation.frames[0]).toMatchObject({ activeLine: 3, activePart: 'outer-loop' })
    expect(simulation.frames[1]).toMatchObject({ activeLine: 5, activePart: 'body' })
    expect(simulation.frames.at(-1)).toMatchObject({ activeLine: 8, activePart: 'outer-exit' })
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

  it('truncates decimals and falls back from non-finite dimensions', () => {
    const truncated = simulateNestedMultiplicationTable(2.9, 3.8)
    expect([truncated.rows, truncated.columns]).toEqual([2, 3])

    const fallback = simulateNestedMultiplicationTable(Number.NaN, Number.POSITIVE_INFINITY)
    expect([fallback.rows, fallback.columns]).toEqual([
      MULTIPLICATION_TABLE_LIMITS.defaultRows,
      MULTIPLICATION_TABLE_LIMITS.defaultColumns,
    ])
  })

  it('keeps every trace frame aligned with its completed cell', () => {
    const simulation = simulateNestedMultiplicationTable(3, 2)
    const cellFrames = simulation.frames.filter((frame) => frame.phase === 'cell')

    expect(cellFrames).toHaveLength(simulation.cells.length)
    cellFrames.forEach((frame, index) => {
      expect(frame).toMatchObject({
        index: index + 1,
        completedCells: index + 1,
        activeCell: simulation.cells[index],
        outerValue: simulation.cells[index].row,
        innerValue: simulation.cells[index].column,
      })
    })
    expect(simulation.frames.filter((frame) => frame.phase === 'done')).toHaveLength(1)
  })
})
