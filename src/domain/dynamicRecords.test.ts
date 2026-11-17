import { DEFAULT_DYNAMIC_RECORDS_CONFIG, DYNAMIC_RECORD_SAMPLES, simulateDynamicRecords, type DynamicRecordsConfig } from './dynamicRecords'
const run = (overrides: Partial<DynamicRecordsConfig> = {}) => simulateDynamicRecords({ ...DEFAULT_DYNAMIC_RECORDS_CONFIG, ...overrides })

it('grows at full capacity, preserves complete records, and frees only the last block', () => {
  const simulation = run()
  expect(simulation).toMatchObject({ status: 'completed', attempts: 3, releases: 1, capacityBeforeFree: 8, exitCode: 0, accepted: DYNAMIC_RECORD_SAMPLES.mixed.rows })
  expect(simulation.frames.filter(f => f.phase === 'capacity').map(f => f.capacity)).toEqual([2, 4, 8])
  const lastAppend = simulation.frames.filter(f => f.phase === 'appended').at(-1)!
  expect(lastAppend.rows).toEqual([...DYNAMIC_RECORD_SAMPLES.mixed.rows, null, null])
  expect(simulation.output).toBe('used=6, capacity=8\n101,75\n205,90\n330,0\n444,88\n509,100\n610,60\n')
  const freed = simulation.frames.find(f => f.phase === 'free')!
  expect(freed).toMatchObject({ rows: null, data: '失效，待清空', releases: 1 })
  expect(simulation.frames.at(-1)).toMatchObject({ phase: 'done', used: null, capacity: null, data: '—', rows: null, exitCode: 0 })
})

it('keeps the initialized prefix while new storage is uninitialized and the old pointer is invalid', () => {
  const simulation = run()
  const resized = simulation.frames.filter(f => f.phase === 'resized')[1]
  expect(resized).toMatchObject({ used: 2, capacity: 2, data: '失效，待接回', temp: 'B2', next: 4 })
  expect(resized.rows).toEqual([...DYNAMIC_RECORD_SAMPLES.mixed.rows.slice(0, 2), null, null])
  const write = simulation.frames.find(f => f.phase === 'write')!
  expect(write).toMatchObject({ used: 0, temp: '—', next: null, rows: [DYNAMIC_RECORD_SAMPLES.mixed.rows[0], null] })
  expect(simulation.source.lines[write.activeLine - 1].code).toContain('list->data[list->used] = value;')
  const increment = simulation.frames.find(f => f.phase === 'increment')!
  expect(increment.used).toBe(1)
  expect(simulation.frames[0].rows).toBeNull()
  expect(simulation.frames.find(f => f.phase === 'resized')!.rows).toEqual([null, null])
})

it.each([[1, 0, 0, 0], [2, 2, 2, 1], [3, 4, 4, 1]])('preserves the owner on allocation failure %i', (failAt, used, capacity, releases) => {
  const simulation = run({ failAt })
  const failed = simulation.frames.find(f => f.phase === 'check' && f.temp === 'NULL')!
  expect(failed).toMatchObject({ used, capacity, data: used ? `B${failAt - 1}` : 'NULL' })
  expect(simulation).toMatchObject({ accepted: DYNAMIC_RECORD_SAMPLES.mixed.rows.slice(0, used), capacityBeforeFree: capacity, attempts: failAt, exitCode: 1, releases })
  expect(simulation.output).toContain(`append failed at index=${used}\nused=${used}, capacity=${capacity}\n`)
  expect(simulation.frames.filter(f => f.phase === 'write')).toHaveLength(used)
})

it('skips allocation for zero inputs and ignores a failure request that is never reached', () => {
  expect(run({ count: 0, failAt: 1 })).toMatchObject({ attempts: 0, releases: 0, exitCode: 0, output: 'used=0, capacity=0\n' })
  expect(run({ count: 2, failAt: 2 })).toMatchObject({ attempts: 1, releases: 1, exitCode: 0, capacityBeforeFree: 2 })
})

it('compares exact growth with doubling without changing the accepted values', () => {
  const exact = run({ growth: 'exact' })
  expect(exact).toMatchObject({ attempts: 6, capacityBeforeFree: 6, accepted: DYNAMIC_RECORD_SAMPLES.mixed.rows, releases: 1 })
  expect(run({ growth: 'exact', failAt: 3 })).toMatchObject({ attempts: 3, capacityBeforeFree: 2, exitCode: 1, accepted: DYNAMIC_RECORD_SAMPLES.mixed.rows.slice(0, 2) })
})

it('maintains bounds and matches an independent list model across every supported configuration', () => {
  for (const sample of Object.keys(DYNAMIC_RECORD_SAMPLES) as DynamicRecordsConfig['sample'][]) {
    for (const growth of ['double', 'exact'] as const) for (let count = 0; count <= 6; count++) for (let failAt = 0; failAt <= 3; failAt++) {
      let capacity = 0, accepted = 0, attempts = 0, exitCode = 0
      while (accepted < count) {
        if (capacity === accepted) { attempts++; if (attempts === failAt) { exitCode = 1; break }; capacity = growth === 'exact' ? accepted + 1 : capacity === 0 ? 2 : capacity * 2 }
        accepted++
      }
      const simulation = run({ sample, growth, count, failAt })
      expect(simulation).toMatchObject({ attempts, capacityBeforeFree: capacity, exitCode, accepted: DYNAMIC_RECORD_SAMPLES[sample].rows.slice(0, accepted) })
      for (const frame of simulation.frames) {
        if (frame.used !== null && frame.capacity !== null) { expect(frame.used).toBeLessThanOrEqual(frame.capacity); expect(frame.used).toBeGreaterThanOrEqual(0) }
        if (frame.rows) for (let i = 0; i < (frame.used ?? 0); i++) expect(frame.rows[i]).toEqual(DYNAMIC_RECORD_SAMPLES[sample].rows[i])
        expect(frame.activeLine).toBeGreaterThan(0)
        expect(frame.activeLine).toBeLessThanOrEqual(simulation.source.lines.length)
      }
    }
  }
})

it.each([{ count: -1 }, { count: 7 }, { failAt: 4 }, { failAt: 1.5 }, { growth: { toString: null } }, { sample: 'unknown' }])('blocks malformed controls before creating storage: %j', overrides => {
  const simulation = run(overrides as Partial<DynamicRecordsConfig>)
  expect(simulation).toMatchObject({ status: 'blocked', attempts: 0, releases: 0, exitCode: null, output: '' })
  expect(simulation.frames.at(-1)).toMatchObject({ phase: 'blocked', data: '—', rows: null })
})
