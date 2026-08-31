import {
  DEFAULT_FUNCTION_CONFIG,
  FUNCTION_LIMITS,
  buildFunctionSource,
  calculateAddResult,
  simulateFunction,
  simulateFunctionProgram,
  validateFunctionConfig,
  type FunctionConfig,
  type FunctionPhase,
  type FunctionVariableState,
} from './functions'

function config(overrides: Partial<FunctionConfig> = {}): FunctionConfig {
  return { ...DEFAULT_FUNCTION_CONFIG, ...overrides }
}

function phasesFor(
  result: ReturnType<typeof simulateFunctionProgram>,
): FunctionPhase[] {
  return result.frames.map((frame) => frame.phase)
}

describe('simulateFunctionProgram', () => {
  it('traces the complete call from main into add and back to main', () => {
    const result = simulateFunctionProgram()

    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(result.returnValue).toBe(7)
    expect(result.answerValue).toBe(7)
    expect(result.output).toEqual([7])
    expect(phasesFor(result)).toEqual([
      'enter-main',
      'init-x',
      'init-y',
      'call-add',
      'bind-parameters',
      'declare-result',
      'calculate-result',
      'return-add',
      'assign-answer',
      'print',
      'return-main',
      'done',
    ])
    expect(result.frames.map((frame) => frame.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
  })

  it('shows main and add activation, suspension, return, and local scope', () => {
    const result = simulateFunctionProgram()
    const call = result.frames.find((frame) => frame.phase === 'call-add')!
    const bindParameters = result.frames.find(
      (frame) => frame.phase === 'bind-parameters',
    )!
    const returnAdd = result.frames.find((frame) => frame.phase === 'return-add')!
    const assignAnswer = result.frames.find(
      (frame) => frame.phase === 'assign-answer',
    )!
    const done = result.frames.at(-1)!

    expect(call.activeFunction).toBe('main')
    expect(call.mainFrame).toMatchObject({ status: 'active', active: true })
    expect(call.mainFrame.answer).toMatchObject({
      declared: true,
      initialized: false,
      inScope: true,
      value: null,
    })

    expect(bindParameters.activeFunction).toBe('add')
    expect(bindParameters.mainFrame).toMatchObject({
      status: 'suspended',
      active: false,
    })
    expect(bindParameters.addFrame).toMatchObject({
      status: 'active',
      active: true,
    })
    expect(bindParameters.memoryBefore.add.a.declared).toBe(false)
    expect(bindParameters.memoryBefore.add.b.declared).toBe(false)
    expect(bindParameters.addFrame.a).toMatchObject({
      declared: true,
      initialized: true,
      inScope: true,
      value: 4,
    })
    expect(bindParameters.addFrame.b).toMatchObject({
      declared: true,
      initialized: true,
      inScope: true,
      value: 3,
    })
    expect(bindParameters.explanation).toContain('函式本體開始執行前')

    expect(returnAdd.activeFunction).toBe('add')
    expect(returnAdd.addReturnValue).toBe(7)
    expect(returnAdd.addFrame.result.value).toBe(7)

    expect(assignAnswer.activeFunction).toBe('main')
    expect(assignAnswer.addFrame).toMatchObject({
      status: 'returned',
      active: false,
    })
    expect(assignAnswer.addFrame.a).toMatchObject({ value: 4, inScope: false })
    expect(assignAnswer.addFrame.b).toMatchObject({ value: 3, inScope: false })
    expect(assignAnswer.addFrame.result).toMatchObject({
      value: 7,
      inScope: false,
    })
    expect(assignAnswer.mainFrame.answer).toMatchObject({
      initialized: true,
      inScope: true,
      value: 7,
    })

    expect(done.activeFunction).toBeNull()
    expect(done.mainFrame.status).toBe('returned')
    expect(done.mainFrame.answer).toMatchObject({ value: 7, inScope: false })
  })

  it('copies x and y into parameters before calculating the local result', () => {
    const result = simulateFunctionProgram({ x: -6, y: 11 })
    const bindParameters = result.frames.find(
      (frame) => frame.phase === 'bind-parameters',
    )!
    const declaration = result.frames.find(
      (frame) => frame.phase === 'declare-result',
    )!
    const calculation = result.frames.find(
      (frame) => frame.phase === 'calculate-result',
    )!

    expect(bindParameters.addFrame.a.value).toBe(-6)
    expect(bindParameters.addFrame.b.value).toBe(11)
    expect(bindParameters.resolvedCall).toBe('add(-6, 11)')
    expect(bindParameters.resolvedAddExpression).toBe('-6 + 11')
    expect(declaration.addFrame.result).toMatchObject({
      declared: true,
      initialized: false,
      inScope: true,
      value: null,
    })
    expect(calculation.addFrame.result).toMatchObject({
      declared: true,
      initialized: true,
      inScope: true,
      value: 5,
    })
    expect(result.output).toEqual([5])
  })

  it.each([
    { x: FUNCTION_LIMITS.x.min, y: FUNCTION_LIMITS.y.max, expected: 0 },
    { x: 0, y: 0, expected: 0 },
    { x: FUNCTION_LIMITS.x.max, y: FUNCTION_LIMITS.y.max, expected: 40 },
    { x: FUNCTION_LIMITS.x.min, y: FUNCTION_LIMITS.y.min, expected: -40 },
  ])('supports legal boundary, zero, and signed values: $x + $y', ({ x, y, expected }) => {
    const result = simulateFunction({ x, y })

    expect(result.status).toBe('completed')
    expect(result.returnValue).toBe(expected)
    expect(result.output).toEqual([expected])
    expect(calculateAddResult(x, y)).toBe(expected)
  })

  it('keeps every nested frame snapshot independent from later frames and caller input', () => {
    const callerConfig: FunctionConfig = { x: 8, y: 1 }
    const result = simulateFunctionProgram(callerConfig)
    const initX = result.frames.find((frame) => frame.phase === 'init-x')!
    const bindParameters = result.frames.find(
      (frame) => frame.phase === 'bind-parameters',
    )!
    const declaration = result.frames.find(
      (frame) => frame.phase === 'declare-result',
    )!

    callerConfig.x = 20
    callerConfig.y = 20
    ;(bindParameters.addFrame.a as FunctionVariableState).value = 999
    ;(bindParameters.memoryAfter.add.b as FunctionVariableState).value = 999

    expect(result.config).toEqual({ x: 8, y: 1 })
    expect(initX.memoryBefore.main.x.value).toBeNull()
    expect(initX.memoryAfter.main.x.value).toBe(8)
    expect(bindParameters.memoryAfter.add.a.value).toBe(8)
    expect(bindParameters.addFrame.b.value).toBe(1)
    expect(declaration.addFrame.a.value).toBe(8)
    expect(declaration.addFrame.b.value).toBe(1)
    expect(result.returnValue).toBe(9)
  })

  it('aligns every completed frame with a source line and semantic part', () => {
    const result = simulateFunctionProgram()

    for (const frame of result.frames) {
      expect(frame.activeLine).toBe(result.source.lineByPhase[frame.phase])
      expect(frame.activePart).toBe(result.source.partByPhase[frame.phase])
      expect(
        result.source.lines.find((line) => line.lineNumber === frame.activeLine),
      ).toBeDefined()
      expect(frame.explanation.length).toBeGreaterThan(0)
    }
  })

  it('blocks non-finite input explicitly without initializing or printing', () => {
    const result = simulateFunctionProgram({ x: Number.NaN, y: Infinity })

    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('invalid-number')
    expect(result.validationIssues).toEqual([
      expect.objectContaining({ code: 'invalid-number', field: 'x' }),
      expect.objectContaining({ code: 'invalid-number', field: 'y' }),
    ])
    expect(phasesFor(result)).toEqual(['enter-main', 'blocked'])
    expect(result.frames.at(-1)).toMatchObject({
      activeLine: 9,
      activePart: 'x-initializer',
      resolvedCall: null,
    })
    expect(result.frames.at(-1)?.mainFrame.x.initialized).toBe(false)
    expect(result.output).toEqual([])
    expect(result.returnValue).toBeNull()
    expect(result.answerValue).toBeNull()
    expect(result.source.sourceText).not.toContain('NaN')
    expect(result.source.sourceText).not.toContain('Infinity')
    expect(result.message).toContain('有限整數')
  })

  it('blocks fractional and out-of-range config rather than truncating it', () => {
    const fractional = simulateFunctionProgram(config({ x: 1.5 }))
    const outOfRange = simulateFunctionProgram({ x: 21, y: -21 })

    expect(fractional.status).toBe('blocked')
    expect(fractional.blockReason).toBe('integer-required')
    expect(fractional.config.x).toBe(1.5)
    expect(fractional.output).toEqual([])

    expect(outOfRange.status).toBe('blocked')
    expect(outOfRange.blockReason).toBe('x-out-of-range')
    expect(outOfRange.validationIssues.map((issue) => issue.code)).toEqual([
      'x-out-of-range',
      'y-out-of-range',
    ])
  })
})

describe('buildFunctionSource and validation', () => {
  it('generates the complete add and main C program', () => {
    const source = buildFunctionSource()

    expect(source.sourceText).toBe([
      '#include <stdio.h>',
      '',
      'int add(int a, int b) {',
      '  int result = a + b;',
      '  return result;',
      '}',
      '',
      'int main(void) {',
      '  int x = 4;',
      '  int y = 3;',
      '  int answer = add(x, y);',
      '  printf("%d\\n", answer);',
      '  return 0;',
      '}',
    ].join('\n'))
    expect(source.lines.map((line) => line.lineNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ])
    expect(source.lineByPhase['bind-parameters']).toBe(3)
    expect(source.partByPhase['bind-parameters']).toBe('parameters')
    expect(source.lines.find((line) => line.lineNumber === 3)?.phases).toEqual([
      'bind-parameters',
    ])
    expect(source.lineByPhase['call-add']).toBe(11)
    expect(source.partByPhase['assign-answer']).toBe('answer-assignment')
  })

  it('reports all validation issues with field-specific context', () => {
    expect(validateFunctionConfig()).toEqual([])
    expect(validateFunctionConfig({ x: 20.5, y: -21 })).toEqual([
      expect.objectContaining({ code: 'x-out-of-range', field: 'x' }),
      expect.objectContaining({ code: 'integer-required', field: 'x' }),
      expect.objectContaining({ code: 'y-out-of-range', field: 'y' }),
    ])
  })
})
