import { DEFAULT_SCORE_FILE_CONFIG, SCORE_BUFFER_SIZE, SCORE_FILE_DATASETS, SCORE_FILE_OUTCOMES, buildScoreFileSource, simulateScoreFileProgram, validateScoreFileConfig, type ScoreFileConfig } from './scoreFile'

const run = (overrides: Partial<ScoreFileConfig> = {}) => simulateScoreFileProgram({ ...DEFAULT_SCORE_FILE_CONFIG, ...overrides })
it.each([
  ['mixed', 3, 3, 180, '60.00'], ['clean', 3, 0, 240, '80.00'], ['spaces', 2, 2, 125, '62.50'],
  ['zero', 2, 0, 0, '0.00'], ['empty', 0, 0, 0, 'N/A'], ['blank', 0, 2, 0, 'N/A'],
  ['long', 1, 1, 90, '90.00'], ['boundary', 2, 0, 170, '85.00'], ['overflow', 1, 2, 42, '42.00'],
] as const)('validates whole records in %s and reports independently expected totals', (dataset, accepted, rejected, sum, average) => {
  const result = run({ dataset })
  expect(result).toMatchObject({ status: 'completed', accepted, rejected, sum, exitCode: 0, stopped: false, closeCalls: 1, position: SCORE_FILE_DATASETS[dataset].text.length })
  expect(result.stdout).toBe(`complete\naccepted=${accepted}, rejected=${rejected}, sum=${sum}\naverage=${average}\n`)
  expect(result.records).toHaveLength(accepted + rejected)
})
it('records the first failing validation stage and includes valid zero', () => {
  expect(run().records).toEqual([
    { index: 0, text: '80', reason: 'accepted', value: '80' },
    { index: 1, text: 'abc', reason: 'no-digits', value: '0' },
    { index: 2, text: '100', reason: 'accepted', value: '100' },
    { index: 3, text: '-5', reason: 'score-range', value: '-5' },
    { index: 4, text: '70x', reason: 'trailing-data', value: '70' },
    { index: 5, text: '0', reason: 'accepted', value: '0' },
  ])
  expect(run({ dataset: 'overflow' }).records.map(record => record.reason)).toEqual(['long-range', 'long-range', 'accepted'])
})
it('never accepts a valid truncated prefix and drains exactly one too-long record', () => {
  const result = run({ dataset: 'long' })
  const marked = result.frames.find(frame => frame.phase === 'too-long')!
  expect(marked).toMatchObject({ used: 11, tooLong: true, accepted: 0, rejected: 0, sum: 0 })
  expect(marked.buffer).toHaveLength(SCORE_BUFFER_SIZE)
  expect(marked.buffer?.at(-1)).toBeNull()
  const terminated = result.frames.find(frame => frame.phase === 'terminate')!
  expect(terminated).toMatchObject({ position: 14, used: 11, terminated: true })
  expect(terminated.buffer?.at(-1)).toBe('\0')
  const converted = result.frames.find(frame => frame.phase === 'convert')!
  expect(converted).toMatchObject({ value: '0', errno: '0', valid: false })
  const checked = result.frames.find(frame => frame.phase === 'check-score')!
  expect(checked).toMatchObject({ valid: false, condition: { value: false } })
  expect(result.records.map(record => [record.text, record.reason])).toEqual([['0000000000080', 'too-long'], ['90', 'accepted']])
  expect(result).toMatchObject({ accepted: 1, rejected: 1, sum: 90 })
})
it('accepts a full eleven-character record and a final record without newline', () => {
  expect(run({ dataset: 'boundary' }).frames.some(frame => frame.phase === 'too-long')).toBe(false)
  const result = run({ dataset: 'clean' })
  expect(result.records.at(-1)).toMatchObject({ text: '100', reason: 'accepted' })
  expect(result.frames.filter(frame => frame.phase === 'terminate')).toHaveLength(3)
  expect(result.frames.at(-1)?.records).toHaveLength(3)
  expect(result.frames.find(frame => frame.phase === 'final-eof' && frame.ch === 'EOF')?.condition?.value).toBe(true)
})
it('distinguishes empty file, blank lines, and zero scores without dividing by zero', () => {
  const empty = run({ dataset: 'empty' }), blank = run({ dataset: 'blank' }), zero = run({ dataset: 'zero' })
  expect(empty.records).toEqual([])
  expect(blank.records.map(record => record.reason)).toEqual(['no-digits', 'no-digits'])
  for (const result of [empty, blank]) {
    expect(result.average).toBeNull()
    expect(result.frames.some(frame => frame.phase === 'print-average')).toBe(false)
    expect(result.frames.find(frame => frame.phase === 'average-condition')?.condition?.value).toBe(false)
    expect(result.stdout).toContain('average=N/A')
  }
  expect(zero).toMatchObject({ accepted: 2, sum: 0, average: 0 })
  expect(zero.stdout).toContain('average=0.00')
})
it('allows fractional averages by converting before division and excludes rejected records', () => {
  expect(run({ dataset: 'spaces' }).average).toBe(62.5)
  expect(buildScoreFileSource().sourceText).toContain('(double)sum / accepted')
  expect(run({ dataset: 'spaces' }).frames.filter(frame => frame.phase === 'advance-end')).toHaveLength(2)
})
it('marks early-stop output as partial, counts the bad record once, and still closes', () => {
  const result = run({ stopOnInvalid: true })
  expect(result).toMatchObject({ accepted: 1, rejected: 1, sum: 80, stopped: true, position: 7, exitCode: 3, closeCalls: 1 })
  expect(result.stdout).toBe('partial\naccepted=1, rejected=1, sum=80\naverage=80.00\n')
  expect(result.records.map(record => record.text)).toEqual(['80', 'abc'])
  expect(result.frames.find(frame => frame.phase === 'capture-error')).toMatchObject({ iterationInScope: false, readFailed: false })
  const long = run({ dataset: 'long', stopOnInvalid: true })
  expect(long).toMatchObject({ accepted: 0, rejected: 1, position: 14, exitCode: 3 })
  expect(long.stdout).toContain('average=N/A')
})
it('does not manufacture counters or close a null stream when opening fails', () => {
  const result = run({ outcome: 'open-failure' })
  expect(result).toMatchObject({ accepted: 0, rejected: 0, sum: 0, closeCalls: 0, attempts: 0, exitCode: 1, position: null, stdout: 'open failed\n' })
  expect(result.frames.at(-2)).toMatchObject({ accepted: null, rejected: null, buffer: null, pointer: 'null' })
})
it('drops a partial record on read error rather than validating or rejecting it', () => {
  const result = run({ outcome: 'read-failure' })
  expect(result).toMatchObject({ position: 4, accepted: 1, rejected: 0, sum: 80, average: null, closeCalls: 1, exitCode: 2, stdout: 'I/O failed\n' })
  expect(result.records.map(record => record.text)).toEqual(['80'])
  const failed = result.frames.find(frame => frame.phase === 'read-error' && frame.condition?.value)!
  expect(failed).toMatchObject({ ch: 'EOF', error: true, eof: false, used: 1, terminated: false, value: null })
  expect(failed.buffer?.[0]).toBe('a')
  expect(result.frames.filter(frame => frame.phase === 'terminate')).toHaveLength(1)
  expect(result.frames.some(frame => frame.phase === 'print-summary')).toBe(false)
})
it('does not inject a read error after the program has already stopped', () => {
  const result = run({ dataset: 'blank', outcome: 'read-failure', stopOnInvalid: true })
  expect(result).toMatchObject({ position: 1, attempts: 1, rejected: 1, exitCode: 3, closeCalls: 1 })
  expect(result.frames.find(frame => frame.phase === 'capture-error')?.readFailed).toBe(false)
})
it('prioritizes close failure over partial or complete reporting and invalidates fp', () => {
  for (const stopOnInvalid of [false, true]) {
    const result = run({ outcome: 'close-failure', stopOnInvalid })
    expect(result).toMatchObject({ average: null, closeCalls: 1, exitCode: 2, stdout: 'I/O failed\n' })
    expect(result.frames.find(frame => frame.phase === 'close')).toMatchObject({ pointer: 'invalidated', streamStatus: 'disassociated', eof: null, error: null, readFailed: false, closeFailed: true })
    expect(result.frames.some(frame => frame.phase === 'print-status')).toBe(false)
  }
})
it('updates sum after accepted, preserves old buffer tail, and reveals predictions only at main return', () => {
  const result = run()
  expect(result.frames.find(frame => frame.phase === 'accept')).toMatchObject({ accepted: 1, sum: 0 })
  expect(result.frames.find(frame => frame.phase === 'sum')).toMatchObject({ accepted: 1, sum: 80 })
  const resets = result.frames.filter(frame => frame.phase === 'reset')
  expect(resets[0]).toMatchObject({ used: 0, tooLong: false, terminated: false })
  expect(resets[0].buffer?.slice(0, 3)).toEqual(['8', '0', '\0'])
  for (const frame of result.frames) {
    if (!['return', 'return-open', 'return-io', 'done'].includes(frame.phase)) expect(frame.predictionValues).toBeNull()
    expect(frame.activeLine).toBeGreaterThan(0)
    expect(frame.activeLine).toBeLessThanOrEqual(result.source.lines.length)
    expect(frame.activePart).toBe(`line-${frame.activeLine}`)
  }
  expect(result.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false, iterationInScope: false, predictionValues: [3, 3, 180] })
  expect(result.frames[0].records).toEqual([])
  expect(result.frames[0].output).toEqual([])
})
it('maps tagged trace steps to the displayed C statements and guards array writes', () => {
  const source = buildScoreFileSource({ ...DEFAULT_SCORE_FILE_CONFIG, stopOnInvalid: true })
  const line = (key: keyof typeof source.locations) => source.lines[source.locations[key] - 1].code
  expect(line('policy')).toBe('  int stop_on_invalid = 1;')
  expect(line('capacity')).toContain('used < sizeof line - 1')
  expect(line('terminate')).toContain("line[used] = '\\0'")
  expect(line('tail-condition')).toContain('isspace((unsigned char)*end)')
  expect(line('read-error')).toContain('ch == EOF && ferror(fp)')
  expect(source.locations['capture-error']).toBeLessThan(source.locations.close)
  expect(source.locations['check-io']).toBeLessThan(source.locations['print-summary'])
  expect(source.locations['average-condition']).toBeLessThan(source.locations['print-average'])
})
it.each([
  { dataset: 'constructor' }, { dataset: { toString: null } }, { outcome: 'unknown' }, { outcome: { toString: null } },
  { stopOnInvalid: 'false' }, { stopOnInvalid: 0 },
])('blocks untrusted configuration without opening a stream: %j', overrides => {
  const config = { ...DEFAULT_SCORE_FILE_CONFIG, ...overrides } as ScoreFileConfig
  expect(validateScoreFileConfig(config).length).toBeGreaterThan(0)
  const result = simulateScoreFileProgram(config)
  expect(result).toMatchObject({ status: 'blocked', closeCalls: 0, attempts: 0, exitCode: null, records: [] })
  expect(result.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
})
it('preserves its finite-data contract and accounting across every configuration', () => {
  for (const dataset of Object.keys(SCORE_FILE_DATASETS) as ScoreFileConfig['dataset'][]) for (const outcome of Object.keys(SCORE_FILE_OUTCOMES) as ScoreFileConfig['outcome'][]) for (const stopOnInvalid of [false, true]) {
    const config = Object.freeze({ dataset, outcome, stopOnInvalid })
    const result = simulateScoreFileProgram(config)
    expect(result.status).toBe('completed')
    expect(result.accepted + result.rejected).toBe(result.records.length)
    expect(result.records.length).toBeLessThanOrEqual(6)
    expect(result.sum).toBeGreaterThanOrEqual(0)
    expect(result.sum).toBeLessThanOrEqual(result.accepted * 100)
    expect(result.closeCalls).toBe(outcome === 'open-failure' ? 0 : 1)
    expect(result.position ?? 0).toBeLessThanOrEqual(SCORE_FILE_DATASETS[dataset].text.length)
    for (const frame of result.frames) if (frame.buffer) expect(frame.buffer.length).toBe(12)
    expect(config).toEqual({ dataset, outcome, stopOnInvalid })
  }
})
