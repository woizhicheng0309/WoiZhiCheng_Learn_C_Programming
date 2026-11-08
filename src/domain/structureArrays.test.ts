import { DEFAULT_STRUCTURE_ARRAY_CONFIG, STRUCTURE_ARRAY_ROSTERS, buildStructureArraySource, simulateStructureArrayProgram, validateStructureArrayConfig, type StructureArrayConfig } from './structureArrays'

describe('arrays of structures', () => {
  it('updates only the chosen member before summing and counting', () => {
    const run = simulateStructureArrayProgram()
    expect(run.status).toBe('completed')
    expect(run.students).toEqual([{ id: 7, score: 80 }, { id: 12, score: 70 }, { id: 21, score: 95 }])
    expect(run.printedValues).toEqual([245, 2])
    expect(run.output).toEqual(['total=245, passed=2'])
    expect(run.frames[0]).toMatchObject({ students: null, total: null, passed: null, i: null, mainInScope: false })
    expect(run.frames.find(frame => frame.phase === 'initialize-array')!.students).toEqual([{ id: 7, score: 80 }, { id: 12, score: 60 }, { id: 21, score: 95 }])
    expect(run.frames.filter(frame => frame.phase === 'add-score').map(frame => [frame.i, frame.total, frame.passed])).toEqual([[0, 80, 0], [1, 150, 1], [2, 245, 1]])
    expect(run.frames.filter(frame => frame.phase === 'count-pass').map(frame => [frame.i, frame.passed])).toEqual([[0, 1], [2, 2]])
  })
  for (const roster of Object.keys(STRUCTURE_ARRAY_ROSTERS) as StructureArrayConfig['roster'][]) {
    for (const index of [0, 1, 2]) {
      it(`handles ${roster} data and member updates at index ${index} across threshold and score edges`, () => {
        for (const score of [0, 60, 100]) for (const threshold of [0, 60, 100]) {
          const scores: number[] = [...STRUCTURE_ARRAY_ROSTERS[roster].scores]
          scores[index] = score
          const run = simulateStructureArrayProgram({ roster, index, score, threshold })
          expect(run.students!.map(row => row.score)).toEqual(scores)
          expect(run.students!.map(row => row.id)).toEqual([7, 12, 21])
          expect(run.printedValues).toEqual([scores.reduce((a, b) => a + b, 0), scores.filter(value => value >= threshold).length])
          expect(run.frames.filter(frame => frame.phase === 'if-condition').map(frame => frame.condition!.value)).toEqual(scores.map(value => value >= threshold))
          expect(run.frames.filter(frame => frame.phase === 'add-score').map(frame => frame.activeRow)).toEqual([0, 1, 2])
        }
      })
    }
  }
  it('counts equal-to-threshold scores and skips the increment only on a false condition', () => {
    const run = simulateStructureArrayProgram({ roster: 'boundary', index: 2, score: 61, threshold: 60 })
    expect(run.printedValues).toEqual([180, 2])
    const decisions = run.frames.filter(frame => frame.phase === 'if-condition')
    expect(decisions.map(frame => frame.condition)).toEqual([
      { expression: '59 >= 60', value: false }, { expression: '60 >= 60', value: true }, { expression: '61 >= 60', value: true },
    ])
    expect(run.frames[decisions[0].index + 1].phase).toBe('for-update')
    expect(run.frames[decisions[1].index + 1].phase).toBe('count-pass')
  })
  it('checks i = 3 without reading a nonexistent element, then ends the loop variable scope', () => {
    const run = simulateStructureArrayProgram()
    const checks = run.frames.filter(frame => frame.phase === 'for-condition')
    expect(checks.map(frame => frame.i)).toEqual([0, 1, 2, 3])
    expect(checks.map(frame => frame.activeRow)).toEqual([0, 1, 2, null])
    expect(checks.at(-1)).toMatchObject({ i: 3, iInScope: true, condition: { expression: '3 < 3', value: false } })
    const print = run.frames.find(frame => frame.phase === 'print')!
    expect(run.frames[checks.at(-1)!.index + 1]).toBe(print)
    expect(print).toMatchObject({ iInScope: false, mainInScope: true, printedValues: [245, 2] })
    expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false, iInScope: false })
    expect(run.frames.every(frame => frame.activeRow === null || [0, 1, 2].includes(frame.activeRow))).toBe(true)
  })
  it('preserves independent snapshots and reveals the prediction only on printf', () => {
    const config = { ...DEFAULT_STRUCTURE_ARRAY_CONFIG }
    const run = simulateStructureArrayProgram(config)
    const initialized = run.frames.find(frame => frame.phase === 'initialize-array')!
    const edited = run.frames.find(frame => frame.phase === 'update-member')!
    expect(initialized.students).not.toBe(edited.students)
    initialized.students!.forEach((row, index) => expect(row).not.toBe(edited.students![index]))
    expect(initialized.students![1].score).toBe(60)
    expect(edited.students![1].score).toBe(70)
    expect(run.students![1]).not.toBe(edited.students![1])
    expect(new Set(initialized.students).size).toBe(3)
    expect(STRUCTURE_ARRAY_ROSTERS.mixed.scores).toEqual([80, 60, 95])
    config.score = 0
    expect(run.config.score).toBe(70)
    const printIndex = run.frames.findIndex(frame => frame.phase === 'print')
    expect(run.frames.slice(0, printIndex).every(frame => frame.output.length === 0 && frame.printedValues === null)).toBe(true)
    expect(run.frames[printIndex].output).toEqual(['total=245, passed=2'])
    expect(run.frames[printIndex].printedValues).not.toBe(run.printedValues)
  })
  it('keeps each trace phase aligned with its C statement and for header part', () => {
    const run = simulateStructureArrayProgram({ roster: 'equal', index: 0, score: 100, threshold: 100 })
    expect(buildStructureArraySource(run.config).sourceText).toContain('struct Student students[3] = {{7, 60}, {12, 60}, {21, 60}};')
    const lineByPhase = { prepare: 8, 'enter-main': 8, 'initialize-array': 9, 'update-member': 10, 'initialize-totals': 11,
      'for-init': 12, 'for-condition': 12, 'for-update': 12, 'add-score': 13, 'if-condition': 14, 'count-pass': 15,
      print: 18, 'return-main': 19, done: 20, blocked: 8 }
    for (const [index, frame] of run.frames.entries()) {
      expect(frame.index).toBe(index)
      expect(frame.activeLine).toBe(lineByPhase[frame.phase])
      expect(frame.activePart).toBe(frame.phase.startsWith('for-') ? frame.phase : `line-${frame.activeLine}`)
    }
    expect(run.source.lines[9].code).toBe('  students[0].score = 100;')
    expect(run.source.lines[13].code).toBe('    if (students[i].score >= 100) {')
    expect(run.source.lines[17].code).toContain('printf("total=%d, passed=%d\\n", total, passed)')
  })
  it.each([
    { roster: '__proto__' }, { roster: 'constructor' }, { roster: { toString: null } }, { roster: null },
    { index: -1 }, { index: 3 }, { index: 0.5 }, { index: '1' }, { index: null },
    { score: -1 }, { score: 101 }, { score: 60.5 }, { score: Infinity }, { score: '70' },
    { threshold: -1 }, { threshold: 101 }, { threshold: NaN }, { threshold: null },
  ])('blocks invalid configuration %j before creating or accessing any element', change => {
    const config = { ...DEFAULT_STRUCTURE_ARRAY_CONFIG, ...change } as StructureArrayConfig
    expect(validateStructureArrayConfig(config).length).toBeGreaterThan(0)
    const run = simulateStructureArrayProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
    expect(run.students).toBeNull()
    expect(run.printedValues).toBeNull()
    expect(run.output).toEqual([])
    expect(run.frames.every(frame => frame.students === null && frame.activeRow === null && !frame.mainInScope)).toBe(true)
  })
})
