import { DEFAULT_GRADEBOOK_CONFIG, simulateGradebookProject, type GradebookConfig } from './gradebookProject'

const run = (overrides: Partial<GradebookConfig> = {}) => simulateGradebookProject({ ...DEFAULT_GRADEBOOK_CONFIG, ...overrides })

it('preserves first entries, checks duplicates before capacity, and searches only used slots', () => {
  const simulation = run()
  const last = simulation.frames.at(-1)
  expect(last).toMatchObject({ used: 4, invalid: 1, duplicates: 1, full: 1, queryIndex: 1 })
  expect(last?.slots).toEqual([{ id: 101, score: 75 }, { id: 205, score: 90 }, { id: 330, score: 0 }, { id: 444, score: 88 }])
  expect(last?.decisions.map(item => item.result)).toEqual(['inserted', 'inserted', 'invalid', 'inserted', 'inserted', 'duplicate', 'full'])
  expect(simulation.frames.filter(item => item.probe?.purpose === 'query').map(item => item.probe?.index)).toEqual([0, 1])
  expect(simulation.frames.every(item => !item.probe || item.probe.index < item.used)).toBe(true)
  expect(simulation).toMatchObject({ exitCode: 0, reportStatus: 'confirmed', report: '205,90\n', stdout: 'used=4, invalid=1, duplicates=1, full=1, index=1\n' })
})

it('updates an existing slot even at capacity when the optional policy is enabled', () => {
  const simulation = run({ queryId: 101, updateDuplicate: true })
  const before = simulation.frames.find(item => item.phase === 'duplicate-found')!
  const update = simulation.frames.find(item => item.phase === 'update')!
  expect(before.slots[0]).toEqual({ id: 101, score: 75 })
  expect(update.slots[0]).toEqual({ id: 101, score: 99 })
  expect(update.used).toBe(4)
  expect(update.decisions.at(-1)?.result).toBe('updated')
  expect(simulation.report).toBe('101,99\n')
  expect(run({ queryId: 101 }).report).toBe('101,75\n')
})

it('drains a long row and stops a missing lookup before the unfilled slot', () => {
  const simulation = run({ dataset: 'sparse', queryId: 9999 })
  expect(simulation.frames.at(-1)).toMatchObject({ used: 3, invalid: 2, duplicates: 0, full: 0, queryIndex: -1 })
  expect(simulation.frames.at(-1)?.decisions.map(item => item.result)).toEqual(['inserted', 'invalid', 'inserted', 'long', 'inserted'])
  expect(simulation.frames.filter(item => item.probe?.purpose === 'query').map(item => item.probe?.index)).toEqual([0, 1, 2])
  expect(simulation).toMatchObject({ exitCode: 0, reportStatus: 'confirmed', report: '' })
  expect(run({ dataset: 'sparse', queryId: 330 }).report).toBe('330,0\n')
})

it('completes a lookup on an empty table without comparisons or a report write', () => {
  const simulation = run({ dataset: 'empty', outcome: 'report-write-failure' })
  expect(simulation.frames.some(item => item.phase === 'compare')).toBe(false)
  expect(simulation.frames.at(-1)).toMatchObject({ used: 0, queryIndex: -1 })
  expect(simulation).toMatchObject({ exitCode: 0, report: '', reportStatus: 'confirmed' })
})

it.each([
  ['input-open-failure', 1, 'absent', null, ''],
  ['input-read-failure', 2, 'absent', null, ''],
  ['report-open-failure', 3, 'absent', 1, ''],
  ['report-write-failure', 4, 'incomplete', 1, ''],
  ['report-close-failure', 4, 'unconfirmed', 1, '205,90\n'],
] as const)('stops at the correct I/O stage for %s', (outcome, exitCode, reportStatus, queryIndex, report) => {
  const simulation = run({ outcome })
  expect(simulation).toMatchObject({ exitCode, reportStatus, report })
  expect(simulation.frames.at(-1)?.queryIndex).toBe(queryIndex)
  expect(simulation.frames.some(item => item.phase === 'close-report')).toBe(exitCode === 4)
  expect(simulation.frames.some(item => item.phase === 'close-input')).toBe(exitCode !== 1)
})

it.each([{ dataset: 'constructor' }, { queryId: -1 }, { queryId: 102 }, { updateDuplicate: 'true' }])('blocks invalid configuration %j', overrides => {
  const simulation = run(overrides as Partial<GradebookConfig>)
  expect(simulation).toMatchObject({ status: 'blocked', reportStatus: 'absent', exitCode: null })
  expect(simulation.frames.map(item => item.phase)).toEqual(['prepare', 'blocked'])
})
