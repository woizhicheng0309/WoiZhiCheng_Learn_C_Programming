import * as loopSimulator from './loopSimulator'
import { COMPARATORS, type Comparator } from './types'
import {
  DEFAULT_WHILE_CONFIG,
  WHILE_LIMITS,
  buildWhileSource,
  simulateWhileProgram,
  validateWhileConfig,
  type WhileConfig,
  type WhileMode,
} from './whileLoops'

const config = (overrides: Partial<WhileConfig> = {}): WhileConfig => ({ ...DEFAULT_WHILE_CONFIG, ...overrides })

describe('while and do-while execution order', () => {
  it('checks while before each body, including the final false test', () => {
    const result = simulateWhileProgram()
    expect(result.output).toEqual([0, 1, 2])
    expect(result.outputText).toBe('0 1 2')
    expect(result.iterations).toBe(3)
    expect(result.status).toBe('completed')
    expect(result.frames.map((frame) => frame.phase)).toEqual([
      'enter-main', 'initialize',
      'condition', 'body', 'increment',
      'condition', 'body', 'increment',
      'condition', 'body', 'increment',
      'condition', 'return-main', 'done',
    ])
    const conditions = result.frames.filter((frame) => frame.phase === 'condition')
    expect(conditions.map((frame) => frame.conditionExpression)).toEqual(['0 < 3', '1 < 3', '2 < 3', '3 < 3'])
    expect(conditions.map((frame) => frame.conditionResult)).toEqual([true, true, true, false])
    expect(conditions.every((frame) => frame.activeLine === 5)).toBe(true)
  })

  it('executes the first do-while body and update before its first condition', () => {
    const result = simulateWhileProgram(config({ mode: 'do-while' }))
    expect(result.frames.map((frame) => frame.phase)).toEqual([
      'enter-main', 'initialize',
      'body', 'increment', 'condition',
      'body', 'increment', 'condition',
      'body', 'increment', 'condition',
      'return-main', 'done',
    ])
    expect(result.frames[2]).toMatchObject({
      phase: 'body', iteration: 1, conditionResult: null, memory: { i: 0 }, output: [0],
    })
    expect(result.frames[3]).toMatchObject({ phase: 'increment', iteration: 1, memory: { i: 1 } })
    const conditions = result.frames.filter((frame) => frame.phase === 'condition')
    expect(conditions.map((frame) => frame.memory.i)).toEqual([1, 2, 3])
    expect(conditions.map((frame) => frame.conditionResult)).toEqual([true, true, false])
    expect(conditions.every((frame) => frame.activeLine === 8)).toBe(true)
    expect(result.output).toEqual([0, 1, 2])
  })

  it('executes zero while bodies but one do-while body when the initial comparison is false', () => {
    const byWhile = simulateWhileProgram(config({ start: 5 }))
    const byDo = simulateWhileProgram(config({ start: 5, mode: 'do-while' }))
    expect(byWhile).toMatchObject({ status: 'completed', iterations: 0, output: [], outputText: '' })
    expect(byWhile.frames.map((frame) => frame.phase)).toEqual(['enter-main', 'initialize', 'condition', 'return-main', 'done'])
    expect(byWhile.frames[2]).toMatchObject({ conditionResult: false, conditionExpression: '5 < 3', memory: { i: 5 } })
    expect(byDo).toMatchObject({ status: 'completed', iterations: 1, output: [5] })
    expect(byDo.frames.find((frame) => frame.phase === 'condition')).toMatchObject({
      conditionResult: false, conditionExpression: '6 < 3', memory: { i: 6 },
    })
  })

  it.each([
    { comparator: '<' as const, start: 0, end: 3, step: 1, expected: [0, 1, 2] },
    { comparator: '<=' as const, start: 0, end: 3, step: 1, expected: [0, 1, 2, 3] },
    { comparator: '>' as const, start: 3, end: 0, step: -1, expected: [3, 2, 1] },
    { comparator: '>=' as const, start: 3, end: 0, step: -1, expected: [3, 2, 1, 0] },
    { comparator: '<=' as const, start: -3, end: 3, step: 2, expected: [-3, -1, 1, 3] },
  ])('honors $comparator with start $start, end $end, step $step', ({ expected, ...settings }) => {
    for (const mode of ['while', 'do-while'] as const) {
      const result = simulateWhileProgram(config({ ...settings, mode }))
      expect(result.status).toBe('completed')
      expect(result.output).toEqual(expected)
      expect(result.iterations).toBe(expected.length)
      const falseFrame = result.frames.filter((frame) => frame.phase === 'condition').at(-1)!
      expect(falseFrame.conditionResult).toBe(false)
      expect(falseFrame.memory.inScope).toBe(true)
    }
  })
})

describe('dynamic loop protection', () => {
  it.each(['while', 'do-while'] as const)('allows a zero step in %s when the actual condition is false', (mode) => {
    const input = config({ mode, start: 5, step: 0 })
    expect(validateWhileConfig(input)).toEqual([])
    const result = simulateWhileProgram(input)
    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(result.output).toEqual(mode === 'while' ? [] : [5])
    expect(result.iterations).toBe(mode === 'while' ? 0 : 1)
  })

  it.each(['while', 'do-while'] as const)('blocks a zero step in %s only after a true comparison', (mode) => {
    const result = simulateWhileProgram(config({ mode, step: 0 }))
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('step-zero')
    expect(result.validationIssues).toEqual([])
    expect(result.output).toEqual(mode === 'while' ? [] : [0])
    expect(result.iterations).toBe(mode === 'while' ? 0 : 1)
    expect(result.frames.at(-2)?.conditionResult).toBe(true)
    expect(result.frames.at(-1)).toMatchObject({ phase: 'blocked', activeLine: mode === 'while' ? 5 : 8, conditionResult: null })
    expect(result.message).toContain('模擬器保護')
  })

  it.each([
    { comparator: '<' as const, start: 0, end: 3, step: -1 },
    { comparator: '<=' as const, start: 0, end: 3, step: -1 },
    { comparator: '>' as const, start: 3, end: 0, step: 1 },
    { comparator: '>=' as const, start: 3, end: 0, step: 1 },
  ])('blocks a nonterminating $comparator direction at the next body boundary', (settings) => {
    for (const mode of ['while', 'do-while'] as const) {
      const input = config({ ...settings, mode })
      expect(validateWhileConfig(input)).toEqual([])
      const result = simulateWhileProgram(input)
      expect(result.blockReason).toBe('wrong-direction')
      expect(result.output).toEqual(mode === 'while' ? [] : [settings.start])
      expect(result.frames.at(-1)?.memory.i).toBe(mode === 'while' ? settings.start : settings.start + settings.step)
      expect(result.frames.at(-2)?.conditionResult).toBe(true)
      expect(result.message).toContain('真實 C 沒有這項保護')
    }
  })

  it('checks the updated do-while value even when the initial comparison would be false', () => {
    const crossed = simulateWhileProgram(config({ mode: 'do-while', start: 5, end: 3, step: -5 }))
    expect(crossed).toMatchObject({ status: 'blocked', blockReason: 'wrong-direction', output: [5], iterations: 1 })
    expect(crossed.frames.find((frame) => frame.phase === 'condition')).toMatchObject({
      conditionExpression: '0 < 3', conditionResult: true, memory: { i: 0 },
    })
    const remainsFalse = simulateWhileProgram(config({ mode: 'do-while', start: 5, end: 3, step: -1 }))
    expect(remainsFalse).toMatchObject({ status: 'completed', output: [5], iterations: 1 })
    expect(remainsFalse.frames.find((frame) => frame.phase === 'condition')?.conditionExpression).toBe('4 < 3')
  })

  it.each(['while', 'do-while'] as const)('enforces the %s last-resort iteration cap if comparison never becomes false', (mode) => {
    // Valid integer bounds normally finish within 41 bodies. A sustained true
    // comparator exercises the independent fallback limit without altering limits.
    const comparison = vi.spyOn(loopSimulator, 'compareLoopValue').mockReturnValue(true)
    try {
      const result = simulateWhileProgram(config({ mode }))
      expect(result.blockReason).toBe('iteration-limit')
      expect(result.iterations).toBe(WHILE_LIMITS.maxIterations)
      expect(result.output).toHaveLength(100)
      expect(result.output.at(-1)).toBe(99)
      expect(result.frames.at(-1)?.memory.i).toBe(100)
    } finally { comparison.mockRestore() }
  })

  it.each(['while', 'do-while'] as const)('completes the widest valid %s range within the defense limit', (mode) => {
    for (const input of [
      config({ mode, start: -20, end: 20, comparator: '<=', step: 1 }),
      config({ mode, start: 20, end: -20, comparator: '>=', step: -1 }),
    ]) {
      const result = simulateWhileProgram(input)
      expect(result.status).toBe('completed')
      expect(result.iterations).toBe(41)
      expect(result.blockReason).toBeNull()
    }
  })
})

describe('while source and execution snapshots', () => {
  it.each(['while', 'do-while'] as const)('keeps every %s frame aligned with safe C source and scope', (mode) => {
    const result = simulateWhileProgram(config({ mode }))
    expect(result.source.lines).toHaveLength(11)
    result.frames.forEach((frame, index) => {
      expect(frame.index).toBe(index)
      expect(frame.activePart).toBe(`line-${frame.activeLine}`)
      expect(result.source.lines[frame.activeLine - 1].phases).toContain(frame.phase)
      if (frame.phase !== 'condition') expect(frame.conditionResult).toBeNull()
    })
    expect(result.frames.find((frame) => frame.phase === 'return-main')?.memory.inScope).toBe(true)
    expect(result.frames.at(-1)?.memory.inScope).toBe(false)
    expect(result.source.sourceText).toBe(result.source.lines.map((line) => line.code).join('\n'))
    expect(buildWhileSource(config({ mode, step: -2 })).lines[6].code).toBe('    i -= 2;')
    expect(result.source.lines[mode === 'while' ? 4 : 7].code).toContain('i < 3')
  })

  it('copies configs, memory and outputs without changing earlier values or iteration counts', () => {
    const input = config()
    const result = simulateWhileProgram(input)
    input.start = 19
    expect(result.config.start).toBe(0)
    const initialized = result.frames.find((frame) => frame.phase === 'initialize')!
    const firstBody = result.frames.find((frame) => frame.phase === 'body')!
    const firstIncrement = result.frames.find((frame) => frame.phase === 'increment')!
    expect(result.frames[0].memory.i).toBeNull()
    expect(initialized.memory.i).toBe(0)
    expect(initialized.iteration).toBe(0)
    expect(firstBody).toMatchObject({ memory: { i: 0 }, iteration: 1, output: [0] })
    expect(firstIncrement).toMatchObject({ memory: { i: 1 }, iteration: 1, output: [0] })
    expect(firstBody.memory).not.toBe(firstIncrement.memory)
    expect(firstBody.output).not.toBe(firstIncrement.output)
    expect(result.output).not.toBe(result.frames.at(-1)?.output)
  })
})

describe('while config validation', () => {
  it.each(['start', 'end', 'step'] as const)('rejects invalid %s before initializing i', (field) => {
    for (const value of [NaN, Infinity, -Infinity, 0.5, WHILE_LIMITS[field].min - 1, WHILE_LIMITS[field].max + 1]) {
      const result = simulateWhileProgram(config({ [field]: value }))
      expect(result.blockReason).toBe('invalid-config')
      expect(result.output).toEqual([])
      expect(result.iterations).toBe(0)
      expect(result.frames.map((frame) => frame.phase)).toEqual(['enter-main', 'blocked'])
      expect(result.frames.at(-1)?.memory.i).toBeNull()
      expect(result.validationIssues).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
    }
  })

  it('validates runtime enums and keeps raw non-numeric input out of the generated C', () => {
    const input = config({ mode: 'unsafe();' as WhileMode, comparator: 'unsafe();' as Comparator, start: 'unsafe();' as unknown as number })
    expect(validateWhileConfig(input).map((issue) => issue.field)).toEqual(['start', 'mode', 'comparator'])
    expect(simulateWhileProgram(input).blockReason).toBe('invalid-config')
    expect(buildWhileSource(input).sourceText).not.toContain('unsafe();')
    expect(buildWhileSource(config({ end: NaN, step: Infinity })).sourceText).not.toMatch(/NaN|Infinity/)
    for (const comparator of COMPARATORS) expect(validateWhileConfig(config({ comparator }))).toEqual([])
  })
})
