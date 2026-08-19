import {
  DEFAULT_LOOP_CONFIG,
  LOOP_LIMITS,
  buildForLoopSource,
  simulateForLoop,
  validateLoopConfig,
  type LoopConfig,
  type LoopPhase,
} from './index'

function config(overrides: Partial<LoopConfig> = {}): LoopConfig {
  return { ...DEFAULT_LOOP_CONFIG, ...overrides }
}

function phasesFor(result: ReturnType<typeof simulateForLoop>): LoopPhase[] {
  return result.frames.map((frame) => frame.phase)
}

describe('simulateForLoop', () => {
  it('uses the beginner-friendly default and emits one synchronized trace', () => {
    const result = simulateForLoop()

    expect(result.output).toEqual([0, 1, 2, 3, 4])
    expect(result.iterations).toBe(5)
    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(phasesFor(result)).toEqual([
      'init',
      'condition',
      'body',
      'increment',
      'condition',
      'body',
      'increment',
      'condition',
      'body',
      'increment',
      'condition',
      'body',
      'increment',
      'condition',
      'body',
      'increment',
      'condition',
      'done',
    ])
    expect(result.frames.filter((frame) => frame.phase === 'body')).toHaveLength(5)
    expect(result.frames.at(-1)?.output).toEqual(result.output)
  })

  it('simulates a descending loop with a negative step', () => {
    const result = simulateForLoop({
      start: 5,
      end: 0,
      comparator: '>',
      step: -1,
    })

    expect(result.output).toEqual([5, 4, 3, 2, 1])
    expect(result.status).toBe('completed')
  })

  it('supports a step of two and an inclusive <= boundary', () => {
    const result = simulateForLoop({
      start: 2,
      end: 10,
      comparator: '<=',
      step: 2,
    })

    expect(result.output).toEqual([2, 4, 6, 8, 10])
    expect(result.iterations).toBe(5)
  })

  it('supports negative values', () => {
    const result = simulateForLoop({
      start: -3,
      end: 0,
      comparator: '<',
      step: 1,
    })

    expect(result.output).toEqual([-3, -2, -1])
  })

  it('supports an inclusive >= boundary', () => {
    const result = simulateForLoop({
      start: 0,
      end: -2,
      comparator: '>=',
      step: -1,
    })

    expect(result.output).toEqual([0, -1, -2])
  })

  it('treats an initially false condition as a legal zero-iteration loop', () => {
    const result = simulateForLoop({
      start: 5,
      end: 0,
      comparator: '<',
      step: 0,
    })

    expect(result.output).toEqual([])
    expect(result.iterations).toBe(0)
    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(phasesFor(result)).toEqual(['init', 'condition', 'done'])
  })

  it('blocks step = 0 when the condition is true', () => {
    const result = simulateForLoop(config({ step: 0 }))

    expect(result.output).toEqual([])
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('step-zero')
    expect(phasesFor(result)).toEqual(['init', 'condition', 'blocked'])
  })

  it.each([
    config({ step: -1 }),
    { start: 5, end: 0, comparator: '>' as const, step: 1 },
  ])('blocks a step that moves away from the stopping condition', (loopConfig) => {
    const result = simulateForLoop(loopConfig)

    expect(result.output).toEqual([])
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('wrong-direction')
    expect(phasesFor(result)).toEqual(['init', 'condition', 'blocked'])
  })

  it('stops at the hard iteration limit', () => {
    const result = simulateForLoop(config({ step: Number.MIN_VALUE }))

    expect(result.iterations).toBe(LOOP_LIMITS.maxIterations)
    expect(result.output).toHaveLength(LOOP_LIMITS.maxIterations)
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('iteration-limit')
    expect(result.frames.at(-1)?.phase).toBe('blocked')
  })

  it('blocks values outside the teaching controls before execution', () => {
    const loopConfig = config({ start: 21, end: -21, step: 6 })
    const issues = validateLoopConfig(loopConfig)
    const result = simulateForLoop(loopConfig)

    expect(issues.map((issue) => issue.code)).toEqual([
      'start-out-of-range',
      'end-out-of-range',
      'step-out-of-range',
    ])
    expect(result.status).toBe('blocked')
    expect(result.output).toEqual([])
  })
})

describe('buildForLoopSource', () => {
  it('provides C code plus phase-to-line and phase-to-segment mappings', () => {
    const source = buildForLoopSource(DEFAULT_LOOP_CONFIG)

    expect(source.lines.find((line) => line.lineNumber === 4)?.code).toBe(
      '  for (int i = 0; i < 5; i += 1) {',
    )
    expect(source.lines.find((line) => line.lineNumber === 5)?.code).toBe(
      '    printf("%d ", i);',
    )
    expect(source.lineByPhase.condition).toBe(4)
    expect(source.lineByPhase.body).toBe(5)
    expect(source.partByPhase.init).toBe('initializer')
    expect(source.partByPhase.increment).toBe('increment')
  })

  it('uses valid C syntax for a negative step', () => {
    const source = buildForLoopSource({
      start: 5,
      end: 0,
      comparator: '>',
      step: -1,
    })

    expect(source.lines[3].code).toContain('i -= 1')
  })
})
