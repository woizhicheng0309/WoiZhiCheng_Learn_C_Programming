import { INITIAL_SCORES } from './arrays'
import {
  DEFAULT_TRAVERSAL_CONFIG,
  TRAVERSAL_VALUES,
  buildTraversalSource,
  simulateTraversalProgram,
  validateTraversalConfig,
  type TraversalConfig,
  type TraversalMode,
} from './traversal'

const config = (overrides: Partial<TraversalConfig> = {}): TraversalConfig => ({
  ...DEFAULT_TRAVERSAL_CONFIG,
  ...overrides,
})

describe('finite array traversal', () => {
  it.each([0, 1, 2, 3, 4, 5])('produces the same first %i values with index and pointer access', (count) => {
    const byIndex = simulateTraversalProgram(config({ count, mode: 'index' }))
    const byPointer = simulateTraversalProgram(config({ count, mode: 'pointer' }))
    for (const result of [byIndex, byPointer]) {
      expect(result.status).toBe('completed')
      expect(result.blockReason).toBeNull()
      expect(result.output).toEqual(TRAVERSAL_VALUES.slice(0, count))
      expect(result.outputText).toBe(TRAVERSAL_VALUES.slice(0, count).join(' '))
      expect(result.frames.filter((frame) => frame.phase === 'read-element')
        .map((frame) => frame.highlightedIndex)).toEqual(Array.from({ length: count }, (_, index) => index))
      const conditions = result.frames.filter((frame) => frame.phase === 'condition')
      expect(conditions.map((frame) => frame.conditionResult)).toEqual([
        ...Array.from({ length: count }, () => true), false,
      ])
      expect(conditions.at(-1)?.memory).toMatchObject({ i: count, indexInScope: false, inScope: true })
      expect(result.frames.at(-1)?.memory).toMatchObject({ indexInScope: false, inScope: false })
    }
    expect(byIndex.frames.some((frame) => frame.phase === 'bind-pointer' || frame.phase === 'advance-pointer')).toBe(false)
    expect(byIndex.frames.every((frame) => frame.memory.pointerIndex === null)).toBe(true)
  })

  it('forms a legal one-past pointer after the last read without dereferencing it', () => {
    const result = simulateTraversalProgram()
    const readFrames = result.frames.filter((frame) => frame.phase === 'read-element')
    expect(readFrames.map((frame) => frame.memory.pointerIndex)).toEqual([0, 1, 2, 3, 4])
    expect(readFrames.at(-1)?.output).toEqual([4, 7, 2, 9, 5])
    const advanceFrames = result.frames.filter((frame) => frame.phase === 'advance-pointer')
    expect(advanceFrames.map((frame) => frame.memory.pointerIndex)).toEqual([1, 2, 3, 4, 5])
    const onePast = advanceFrames.at(-1)!
    expect(onePast.highlightedIndex).toBeNull()
    expect(onePast.explanation).toContain('不能讀取 *p')
    expect(onePast.explanation).toContain('sizeof(*p)')
    expect(onePast.explanation).toContain('不一定是 4 bytes')
    expect(result.frames.filter((frame) => frame.phase === 'condition').at(-1)).toMatchObject({
      conditionResult: false,
      memory: { pointerIndex: 5, i: 5, inScope: true },
    })
    expect(result.frames.every((frame) => frame.memory.pointerIndex === null || frame.memory.pointerIndex <= 5)).toBe(true)
  })

  it('with count zero never reads or advances and still evaluates the final false condition', () => {
    const result = simulateTraversalProgram(config({ count: 0 }))
    expect(result.frames.map((frame) => frame.phase)).toEqual([
      'enter-main', 'initialize-array', 'bind-pointer', 'init-index',
      'condition', 'return-main', 'done',
    ])
    expect(result.frames.find((frame) => frame.phase === 'condition')).toMatchObject({
      conditionResult: false,
      memory: { pointerIndex: 0, i: 0, indexInScope: false },
    })
    expect(result.output).toEqual([])
    expect(result.outputText).toBe('')
  })

  it.each(['pointer', 'index'] as const)('blocks the sixth %s read while preserving all five earlier outputs', (mode) => {
    const result = simulateTraversalProgram(config({ count: 6, mode }))
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('out-of-bounds')
    expect(result.validationIssues).toEqual([])
    expect(result.output).toEqual(TRAVERSAL_VALUES)
    expect(result.outputText).toBe('4 7 2 9 5')
    expect(result.frames.filter((frame) => frame.phase === 'read-element')).toHaveLength(5)
    expect(result.frames.some((frame) => frame.phase === 'done' || frame.phase === 'return-main')).toBe(false)
    const condition = result.frames.at(-2)!
    const blocked = result.frames.at(-1)!
    expect(condition).toMatchObject({ phase: 'condition', conditionResult: true, highlightedIndex: null })
    expect(blocked).toMatchObject({
      phase: 'blocked', activeLine: 7, activePart: 'line-7', highlightedIndex: null,
      memory: { i: 5, pointerIndex: mode === 'pointer' ? 5 : null, indexInScope: true, inScope: true },
    })
    expect(blocked.output).toEqual(condition.output)
    expect(blocked.output).not.toBe(condition.output)
    if (mode === 'pointer') {
      expect(result.frames.filter((frame) => frame.phase === 'advance-pointer')).toHaveLength(5)
      expect(result.message).toContain('不可解參照')
      expect(blocked.memory.pointerIndex).toBe(5)
    } else {
      expect(result.message).toContain('scores[5]')
    }
  })
})

describe('traversal source, snapshots and scope', () => {
  it.each(['pointer', 'index'] as const)('keeps every %s frame aligned to the generated source', (mode) => {
    for (const count of [0, 5, 6]) {
      const result = simulateTraversalProgram(config({ mode, count }))
      expect(result.source.lines).toHaveLength(11)
      result.frames.forEach((frame, index) => {
        expect(frame.index).toBe(index)
        expect(frame.activePart).toBe(`line-${frame.activeLine}`)
        expect(result.source.lines[frame.activeLine - 1].phases).toContain(frame.phase)
        if (frame.phase !== 'condition') expect(frame.conditionResult).toBeNull()
      })
      expect(result.source.sourceText).toBe(result.source.lines.map((line) => line.code).join('\n'))
      expect(result.source.lines[6].code).toContain(mode === 'pointer' ? '*p' : 'scores[i]')
      expect(result.source.lines[5].code).toContain(`i < ${count}`)
    }
  })

  it('describes array-to-pointer conversion without treating arrays as pointer variables', () => {
    const bind = simulateTraversalProgram().frames.find((frame) => frame.phase === 'bind-pointer')!
    expect(bind.explanation).toContain('轉換成指向第一個元素的指標值')
    expect(bind.memory.pointerIndex).toBe(0)
    expect(buildTraversalSource().lines[4].code).toBe('  int *p = scores;')
  })

  it('copies array and output snapshots independently and never alters the shared lesson data', () => {
    const input = config({ count: 3 })
    const result = simulateTraversalProgram(input)
    input.count = 0
    expect(result.config.count).toBe(3)
    const initialized = result.frames.find((frame) => frame.phase === 'initialize-array')!
    const bound = result.frames.find((frame) => frame.phase === 'bind-pointer')!
    expect(initialized.memory.scores).not.toBe(bound.memory.scores)
    expect(initialized.memory.scores).not.toBe(TRAVERSAL_VALUES)
    expect(TRAVERSAL_VALUES).not.toBe(INITIAL_SCORES)
    expect(result.frames[0].memory.scores).toBeNull()
    expect(initialized.memory.pointerIndex).toBeNull()
    expect(bound.memory.pointerIndex).toBe(0)
    expect(result.frames[0].output).toEqual([])
    expect(result.output).toEqual([4, 7, 2])
    expect(result.output).not.toBe(result.frames.at(-1)?.output)
    expect(TRAVERSAL_VALUES).toEqual([4, 7, 2, 9, 5])
    expect(INITIAL_SCORES).toEqual([4, 7, 2, 9, 5])
  })
})

describe('traversal input validation', () => {
  it.each([NaN, Infinity, -Infinity, -1, 0.5, 7])('blocks count %s before initializing the array', (count) => {
    const result = simulateTraversalProgram(config({ count }))
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('invalid-config')
    expect(result.output).toEqual([])
    expect(result.outputText).toBe('')
    expect(result.frames.map((frame) => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(result.frames.at(-1)?.memory).toEqual({
      scores: null, pointerIndex: null, i: null, indexInScope: false, inScope: true,
    })
    expect(result.validationIssues).toEqual([expect.objectContaining({ field: 'count' })])
    expect(result.source.lines[5].code).toContain('0 /* invalid count: simulation blocked */')
  })

  it('rejects unknown modes and keeps raw runtime input out of displayed C source', () => {
    const input = config({ mode: 'unsafe();' as TraversalMode, count: '6; unsafe();' as unknown as number })
    expect(validateTraversalConfig(input).map((issue) => issue.field)).toEqual(['count', 'mode'])
    expect(simulateTraversalProgram(input).blockReason).toBe('invalid-config')
    expect(buildTraversalSource(input).sourceText).not.toContain('unsafe();')
    expect(simulateTraversalProgram(config({ mode: 'invalid' as TraversalMode })).status).toBe('blocked')
  })
})
