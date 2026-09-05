import {
  ARRAY_LENGTH,
  ARRAY_LIMITS,
  DEFAULT_ARRAY_CONFIG,
  INITIAL_SCORES,
  buildArraySource,
  simulateArray,
  simulateArrayProgram,
  validateArrayConfig,
  type ArrayConfig,
  type ArrayMemoryCell,
  type ArrayPhase,
} from './arrays'

function config(overrides: Partial<ArrayConfig> = {}): ArrayConfig {
  return { ...DEFAULT_ARRAY_CONFIG, ...overrides }
}

function phasesFor(
  result: ReturnType<typeof simulateArrayProgram>,
): ArrayPhase[] {
  return result.frames.map((frame) => frame.phase)
}

describe('simulateArrayProgram', () => {
  it('traces declaration, initialization, reading, writing, and printing', () => {
    const result = simulateArrayProgram()

    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(result.initialScores).toEqual([4, 7, 2, 9, 5])
    expect(result.finalScores).toEqual([4, 7, 10, 9, 5])
    expect(result.selectedValue).toBe(2)
    expect(result.output).toEqual([2, 10])
    expect(result.outputText).toBe('2 -> 10')
    expect(phasesFor(result)).toEqual([
      'enter-main',
      'declare-array',
      'initialize-array',
      'init-index',
      'read-element',
      'write-element',
      'print',
      'return-main',
      'done',
    ])
    expect(result.frames.map((frame) => frame.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })

  it('models five contiguous int cells before and after initialization', () => {
    const result = simulateArrayProgram()
    const declaration = result.frames.find(
      (frame) => frame.phase === 'declare-array',
    )!
    const initialization = result.frames.find(
      (frame) => frame.phase === 'initialize-array',
    )!

    expect(declaration.memoryBefore.scores).toHaveLength(ARRAY_LENGTH)
    expect(declaration.scores.map((cell) => cell.index)).toEqual([0, 1, 2, 3, 4])
    expect(declaration.scores.map((cell) => cell.byteOffset)).toEqual([
      0, 4, 8, 12, 16,
    ])
    expect(declaration.scores.every((cell) => cell.declared)).toBe(true)
    expect(declaration.scores.every((cell) => !cell.initialized)).toBe(true)
    expect(declaration.scores.every((cell) => cell.value === null)).toBe(true)
    expect(initialization.scores.map((cell) => cell.value)).toEqual(
      INITIAL_SCORES,
    )
    expect(initialization.scores.every((cell) => cell.initialized)).toBe(true)
  })

  it('highlights the chosen cell and preserves the read value after writing', () => {
    const result = simulateArrayProgram({ index: 3, newValue: -4 })
    const read = result.frames.find((frame) => frame.phase === 'read-element')!
    const write = result.frames.find((frame) => frame.phase === 'write-element')!
    const print = result.frames.find((frame) => frame.phase === 'print')!

    expect(read.highlightedIndex).toBe(3)
    expect(read.accessKind).toBe('read')
    expect(read.resolvedAccessExpression).toBe('scores[3]')
    expect(read.memoryBefore.selected.initialized).toBe(false)
    expect(read.memoryAfter.selected).toMatchObject({
      declared: true,
      initialized: true,
      inScope: true,
      value: 9,
    })
    expect(read.scores[3].value).toBe(9)

    expect(write.highlightedIndex).toBe(3)
    expect(write.accessKind).toBe('write')
    expect(write.memoryBefore.scores[3].value).toBe(9)
    expect(write.memoryAfter.scores[3].value).toBe(-4)
    expect(write.memoryAfter.selected.value).toBe(9)
    expect(print.accessKind).toBe('read')
    expect(print.outputText).toBe('9 -> -4')
  })

  it.each([
    { index: ARRAY_LIMITS.index.min, expectedOld: 4 },
    { index: ARRAY_LIMITS.index.max, expectedOld: 5 },
  ])('supports the legal boundary index $index', ({ index, expectedOld }) => {
    const result = simulateArray({ index, newValue: 42 })

    expect(result.status).toBe('completed')
    expect(result.selectedValue).toBe(expectedOld)
    expect(result.finalScores[index]).toBe(42)
    expect(result.output).toEqual([expectedOld, 42])
    expect(result.finalScores).toHaveLength(ARRAY_LENGTH)
  })

  it.each([-1, ARRAY_LENGTH])(
    'strictly blocks out-of-bounds index %s before any array access',
    (index) => {
      const result = simulateArrayProgram({ index, newValue: 10 })

      expect(result.status).toBe('blocked')
      expect(result.blockReason).toBe('index-out-of-bounds')
      expect(phasesFor(result)).toEqual([
        'enter-main',
        'declare-array',
        'initialize-array',
        'init-index',
        'blocked',
      ])
      expect(result.frames.at(-1)).toMatchObject({
        activeLine: 6,
        activePart: 'array-read',
        highlightedIndex: null,
        accessKind: 'none',
        resolvedAccessExpression: null,
      })
      expect(result.frames.at(-1)?.scores.map((cell) => cell.value))
        .toEqual(INITIAL_SCORES)
      expect(result.frames.at(-1)?.memoryAfter.indexVariable.value).toBe(index)
      expect(result.finalScores).toEqual(INITIAL_SCORES)
      expect(result.output).toEqual([])
      expect(result.selectedValue).toBeNull()
      expect(result.message).toContain('合法索引只有 0 到 4')
    },
  )

  it('blocks fractional and non-finite indexes without rounding or leaking invalid source literals', () => {
    const fractional = simulateArrayProgram(config({ index: 2.5 }))
    const notANumber = simulateArrayProgram({ index: Number.NaN, newValue: 10 })
    const infinite = simulateArrayProgram({ index: Infinity, newValue: 10 })

    expect(fractional.status).toBe('blocked')
    expect(fractional.blockReason).toBe('index-integer-required')
    expect(fractional.config.index).toBe(2.5)
    expect(notANumber.blockReason).toBe('invalid-index-number')
    expect(infinite.blockReason).toBe('invalid-index-number')
    expect(notANumber.source.sourceText).not.toContain('NaN')
    expect(infinite.source.sourceText).not.toContain('Infinity')
  })

  it('rejects values that cannot be safely written to this int exercise', () => {
    const fractional = simulateArrayProgram(config({ newValue: 3.5 }))
    const outOfRange = simulateArrayProgram({ index: 2, newValue: 101 })
    const notANumber = simulateArrayProgram({ index: 2, newValue: Number.NaN })

    expect(fractional.blockReason).toBe('new-value-integer-required')
    expect(fractional.frames.at(-1)).toMatchObject({
      activeLine: 7,
      activePart: 'array-write',
    })
    expect(outOfRange.blockReason).toBe('new-value-out-of-range')
    expect(notANumber.blockReason).toBe('invalid-new-value-number')
    expect(notANumber.source.sourceText).not.toContain('NaN')
    expect(fractional.finalScores).toEqual(INITIAL_SCORES)
    expect(outOfRange.output).toEqual([])
  })

  it('keeps input, constants, results, and every frame snapshot independent', () => {
    const callerConfig: ArrayConfig = { index: 1, newValue: 88 }
    const result = simulateArrayProgram(callerConfig)
    const declaration = result.frames.find(
      (frame) => frame.phase === 'declare-array',
    )!
    const read = result.frames.find((frame) => frame.phase === 'read-element')!
    const write = result.frames.find((frame) => frame.phase === 'write-element')!

    callerConfig.index = 4
    callerConfig.newValue = 99
    ;(read.scores[1] as ArrayMemoryCell).value = 777
    ;(write.memoryAfter.scores[1] as ArrayMemoryCell).value = 666
    ;(result.finalScores as number[])[1] = 555

    expect(result.config).toEqual({ index: 1, newValue: 88 })
    expect(INITIAL_SCORES).toEqual([4, 7, 2, 9, 5])
    expect(declaration.scores[1].value).toBeNull()
    expect(read.memoryAfter.scores[1].value).toBe(7)
    expect(write.memoryBefore.scores[1].value).toBe(7)
    expect(result.frames.at(-1)?.scores[1].value).toBe(88)
    expect(result.output).toEqual([7, 88])
  })

  it('aligns every completed frame with source lines and semantic parts', () => {
    const result = simulateArrayProgram()

    for (const frame of result.frames) {
      expect(frame.activeLine).toBe(result.source.lineByPhase[frame.phase])
      expect(frame.activePart).toBe(result.source.partByPhase[frame.phase])
      expect(
        result.source.lines.find((line) => line.lineNumber === frame.activeLine),
      ).toBeDefined()
      expect(frame.explanation.length).toBeGreaterThan(0)
    }
  })
})

describe('buildArraySource and validation', () => {
  it('generates a complete fixed-length C array program', () => {
    const source = buildArraySource()

    expect(source.sourceText).toBe([
      '#include <stdio.h>',
      '',
      'int main(void) {',
      '  int scores[5] = {4, 7, 2, 9, 5};',
      '  int index = 2;',
      '  int selected = scores[index];',
      '  scores[index] = 10;',
      '  printf("%d -> %d\\n", selected, scores[index]);',
      '  return 0;',
      '}',
    ].join('\n'))
    expect(source.arrayLength).toBe(5)
    expect(source.accessExpression).toBe('scores[index]')
    expect(source.lineByPhase['read-element']).toBe(6)
    expect(source.partByPhase['write-element']).toBe('array-write')
    expect(source.lines.find((line) => line.lineNumber === 4)?.phases).toEqual([
      'declare-array',
      'initialize-array',
    ])
  })

  it('reports every applicable issue with field-specific context', () => {
    expect(validateArrayConfig()).toEqual([])
    expect(validateArrayConfig({ index: 5.5, newValue: 100.5 })).toEqual([
      expect.objectContaining({
        code: 'index-integer-required',
        field: 'index',
      }),
      expect.objectContaining({ code: 'index-out-of-bounds', field: 'index' }),
      expect.objectContaining({
        code: 'new-value-integer-required',
        field: 'newValue',
      }),
      expect.objectContaining({
        code: 'new-value-out-of-range',
        field: 'newValue',
      }),
    ])
  })
})
