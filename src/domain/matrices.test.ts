import { DEFAULT_MATRIX_CONFIG, MATRIX_VALUES, simulateMatrixProgram, type MatrixConfig } from './matrices'

describe('matrix indexing and nested traversal', () => {
  it.each([
    { mode: 'row-first' as const, values: [1, 2, 3, 4, 5, 6], offsets: [0, 1, 2, 3, 4, 5] },
    { mode: 'column-first' as const, values: [1, 4, 2, 5, 3, 6], offsets: [0, 3, 1, 4, 2, 5] },
  ])('traverses $mode without changing physical storage', ({ mode, values, offsets }) => {
    const result = simulateMatrixProgram({ ...DEFAULT_MATRIX_CONFIG, mode })
    expect(result).toMatchObject({ status: 'completed', output: values, selected: 6, sum: 21 })
    expect(result.visits.map(visit => visit.offset)).toEqual(offsets)
    expect(result.frames.filter(frame => frame.phase === 'accumulate')).toHaveLength(6)
    expect(result.frames.filter(frame => frame.phase === 'print-value')).toHaveLength(6)
    expect(result.frames.filter(frame => frame.grid !== null).every(frame => JSON.stringify(frame.grid) === JSON.stringify(MATRIX_VALUES))).toBe(true)
    const summary = result.frames.find(frame => frame.phase === 'print-sum')!
    expect(summary).toMatchObject({ rowInScope: false, columnInScope: false, mainInScope: true, summary: 'sum = 21' })
    expect(result.frames.at(-1)?.mainInScope).toBe(false)
    result.frames.forEach(frame => expect(result.source.lines[frame.activeLine - 1]).toBeDefined())
  })
  it('resets the inner variable on each outer iteration and keeps each loop in scope only until it ends', () => {
    const result = simulateMatrixProgram()
    expect(result.frames.filter(frame => frame.phase === 'initialize-inner').map(frame => [frame.row, frame.column]))
      .toEqual([[0, 0], [1, 0]])
    expect(result.frames.filter(frame => frame.phase === 'increment-outer').every(frame => frame.rowInScope && !frame.columnInScope)).toBe(true)
    const columnFirst = simulateMatrixProgram({ ...DEFAULT_MATRIX_CONFIG, mode: 'column-first' })
    expect(columnFirst.frames.filter(frame => frame.phase === 'initialize-inner').map(frame => [frame.row, frame.column]))
      .toEqual([[0, 0], [0, 1], [0, 2]])
    expect(columnFirst.frames.filter(frame => frame.phase === 'increment-outer').every(frame => !frame.rowInScope && frame.columnInScope)).toBe(true)
  })
  it('reads every valid target with row * columnCount + col as the element offset', () => {
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const result = simulateMatrixProgram({ ...DEFAULT_MATRIX_CONFIG, targetRow: row, targetColumn: col })
      expect(result.selected).toBe(MATRIX_VALUES[row][col])
      const read = result.frames.find(frame => frame.phase === 'read-selected')!
      expect(read).toMatchObject({ activeLine: 5, activeCell: { row, column: col, offset: row * 3 + col }, output: [], selectedOutput: null })
      expect(result.frames[read.index + 1].selectedOutput).toBe(`selected = ${MATRIX_VALUES[row][col]}`)
    }
  })
  it.each([
    { targetRow: -1 }, { targetRow: 2 }, { targetRow: 0.5 }, { targetColumn: -1 },
    { targetColumn: 3 }, { targetColumn: NaN }, { targetColumn: Infinity },
  ])('stops before an illegal read for %j', overrides => {
    const result = simulateMatrixProgram({ ...DEFAULT_MATRIX_CONFIG, ...overrides })
    expect(result).toMatchObject({ status: 'blocked', output: [], selected: null, sum: null })
    expect(result.frames.map(frame => frame.phase)).toEqual(['enter-main', 'initialize-grid', 'blocked'])
    expect(result.frames.at(-1)).toMatchObject({ activeLine: 5, activeCell: null, grid: MATRIX_VALUES })
    expect(result.source.sourceText).not.toMatch(/NaN|Infinity/)
  })
  it('rejects invalid modes before execution and sanitizes runtime source input', () => {
    const result = simulateMatrixProgram({ ...DEFAULT_MATRIX_CONFIG, mode: 'unsafe();' as MatrixConfig['mode'] })
    expect(result.status).toBe('blocked')
    expect(result.frames.at(-1)?.grid).toBeNull()
    expect(result.source.sourceText).not.toContain('unsafe();')
  })
  it('copies config, grid, visits and output snapshots independently', () => {
    const config = { ...DEFAULT_MATRIX_CONFIG }
    const result = simulateMatrixProgram(config)
    config.targetRow = 0
    expect(result.config.targetRow).toBe(1)
    const first = result.frames.find(frame => frame.phase === 'accumulate')!
    const next = result.frames[first.index + 1]
    expect(first.grid).not.toBe(next.grid)
    expect(first.grid![0]).not.toBe(next.grid![0])
    expect(first.visits[0]).not.toBe(next.visits[0])
    expect(first.activeCell).not.toBe(first.visits[0])
    expect(first.output).toEqual([])
    expect(next.output).toEqual([1])
    expect(result.visits).not.toBe(result.frames.at(-1)?.visits)
  })
})
