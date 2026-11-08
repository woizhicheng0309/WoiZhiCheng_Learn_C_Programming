import { DEFAULT_STRUCTURE_CONFIG, STRUCT_FIELDS, STRUCT_INITIALIZATIONS, buildStructureSource, simulateStructureProgram, validateStructureConfig, type StructureConfig } from './structures'

describe('structure members and value copying', () => {
  for (const initialization of Object.keys(STRUCT_INITIALIZATIONS) as StructureConfig['initialization'][]) {
    for (const target of ['student', 'backup'] as const) {
      for (const field of Object.keys(STRUCT_FIELDS) as StructureConfig['field'][]) {
        it(`initializes ${initialization} and updates ${target}.${field} without modifying the other object`, () => {
          const run = simulateStructureProgram({ initialization, target, field })
          const original = initialization === 'partial' ? { id: 7, score: 0, grade: '\0' } : { id: 7, score: 80, grade: 'B' }
          const expected = { student: { ...original }, backup: { ...original } }
          if (field === 'grade') expected[target].grade = 'A'
          else expected[target][field] = field === 'id' ? 42 : 95
          expect(run.status).toBe('completed')
          expect(run.student).toEqual(expected.student)
          expect(run.backup).toEqual(expected.backup)
          const asNumber = (name: 'student' | 'backup') => field === 'grade' ? expected[name].grade === 'A' ? 65 : expected[name].grade === 'B' ? 66 : 0 : expected[name][field]
          expect(run.printedValues).toEqual([asNumber('student'), asNumber('backup')])
          expect(run.frames.find(frame => frame.phase === 'update-member')).toMatchObject({ activeObject: target, activeField: field, activeLine: 12 })
          for (const [index, frame] of run.frames.entries()) {
            expect(frame.index).toBe(index)
            expect(frame.activeLine).toBeGreaterThan(0)
            expect(frame.activeLine).toBeLessThanOrEqual(run.source.lines.length)
            expect(frame.activePart).toBe(`line-${frame.activeLine}`)
            if (frame.student && frame.backup) expect(frame.student).not.toBe(frame.backup)
          }
          expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
        })
      }
    }
  }
  it('retains independent snapshots before and after copying and editing', () => {
    const run = simulateStructureProgram()
    expect(run.frames[0]).toMatchObject({ phase: 'prepare', student: null, backup: null, mainInScope: false })
    const created = run.frames.find(frame => frame.phase === 'initialize-student')!
    const copied = run.frames.find(frame => frame.phase === 'copy-structure')!
    const changed = run.frames.find(frame => frame.phase === 'update-member')!
    expect(created.backup).toBeNull()
    expect(created.student).toEqual({ id: 7, score: 80, grade: 'B' })
    expect(copied.student).toEqual(copied.backup)
    expect(copied.student).not.toBe(copied.backup)
    expect(copied.backup!.score).toBe(80)
    expect(changed.backup!.score).toBe(95)
    expect(changed.student!.score).toBe(80)
    expect(created.student).not.toBe(copied.student)
    expect(run.student).not.toBe(changed.student)
    expect(run.backup).not.toBe(changed.backup)
  })
  it('zero-initializes omitted scalar members and treats the character zero as NUL', () => {
    const run = simulateStructureProgram({ initialization: 'partial', target: 'backup', field: 'grade' })
    expect(run.frames.find(frame => frame.phase === 'initialize-student')!.student).toEqual({ id: 7, score: 0, grade: '\0' })
    expect(run.student).toEqual({ id: 7, score: 0, grade: '\0' })
    expect(run.backup).toEqual({ id: 7, score: 0, grade: 'A' })
    expect(run.output).toEqual(['student: id=7, score=0, grade_code=0', 'backup: id=7, score=0, grade_code=65'])
  })
  it('generates a terminated type definition and designated initialization in member-name order', () => {
    const source = buildStructureSource({ ...DEFAULT_STRUCTURE_CONFIG, initialization: 'designated' })
    expect(source.lines[2]).toEqual({ lineNumber: 3, code: 'struct Student {' })
    expect(source.lines[6].code).toBe('};')
    expect(source.lines[9].code).toBe("  struct Student student = {.score = 80, .grade = 'B', .id = 7};")
    expect(source.lines[10].code).toBe('  struct Student backup = student;')
    expect(source.lines[11].code).toBe('  backup.score = 95;')
    expect(simulateStructureProgram({ ...DEFAULT_STRUCTURE_CONFIG, initialization: 'designated' }).frames.find(frame => frame.phase === 'initialize-student')!.student).toEqual({ id: 7, score: 80, grade: 'B' })
  })
  it('prints each object separately and reveals the prediction pair only after both printf calls', () => {
    const run = simulateStructureProgram()
    const first = run.frames.findIndex(frame => frame.phase === 'print-student')
    expect(run.frames.slice(0, first).every(frame => frame.output.length === 0)).toBe(true)
    expect(run.frames[first].printedValues).toBeNull()
    expect(run.frames[first].output).toEqual(['student: id=7, score=80, grade_code=66'])
    expect(run.frames[first + 1]).toMatchObject({ phase: 'print-backup', printedValues: [80, 95] })
    expect(run.output).toEqual(['student: id=7, score=80, grade_code=66', 'backup: id=7, score=95, grade_code=66'])
    expect(run.frames.find(frame => frame.phase === 'print-student')!.activeLine).toBe(13)
    expect(run.frames.find(frame => frame.phase === 'print-backup')!.activeLine).toBe(14)
  })
  it.each([
    { initialization: '__proto__' }, { initialization: 'constructor' }, { initialization: { toString: null } },
    { field: '__proto__' }, { field: { toString: null } }, { field: 'score; evil();' },
    { target: 'other' }, { target: 'student; evil();' }, { target: null }, { initialization: null },
  ])('safely blocks invalid configuration %j before object creation', change => {
    const config = { ...DEFAULT_STRUCTURE_CONFIG, ...change } as StructureConfig
    expect(validateStructureConfig(config).length).toBeGreaterThan(0)
    const run = simulateStructureProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
    expect(run.frames.every(frame => !frame.mainInScope && frame.student === null && frame.backup === null)).toBe(true)
    expect(run.printedValues).toBeNull()
    expect(run.output).toEqual([])
    expect(run.source.sourceText).not.toContain('evil()')
  })
})
