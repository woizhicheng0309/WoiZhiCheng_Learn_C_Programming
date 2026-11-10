import { DEFAULT_RECORD_FILE_CONFIG, simulateRecordFileProgram, type RecordFileConfig } from './recordFile'

const run = (overrides: Partial<RecordFileConfig> = {}) => simulateRecordFileProgram({ ...DEFAULT_RECORD_FILE_CONFIG, ...overrides })

it('commits a struct after both conversions and rejects records with extra fields', () => {
  const simulation = run()
  const row = (number: number, phase: string) => simulation.frames.find(item => item.row === number && item.phase === phase)!
  expect(row(1, 'parse-id')).toMatchObject({ idValue: '10', end: 2, scoreValue: null, record: null })
  expect(row(1, 'parse-score')).toMatchObject({ idValue: '10', scoreValue: '80', end: 5, record: null })
  expect(row(1, 'store')).toMatchObject({ record: { id: 10, score: 80 }, end: 6 })
  expect(row(6, 'tail')).toMatchObject({ scoreValue: '88', end: 5, record: null })
  expect(simulation.frames.at(-1)?.decisions.map(item => item.result)).toEqual(['written', 'separator', 'id', 'score', 'below', 'tail', 'written'])
  expect(simulation).toMatchObject({ valid: 3, rejected: 4, written: 2, exitCode: 0, outputStatus: 'confirmed', outputText: '10,80\n15,100\n' })
  expect(simulation.stdout).toBe('valid=3, rejected=4, written=2\n')
})

it('accepts an exactly full valid line, drains a longer line, and normalizes numbers on output', () => {
  const simulation = run({ dataset: 'boundary', minimumScore: 0 })
  expect(simulation.frames.find(item => item.phase === 'drain')).toMatchObject({ row: 2, chunk: '0000000002,0099', record: null })
  expect(simulation.frames.at(-1)?.decisions.map(item => item.result)).toEqual(['written', 'too-long', 'written', 'written'])
  expect(simulation).toMatchObject({ valid: 3, rejected: 1, written: 3, outputText: '1,60\n9999,0\n3,100\n' })
})

it('distinguishes blank lines, empty fields, trailing text, and legitimate zero', () => {
  const simulation = run({ dataset: 'malformed', minimumScore: 0 })
  expect(simulation.frames.at(-1)?.decisions.map(item => item.result)).toEqual(['id', 'score', 'tail', 'written', 'tail', 'written'])
  expect(simulation).toMatchObject({ valid: 2, rejected: 4, written: 2, outputText: '3,0\n5,60\n' })
  expect(run({ dataset: 'empty' })).toMatchObject({ valid: 0, rejected: 0, written: 0, outputStatus: 'confirmed', outputText: '', exitCode: 0 })
})

it.each([
  ['input-open-failure', 1, 'absent', 0],
  ['output-open-failure', 2, 'absent', 0],
  ['read-failure', 3, 'incomplete', 0],
  ['write-failure', 3, 'incomplete', 1],
] as const)('finishes safely on %s', (outcome, exitCode, outputStatus, valid) => {
  const simulation = run({ outcome })
  expect(simulation).toMatchObject({ exitCode, outputStatus, valid, written: 0, outputText: '' })
  expect(simulation.frames.at(-1)).toMatchObject({ record: null, inputStatus: outcome === 'input-open-failure' ? 'absent' : 'closed' })
  if (outcome === 'write-failure') {
    expect(simulation.frames.at(-1)?.decisions).toEqual([{ row: 1, text: '10,80', result: 'write-error' }])
  }
})

it('distinguishes buffered output from a successful close and reports close failure', () => {
  const simulation = run({ outcome: 'close-failure' })
  expect(simulation.frames.filter(item => item.phase === 'written').every(item => item.outputStatus === 'open')).toBe(true)
  expect(simulation).toMatchObject({ written: 2, outputText: '10,80\n15,100\n', outputStatus: 'unconfirmed', exitCode: 3, stdout: 'I/O failed\n' })
  expect(run({ outcome: 'write-failure', dataset: 'empty' })).toMatchObject({ exitCode: 0, outputStatus: 'confirmed' })
})

it.each([{ dataset: 'constructor' }, { outcome: 'unknown' }, { minimumScore: -1 }, { minimumScore: 101 }])('blocks invalid configuration %j', overrides => {
  const simulation = run(overrides as Partial<RecordFileConfig>)
  expect(simulation).toMatchObject({ status: 'blocked', exitCode: null, outputStatus: 'absent' })
  expect(simulation.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
})
