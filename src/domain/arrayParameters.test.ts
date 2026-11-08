import { ARRAY_PARAMETER_SAMPLES, DEFAULT_ARRAY_PARAMETER_CONFIG, buildArrayParameterSource, simulateArrayParameterProgram, validateArrayParameterConfig, type ArrayParameterConfig } from './arrayParameters'

describe('array parameters and shared storage', () => {
  for (const sample of Object.keys(ARRAY_PARAMETER_SAMPLES) as ArrayParameterConfig['sample'][]) {
    for (let count = 0; count <= 5; count++) {
      for (const mode of ['read-only', 'modify'] as const) {
        it(`processes ${count} ${sample} elements in ${mode} mode`, () => {
          const run = simulateArrayParameterProgram({ sample, count, mode })
          const original = ARRAY_PARAMETER_SAMPLES[sample]
          const expected = original.map((value, index) => value + (mode === 'modify' && index < count ? 2 : 0))
          const sum = expected.slice(0, count).reduce((total, value) => total + value, 0)
          expect(run.status).toBe('completed')
          expect(run.scores).toEqual(expected)
          expect(run.answer).toBe(sum)
          expect(run.writes).toBe(mode === 'modify' ? count : 0)
          expect(run.visitedIndices).toEqual(Array.from({ length: count }, (_, index) => index))
          expect(run.output).toEqual([`answer=${sum}`, ...expected.map(String)])
          expect(run.frames.filter(frame => frame.phase === 'modify-element')).toHaveLength(run.writes)
          expect(run.frames.filter(frame => frame.phase === 'accumulate')).toHaveLength(count)
          expect(run.frames.filter(frame => frame.phase === 'print-element')).toHaveLength(5)
          for (const [index, frame] of run.frames.entries()) {
            expect(frame.index).toBe(index)
            expect(frame.activeLine).toBeGreaterThan(0)
            expect(frame.activeLine).toBeLessThanOrEqual(run.source.lines.length)
            if (frame.callerCount !== null) expect(frame.callerCount).toBe(count)
            if (frame.parameterCount !== null) expect(frame.parameterCount).toBe(count)
            if (frame.activeIndex !== null) {
              expect(frame.activeIndex).toBeGreaterThanOrEqual(0)
              expect(frame.activeIndex).toBeLessThan(5)
              if (frame.calleeStatus === 'active') expect(frame.activeIndex).toBeLessThan(count)
            }
            if (frame.calleeStatus === 'active') expect(frame.mainStatus).toBe('suspended')
            if (frame.scores) expect(frame.scores.slice(count)).toEqual(original.slice(count))
            if (mode === 'read-only' && frame.scores) expect(frame.scores).toEqual(original)
          }
          expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainStatus: 'returned', calleeStatus: 'returned', iInScope: false, kInScope: false })
        })
      }
    }
  }
  it('changes the caller array while main is suspended, without aliasing historical snapshots', () => {
    const run = simulateArrayParameterProgram({ ...DEFAULT_ARRAY_PARAMETER_CONFIG, mode: 'modify' })
    const before = run.frames.find(frame => frame.phase === 'bind-parameters')!
    const changed = run.frames.find(frame => frame.phase === 'modify-element')!
    expect(before.scores).toEqual([4, 7, 2, 9, 5])
    expect(changed.scores).toEqual([6, 7, 2, 9, 5])
    expect(changed.mainStatus).toBe('suspended')
    expect(before.scores).not.toBe(changed.scores)
    expect(before.visitedIndices).toEqual([])
    expect(run.frames.find(frame => frame.phase === 'accumulate')!.visitedIndices).toEqual([0])
    expect(before.answer).toBeNull()
    expect(run.answer).toBe(19)
  })
  it('separates returning a value from assigning it and ends each local scope at the right step', () => {
    const frames = simulateArrayParameterProgram().frames
    const atReturn = frames.findIndex(frame => frame.phase === 'return-process')
    expect(frames[atReturn]).toMatchObject({ sum: 13, returnValue: 13, answer: null, calleeStatus: 'active', mainStatus: 'suspended', iInScope: false })
    expect(frames[atReturn + 1]).toMatchObject({ phase: 'assign-answer', answer: 13, calleeStatus: 'returned', mainStatus: 'active' })
    expect(frames.find(frame => frame.phase === 'print-condition' && frame.k === 5)).toMatchObject({ activeIndex: null, kInScope: true })
    expect(frames.find(frame => frame.phase === 'return-main')).toMatchObject({ kInScope: false, mainStatus: 'active' })
    expect(frames.filter(frame => frame.phase === 'condition').at(-1)).toMatchObject({ i: 3, activeIndex: null, iInScope: true })
    expect(frames.find(frame => frame.phase === 'end-loop')!.iInScope).toBe(false)
  })
  it('handles count zero without touching an element and can return a negative sum', () => {
    for (const mode of ['read-only', 'modify'] as const) {
      const run = simulateArrayParameterProgram({ ...DEFAULT_ARRAY_PARAMETER_CONFIG, count: 0, mode })
      expect(run).toMatchObject({ answer: 0, writes: 0, visitedIndices: [], scores: [4, 7, 2, 9, 5] })
      expect(run.frames.filter(frame => frame.phase === 'condition')).toHaveLength(1)
    }
    expect(simulateArrayParameterProgram({ sample: 'mixed', count: 3, mode: 'read-only' }).answer).toBe(-3)
  })
  it('generates const parameters only in read-only mode and does not execute explanatory comments', () => {
    const read = simulateArrayParameterProgram()
    expect(read.source.sourceText).toContain('int process(const int items[], int count)')
    expect(read.source.sourceText).not.toContain('items[i] += 2;')
    expect(read.frames.some(frame => frame.activeLine === 6)).toBe(false)
    const modify = buildArrayParameterSource({ ...DEFAULT_ARRAY_PARAMETER_CONFIG, mode: 'modify' })
    expect(modify.sourceText).toContain('int process(int items[], int count)')
    expect(modify.lines[5]).toEqual({ lineNumber: 6, code: '    items[i] += 2;' })
    for (const [phase, line] of [['bind-parameters', 3], ['accumulate', 7], ['return-process', 9], ['assign-answer', 15], ['print-element', 18]] as const) {
      expect(read.frames.filter(frame => frame.phase === phase).every(frame => frame.activeLine === line && frame.activePart === `line-${line}`)).toBe(true)
    }
  })
  it.each([
    { sample: '__proto__' }, { sample: 'constructor' }, { sample: 'bad}; evil();' }, { sample: { toString: null } }, { sample: [] }, { sample: null }, { mode: 'bad' },
    { count: -1 }, { count: 6 }, { count: 1.5 }, { count: Infinity }, { count: NaN }, { count: '3' },
  ])('blocks unsupported configuration %j before allocation', change => {
    const config = { ...DEFAULT_ARRAY_PARAMETER_CONFIG, ...change } as ArrayParameterConfig
    expect(validateArrayParameterConfig(config).length).toBeGreaterThan(0)
    const run = simulateArrayParameterProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(run.scores).toBeNull()
    expect(run.answer).toBeNull()
    expect(run.output).toEqual([])
    expect(run.source.sourceText).not.toMatch(/evil\(\)|NaN|Infinity/)
  })
})
