import {
  DEFAULT_VARIABLE_CONFIG,
  buildVariableSource,
  evaluateVariableExpression,
  simulateVariableProgram,
  validateVariableConfig,
  type VariableConfig,
  type VariablePhase,
} from './variables'

function config(overrides: Partial<VariableConfig> = {}): VariableConfig {
  return { ...DEFAULT_VARIABLE_CONFIG, ...overrides }
}

function phasesFor(
  result: ReturnType<typeof simulateVariableProgram>,
): VariablePhase[] {
  return result.frames.map((frame) => frame.phase)
}

describe('simulateVariableProgram', () => {
  it('builds the complete default trace from main through normal completion', () => {
    const result = simulateVariableProgram()

    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(result.output).toEqual([7])
    expect(result.resultValue).toBe(7)
    expect(phasesFor(result)).toEqual([
      'main',
      'init-x',
      'init-y',
      'declare-result',
      'evaluate',
      'assign',
      'print',
      'return',
      'done',
    ])
    expect(result.frames.map((frame) => frame.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })

  it('records memory before and after each declaration and assignment', () => {
    const result = simulateVariableProgram()
    const initX = result.frames.find((frame) => frame.phase === 'init-x')!
    const declaration = result.frames.find(
      (frame) => frame.phase === 'declare-result',
    )!
    const assignment = result.frames.find((frame) => frame.phase === 'assign')!

    expect(initX.memoryBefore.x).toMatchObject({
      declared: false,
      initialized: false,
      value: null,
    })
    expect(initX.memoryAfter.x).toMatchObject({
      declared: true,
      initialized: true,
      valueType: 'int',
      value: 5,
    })
    expect(declaration.memoryAfter.result).toMatchObject({
      declared: true,
      initialized: false,
      valueType: 'int',
      value: null,
    })
    expect(assignment.memoryBefore.result.value).toBeNull()
    expect(assignment.memoryAfter.result).toMatchObject({
      declared: true,
      initialized: true,
      value: 7,
    })
    expect(result.frames.find((frame) => frame.phase === 'print')?.output).toEqual([
      7,
    ])
  })

  it.each([
    ['+', 6, 2, 8],
    ['-', 6, 2, 4],
    ['*', 6, 2, 12],
    ['/', 6, 2, 3],
  ] as const)(
    'supports double arithmetic with %s',
    (operator, x, y, expected) => {
      const result = simulateVariableProgram({
        valueType: 'double',
        x,
        y,
        operator,
      })

      expect(result.status).toBe('completed')
      expect(result.output).toEqual([expected])
    },
  )

  it('keeps a fractional result for double division', () => {
    const result = simulateVariableProgram({
      valueType: 'double',
      x: 5,
      y: 2,
      operator: '/',
    })

    expect(result.output).toEqual([2.5])
    expect(result.frames.find((frame) => frame.phase === 'evaluate')).toMatchObject({
      resolvedExpression: '5 / 2',
      evaluatedValue: 2.5,
      activePart: 'expression',
    })
  })

  it.each([
    { x: 5, y: 2, operator: '/' as const, expected: 2 },
    { x: -5, y: 2, operator: '/' as const, expected: -2 },
    { x: 5, y: -2, operator: '/' as const, expected: -2 },
    { x: -5, y: 2, operator: '%' as const, expected: -1 },
  ])(
    'matches C int arithmetic for $x $operator $y',
    ({ x, y, operator, expected }) => {
      const variableConfig = config({ x, y, operator })

      expect(evaluateVariableExpression(variableConfig)).toBe(expected)
      expect(simulateVariableProgram(variableConfig).output).toEqual([expected])
    },
  )

  it('blocks division by zero after showing initialized memory', () => {
    const result = simulateVariableProgram(config({ x: 8, y: 0, operator: '/' }))

    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('division-by-zero')
    expect(result.output).toEqual([])
    expect(result.resultValue).toBeNull()
    expect(phasesFor(result)).toEqual([
      'main',
      'init-x',
      'init-y',
      'declare-result',
      'blocked',
    ])
    expect(result.frames.at(-1)?.memoryAfter.y.value).toBe(0)
    expect(result.frames.at(-1)?.memoryAfter.result.initialized).toBe(false)
  })

  it('blocks double modulo with a specific beginner-facing reason', () => {
    const result = simulateVariableProgram({
      valueType: 'double',
      x: 5,
      y: 2,
      operator: '%',
    })

    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('double-modulo')
    expect(result.message).toContain('% 只能用於整數')
  })

  it('blocks non-finite and out-of-range inputs before initialization', () => {
    const nonFinite = simulateVariableProgram(config({ x: Number.NaN }))
    const outOfRange = simulateVariableProgram(config({ x: 21, y: -21 }))

    expect(nonFinite.blockReason).toBe('invalid-number')
    expect(phasesFor(nonFinite)).toEqual(['main', 'blocked'])
    expect(outOfRange.blockReason).toBe('x-out-of-range')
    expect(validateVariableConfig(config({ x: 21, y: -21 })).map(
      (issue) => issue.code,
    )).toEqual(['x-out-of-range', 'y-out-of-range'])
  })

  it('enforces integer operands and the teaching control half-step', () => {
    expect(
      simulateVariableProgram(config({ x: 1.5 })).blockReason,
    ).toBe('int-requires-integer')
    expect(
      simulateVariableProgram({
        valueType: 'double',
        x: 0.25,
        y: 1,
        operator: '+',
      }).blockReason,
    ).toBe('double-requires-half-step')
  })

  it('allows results to exceed the operand controls', () => {
    const result = simulateVariableProgram(config({ x: 20, y: 20, operator: '*' }))

    expect(result.status).toBe('completed')
    expect(result.output).toEqual([400])
  })
})

describe('buildVariableSource', () => {
  it('generates int code and precise phase-to-source-part mappings', () => {
    const source = buildVariableSource()

    expect(source.lines.map((line) => line.code)).toContain('  int x = 5;')
    expect(source.lines.map((line) => line.code)).toContain(
      '  result = x + y;',
    )
    expect(source.lines.map((line) => line.code)).toContain(
      '  printf("%d\\n", result);',
    )
    expect(source.lineByPhase.evaluate).toBe(7)
    expect(source.lineByPhase.assign).toBe(7)
    expect(source.partByPhase.evaluate).toBe('expression')
    expect(source.partByPhase.assign).toBe('assignment')
  })

  it('generates explicit double literals and a matching printf format', () => {
    const source = buildVariableSource({
      valueType: 'double',
      x: 5,
      y: 2.5,
      operator: '/',
    })

    expect(source.lines.map((line) => line.code)).toContain('  double x = 5.0;')
    expect(source.lines.map((line) => line.code)).toContain('  double y = 2.5;')
    expect(source.lines.map((line) => line.code)).toContain(
      '  printf("%g\\n", result);',
    )
  })
})
