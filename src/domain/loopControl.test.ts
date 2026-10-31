import {
  DEFAULT_LOOP_CONTROL_CONFIG,
  LOOP_CONTROL_LIMITS,
  buildLoopControlSource,
  simulateLoopControlProgram,
  validateLoopControlConfig,
  type LoopControlConfig,
  type LoopControlFrame,
  type LoopControlMode,
} from './loopControl'

const config = (overrides: Partial<LoopControlConfig> = {}): LoopControlConfig => ({
  ...DEFAULT_LOOP_CONTROL_CONFIG, ...overrides,
})

describe('break and continue execution', () => {
  it('continues through for update while skipping only the matching body remainder', () => {
    const result = simulateLoopControlProgram()
    expect(result).toMatchObject({
      status: 'completed', blockReason: null, output: [1, 2, 4, 5],
      sum: 12, iterations: 5, summary: 'sum = 12', outputText: '1\n2\n4\n5\nsum = 12',
    })
    const skipIndex = result.frames.findIndex((frame) => frame.phase === 'continue')
    expect(result.frames.slice(skipIndex, skipIndex + 3)).toMatchObject([
      { phase: 'continue', activeLine: 7, memory: { i: 3, sum: 3 }, iteration: 3, output: [1, 2] },
      { phase: 'increment', activeLine: 5, memory: { i: 4, sum: 3 }, iteration: 3, output: [1, 2] },
      { phase: 'condition', activeLine: 5, conditionResult: true, memory: { i: 4 } },
    ])
    expect(result.frames.filter((frame) => frame.phase === 'accumulate').map((frame) => frame.memory.i))
      .toEqual([1, 2, 4, 5])
    expect(result.frames.filter((frame) => frame.phase === 'condition').map((frame) => frame.conditionResult))
      .toEqual([true, true, true, true, true, false])
  })

  it('breaks directly to the summary without incrementing or retesting', () => {
    const result = simulateLoopControlProgram(config({ mode: 'break' }))
    expect(result).toMatchObject({ output: [1, 2], sum: 3, iterations: 3, summary: 'sum = 3' })
    const exitIndex = result.frames.findIndex((frame) => frame.phase === 'break')
    expect(result.frames.slice(exitIndex).map((frame) => frame.phase))
      .toEqual(['break', 'print-summary', 'return-main', 'done'])
    expect(result.frames[exitIndex]).toMatchObject({ memory: { i: 3, iInScope: true, sum: 3 } })
    expect(result.frames[exitIndex + 1]).toMatchObject({
      activeLine: 12, memory: { i: 3, iInScope: false, sum: 3, inScope: true }, summary: 'sum = 3',
    })
  })

  it.each([
    { mode: 'break' as const, trigger: 1, output: [], sum: 0, iterations: 1 },
    { mode: 'continue' as const, trigger: 1, output: [2, 3, 4, 5], sum: 14, iterations: 5 },
    { mode: 'break' as const, trigger: 5, output: [1, 2, 3, 4], sum: 10, iterations: 5 },
    { mode: 'continue' as const, trigger: 5, output: [1, 2, 3, 4], sum: 10, iterations: 5 },
    { mode: 'break' as const, trigger: 8, output: [1, 2, 3, 4, 5], sum: 15, iterations: 5 },
    { mode: 'continue' as const, trigger: 8, output: [1, 2, 3, 4, 5], sum: 15, iterations: 5 },
  ])('handles $mode with trigger $trigger', ({ mode, trigger, output, sum, iterations }) => {
    const result = simulateLoopControlProgram(config({ mode, trigger }))
    expect(result).toMatchObject({ status: 'completed', output, sum, iterations })
    expect(result.frames.filter((frame) => frame.phase === mode)).toHaveLength(trigger === 8 ? 0 : 1)
  })

  it('matches the independent arithmetic result for every permitted setting', () => {
    for (const mode of ['break', 'continue'] as const) {
      for (let end = 1; end <= LOOP_CONTROL_LIMITS.end.max; end += 1) {
        for (let trigger = 1; trigger <= LOOP_CONTROL_LIMITS.trigger.max; trigger += 1) {
          const processed = Array.from({ length: end }, (_, index) => index + 1)
            .filter((value) => mode === 'break' ? value < trigger : value !== trigger)
          const result = simulateLoopControlProgram({ mode, end, trigger })
          expect(result.output).toEqual(processed)
          expect(result.sum).toBe(processed.reduce((sum, value) => sum + value, 0))
          expect(result.iterations).toBe(mode === 'break' ? Math.min(end, trigger) : end)
          expect(result.frames.at(-1)?.memory.iInScope).toBe(false)
        }
      }
    }
  })
})

describe('source lines, scope and independent snapshots', () => {
  it.each(['break', 'continue'] as const)('aligns %s frames with actual C source', (mode) => {
    const result = simulateLoopControlProgram(config({ mode }))
    expect(result.source.sourceText).toBe([
      '#include <stdio.h>', '', 'int main(void) {', '  int sum = 0;',
      '  for (int i = 1; i <= 5; i++) {', '    if (i == 3) {',
      `      ${mode};`, '    }', '    sum += i;', '    printf("%d\\n", i);',
      '  }', '  printf("sum = %d\\n", sum);', '  return 0;', '}',
    ].join('\n'))
    result.frames.forEach((frame, index) => {
      expect(frame.index).toBe(index)
      expect(frame.activePart).toBe(`line-${frame.activeLine}`)
      expect(result.source.lines[frame.activeLine - 1].phases).toContain(frame.phase)
      if (frame.phase !== 'condition') expect(frame.conditionResult).toBeNull()
      if (frame.phase !== 'branch') expect(frame.branchResult).toBeNull()
    })
    expect(result.frames.find((frame) => frame.phase === 'init-sum')).toMatchObject({
      memory: { i: null, iInScope: false, sum: 0, inScope: true },
    })
    expect(result.frames.find((frame) => frame.phase === 'initialize')).toMatchObject({
      memory: { i: 1, iInScope: true, sum: 0 }, iteration: 0,
    })
    expect(result.frames.find((frame) => frame.phase === 'print-summary')).toMatchObject({
      memory: { iInScope: false, inScope: true },
    })
    expect(result.frames.at(-1)).toMatchObject({ memory: { iInScope: false, inScope: false } })
  })

  it('only reveals summary after printf and maintains branch-entry counts', () => {
    const result = simulateLoopControlProgram()
    const summaryIndex = result.frames.findIndex((frame) => frame.phase === 'print-summary')
    expect(result.frames.slice(0, summaryIndex).every((frame) => frame.summary === null)).toBe(true)
    expect(result.frames.filter((frame) => frame.phase === 'branch').map((frame) => frame.iteration))
      .toEqual([1, 2, 3, 4, 5])
    expect(result.frames.filter((frame) => frame.phase === 'branch').map((frame) => frame.branchResult))
      .toEqual([false, false, true, false, false])
    expect(result.frames.filter((frame) => frame.phase === 'condition').at(-1))
      .toMatchObject({ conditionResult: false, conditionExpression: '6 <= 5', iteration: 5 })
  })

  it('copies caller config and every frame memory/output independently', () => {
    const input = config()
    const result = simulateLoopControlProgram(input)
    input.mode = 'break'
    input.end = 8
    expect(result.config).toEqual(DEFAULT_LOOP_CONTROL_CONFIG)
    const firstPrint = result.frames.find((frame) => frame.phase === 'print-value')!
    const nextFrame = result.frames[firstPrint.index + 1]
    expect(firstPrint.memory).not.toBe(nextFrame.memory)
    expect(firstPrint.output).not.toBe(nextFrame.output)
    expect(result.output).not.toBe(result.frames.at(-1)?.output)
    ;(firstPrint.memory as LoopControlFrame['memory'] & { sum: number }).sum = 99
    ;(firstPrint.output as number[]).push(99)
    expect(nextFrame.memory.sum).toBe(1)
    expect(nextFrame.output).toEqual([1])
    expect(result.sum).toBe(12)
    expect(result.output).toEqual([1, 2, 4, 5])
  })
})

describe('input validation and safe source', () => {
  it.each(['end', 'trigger'] as const)('blocks invalid %s before any initialization', (field) => {
    for (const value of [NaN, Infinity, -Infinity, 0, 9, 2.5]) {
      const result = simulateLoopControlProgram(config({ [field]: value }))
      expect(result).toMatchObject({
        status: 'blocked', blockReason: 'invalid-config', output: [], iterations: 0, summary: null,
      })
      expect(result.frames.map((frame) => frame.phase)).toEqual(['enter-main', 'blocked'])
      expect(result.frames.at(-1)?.memory).toMatchObject({ i: null, sum: null, iInScope: false })
      expect(result.validationIssues).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
      expect(result.source.sourceText).not.toMatch(/NaN|Infinity/)
    }
  })

  it('accepts an unmatched trigger and sanitizes runtime enum and numeric attacks', () => {
    expect(validateLoopControlConfig(config({ end: 1, trigger: 8 }))).toEqual([])
    const input = {
      mode: 'unsafe();' as LoopControlMode,
      end: 'unsafe();' as unknown as number,
      trigger: 'unsafe();' as unknown as number,
    }
    expect(validateLoopControlConfig(input).map((issue) => issue.field)).toEqual(['mode', 'end', 'trigger'])
    expect(buildLoopControlSource(input).sourceText).not.toContain('unsafe();')
    expect(simulateLoopControlProgram(input).status).toBe('blocked')
  })
})
