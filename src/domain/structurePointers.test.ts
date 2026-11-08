import { DEFAULT_STRUCTURE_POINTER_CONFIG, buildStructurePointerSource, simulateStructurePointerProgram, validateStructurePointerConfig, type StructurePointerConfig } from './structurePointers'

describe('pointers to structures', () => {
  it('copies a pointer value, modifies the shared object, then rebinds only p', () => {
    const run = simulateStructurePointerProgram()
    expect(run.status).toBe('completed')
    expect(run.first).toEqual({ id: 7, score: 95 })
    expect(run.second).toEqual({ id: 12, score: 70 })
    expect(run.printedValues).toEqual([95, 70])
    expect(run.p).toBe('second')
    expect(run.q).toBe('first')
    const copied = run.frames.find(frame => frame.phase === 'copy-pointer')!
    expect(copied).toMatchObject({ p: 'first', q: 'first', first: { id: 7, score: 80 }, second: { id: 12, score: 60 } })
    const written = run.frames.find(frame => frame.phase === 'write-via-q')!
    expect(written).toMatchObject({ p: 'first', q: 'first', activePointer: 'q', activeObject: 'first', first: { score: 95 } })
    expect(run.frames.find(frame => frame.phase === 'rebind-p')).toMatchObject({ p: 'second', q: 'first', first: written.first, second: written.second })
  })
  for (const syntax of ['arrow', 'dereference'] as const) {
    for (const initialTarget of ['first', 'second'] as const) {
      for (const target of ['first', 'second', 'null'] as const) {
        it(`tracks ${syntax}, initial ${initialTarget}, new target ${target} and numeric boundaries`, () => {
          for (const aliasScore of [0, 95, 100]) for (const pointedScore of [0, 70, 100]) {
            const expected = { first: { id: 7, score: 80 }, second: { id: 12, score: 60 } }
            expected[initialTarget].score = aliasScore
            if (target !== 'null') expected[target].score = pointedScore
            const run = simulateStructurePointerProgram({ syntax, initialTarget, target, aliasScore, pointedScore })
            expect(run.first).toEqual(expected.first)
            expect(run.second).toEqual(expected.second)
            expect(run.q).toBe(initialTarget)
            expect(run.p).toBe(target)
            expect(run.printedValues).toEqual([expected.first.score, expected.second.score])
            expect(run.frames.some(frame => frame.phase === 'write-via-p')).toBe(target !== 'null')
            expect(run.frames.find(frame => frame.phase === 'check-pointer')!.condition).toBe(target !== 'null')
          }
        })
      }
    }
  }
  it('overwrites the same object in execution order when both pointers keep the same target', () => {
    const run = simulateStructurePointerProgram({ ...DEFAULT_STRUCTURE_POINTER_CONFIG, target: 'first' })
    expect(run.frames.find(frame => frame.phase === 'write-via-q')!.first!.score).toBe(95)
    expect(run.frames.find(frame => frame.phase === 'rebind-p')!.first!.score).toBe(95)
    expect(run.first).toEqual({ id: 7, score: 70 })
    expect(run.second).toEqual({ id: 12, score: 60 })
    expect(run.printedValues).toEqual([70, 60])
  })
  it('skips a null dereference, leaves q unchanged and completes the guarded program', () => {
    const run = simulateStructurePointerProgram({ ...DEFAULT_STRUCTURE_POINTER_CONFIG, target: 'null' })
    const guard = run.frames.findIndex(frame => frame.phase === 'check-pointer')
    expect(run.status).toBe('completed')
    expect(run.frames[guard]).toMatchObject({ p: 'null', q: 'first', condition: false, activeObject: null })
    expect(run.frames[guard + 1].phase).toBe('print')
    expect(run.frames.some(frame => frame.phase === 'write-via-p')).toBe(false)
    expect(run.printedValues).toEqual([95, 60])
    expect(run.output).toEqual(['first=95, second=60'])
  })
  it('does not expose future objects, pointer declarations or output', () => {
    const run = simulateStructurePointerProgram()
    expect(run.frames[0]).toMatchObject({ first: null, second: null, p: null, q: null, mainInScope: false })
    expect(run.frames.find(frame => frame.phase === 'initialize-first')).toMatchObject({ first: { score: 80 }, second: null, p: null, q: null })
    expect(run.frames.find(frame => frame.phase === 'bind-p')).toMatchObject({ p: 'first', q: null })
    const print = run.frames.findIndex(frame => frame.phase === 'print')
    expect(run.frames.slice(0, print).every(frame => frame.output.length === 0 && frame.printedValues === null)).toBe(true)
    expect(run.frames[print]).toMatchObject({ printedValues: [95, 70], output: ['first=95, second=70'] })
    expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
  })
  it('keeps independent object snapshots and configuration for historical frames', () => {
    const config = { ...DEFAULT_STRUCTURE_POINTER_CONFIG }
    const run = simulateStructurePointerProgram(config)
    const before = run.frames.find(frame => frame.phase === 'copy-pointer')!
    const after = run.frames.find(frame => frame.phase === 'write-via-q')!
    expect(before.first!.score).toBe(80)
    expect(after.first!.score).toBe(95)
    expect(before.first).not.toBe(after.first)
    expect(before.second).not.toBe(after.second)
    expect(run.first).not.toBe(after.first)
    expect(run.second).not.toBe(after.second)
    expect(run.first).not.toBe(run.second)
    config.initialTarget = 'second'; config.aliasScore = 0
    expect(run.config).toMatchObject({ initialTarget: 'first', aliasScore: 95 })
  })
  it('generates equivalent member expressions and aligns every frame to its C line', () => {
    const arrow = buildStructurePointerSource()
    const dereference = buildStructurePointerSource({ ...DEFAULT_STRUCTURE_POINTER_CONFIG, syntax: 'dereference', target: 'null' })
    expect(arrow.lines[10].code).toBe('  struct Student *p = &first;')
    expect(arrow.lines[11].code).toBe('  struct Student *q = p;')
    expect(arrow.lines[12].code).toBe('  q->score = 95;')
    expect(dereference.lines[12].code).toBe('  (*q).score = 95;')
    expect(dereference.lines[13].code).toBe('  p = NULL;')
    expect(dereference.lines[14].code).toBe('  if (p != NULL) {')
    expect(dereference.lines[15].code).toBe('    (*p).score = 70;')
    const lineByPhase = { prepare: 8, 'enter-main': 8, 'initialize-first': 9, 'initialize-second': 10, 'bind-p': 11,
      'copy-pointer': 12, 'write-via-q': 13, 'rebind-p': 14, 'check-pointer': 15, 'write-via-p': 16,
      print: 18, 'return-main': 19, done: 20, blocked: 8 }
    for (const [index, frame] of simulateStructurePointerProgram().frames.entries()) {
      expect(frame.index).toBe(index)
      expect(frame.activeLine).toBe(lineByPhase[frame.phase])
      expect(frame.activePart).toBe(`line-${frame.activeLine}`)
    }
  })
  it.each([
    { syntax: '__proto__' }, { syntax: 'constructor' }, { syntax: { toString: null } }, { syntax: null },
    { initialTarget: 'null' }, { initialTarget: null }, { initialTarget: 'other' },
    { target: null }, { target: { toString: null } }, { target: 'second; evil();' },
    { aliasScore: -1 }, { aliasScore: 101 }, { aliasScore: 0.5 }, { aliasScore: '95' }, { aliasScore: Infinity },
    { pointedScore: -1 }, { pointedScore: 101 }, { pointedScore: NaN }, { pointedScore: null },
  ])('blocks invalid configuration %j before creating objects or pointers', change => {
    const config = { ...DEFAULT_STRUCTURE_POINTER_CONFIG, ...change } as StructurePointerConfig
    expect(validateStructurePointerConfig(config).length).toBeGreaterThan(0)
    const run = simulateStructurePointerProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
    expect(run.frames.every(frame => frame.first === null && frame.second === null && frame.p === null && frame.q === null && !frame.mainInScope)).toBe(true)
    expect(run.printedValues).toBeNull()
    expect(run.output).toEqual([])
    expect(run.source.sourceText).not.toContain('evil()')
  })
})
