import { DEFAULT_STRUCTURE_FUNCTION_CONFIG, simulateStructureFunctionProgram, type StructureFunctionConfig } from './structureFunctions'

const run = (overrides: Partial<StructureFunctionConfig> = {}) => simulateStructureFunctionProgram({ ...DEFAULT_STRUCTURE_FUNCTION_CONFIG, ...overrides })

it('creates an independent parameter value and returns both fields before initializing preview', () => {
  const simulation = run()
  const frame = (phase: string) => simulation.frames.find(item => item.phase === phase)!
  const entered = frame('enter-revise')
  expect(entered.copy).toEqual({ id: 7, score: 70 })
  expect(entered.copy).not.toBe(entered.original)
  expect(frame('write-copy')).toMatchObject({ original: { id: 7, score: 70 }, copy: { id: 7, score: 88 }, preview: null, writtenObject: 'copy' })
  expect(frame('return-copy')).toMatchObject({ returnedStudent: { id: 7, score: 88 }, preview: null })
  expect(frame('receive-copy')).toMatchObject({ activeFunction: 'main', copy: null, preview: { id: 7, score: 88 }, scoreParameter: null, returnedStudent: null })
  expect(entered.copy?.score).toBe(70)
})

it.each([
  ['write-first', 'original', 96, 88, 88],
  ['rebind-first', 'preview', 70, 96, 96],
] as const)('applies %s to the active pointee and leaves selected bound to original', (writeOrder, writtenObject, original, preview, observed) => {
  const simulation = run({ writeOrder })
  const frame = (phase: string) => simulation.frames.find(item => item.phase === phase)!
  expect(frame('enter-update')).toMatchObject({ selected: 'original', target: 'original', alternate: 'preview', scoreParameter: 96 })
  const written = frame('write-target'), rebound = frame('rebind-target')
  expect(written).toMatchObject({ target: writtenObject, writtenObject, selected: 'original' })
  expect(rebound).toMatchObject({ target: 'preview', selected: 'original' })
  expect(written.index < rebound.index).toBe(writeOrder === 'write-first')
  expect(simulation.source.lines[written.activeLine - 1].code).toContain('target->score = score;')
  expect(simulation.source.lines[rebound.activeLine - 1].code).toContain('target = alternate;')
  expect(frame('return-observed')).toMatchObject({ returnedScore: observed, observed: null, target: 'preview' })
  expect(frame('receive-observed')).toMatchObject({ selected: 'original', target: null, alternate: null, scoreParameter: null, observed })
  expect(simulation.stdout).toBe(`original=${original}, preview=${preview}, selected=${original}, observed=${observed}\n`)
  expect(simulation.frames.filter(item => item.index < frame('print').index).every(item => item.printedValues === null)).toBe(true)
  expect(simulation.frames.at(-1)).toMatchObject({ phase: 'done', original: null, preview: null, selected: null, observed: null, printedValues: [original, preview] })
})

it('switches type spelling while preserving trace and accepts zero and one hundred as scores', () => {
  const alias = run({ previewScore: 0, writeScore: 100 })
  const tag = run({ typeName: 'tag', previewScore: 0, writeScore: 100 })
  expect(alias.source.sourceText).toContain('static Student revise(Student copy, int score)')
  expect(tag.source.sourceText).toContain('static struct Student revise(struct Student copy, int score)')
  expect(tag.source.sourceText).toContain('} Student;')
  expect(tag.frames).toEqual(alias.frames)
  expect(tag.stdout).toBe('original=100, preview=0, selected=100, observed=0\n')
})

it.each([{ typeName: 'constructor' }, { writeOrder: 'other' }, { previewScore: -1 }, { previewScore: '88' }, { writeScore: 101 }, { writeScore: 0.5 }])('safely stops for invalid settings %j', overrides => {
  const simulation = run(overrides as Partial<StructureFunctionConfig>)
  expect(simulation).toMatchObject({ status: 'blocked', exitCode: null, stdout: '' })
  expect(simulation.frames.map(item => item.phase)).toEqual(['prepare', 'blocked'])
  expect(simulation.frames.every(item => item.original === null && item.selected === null)).toBe(true)
})
