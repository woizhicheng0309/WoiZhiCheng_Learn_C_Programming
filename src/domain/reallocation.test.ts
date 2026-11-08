import { DEFAULT_REALLOCATION_CONFIG, REALLOCATION_DATASETS, buildReallocationSource, simulateReallocationProgram, validateReallocationConfig, type ReallocationConfig } from './reallocation'

describe('reallocation, preserved data and failure handling', () => {
  for (const dataset of ['mixed', 'zeros', 'descending'] as const) for (const outcome of ['moved', 'in-place', 'failure'] as const) {
    it(`handles ${dataset} data and ${outcome} across every capacity and fill boundary`, () => {
      for (const requested of [1, 2, 3, 4, 5]) for (const fill of [0, 6, 9]) {
        const run = simulateReallocationProgram({ dataset, outcome, requested, fill })
        const values = [...REALLOCATION_DATASETS[dataset].values] as number[]
        const expected = outcome === 'failure' ? values : Array.from({ length: requested }, (_, i) => i < 3 ? values[i] : fill)
        expect(run.status).toBe('completed')
        expect(run.printedValues).toEqual([expected.length, expected.reduce((a, b) => a + b, 0)])
        expect(run.frames.filter(frame => frame.phase === 'accumulate').map(frame => (frame.activeBlock === 'A' ? frame.original : frame.resized).cells[frame.activeCell!])).toEqual(expected)
        expect(run.frames.filter(frame => frame.phase === 'initialize-new').map(frame => frame.activeCell)).toEqual(outcome !== 'failure' && requested > 3 ? Array.from({ length: requested - 3 }, (_, i) => i + 3) : [])
        expect(run.frames.filter(frame => frame.phase === 'free')).toHaveLength(1)
        expect(run.exitCode).toBe(0)
        expect(run.p).toBe('null'); expect(run.tmp).toBe('null')
      }
    })
  }
  it('ends the old lifetime and leaves expanded cells unknown until they are initialized', () => {
    const run = simulateReallocationProgram()
    const resized = run.frames.find(frame => frame.phase === 'reallocate')!
    expect(resized).toMatchObject({ p: 'invalidated', tmp: 'B', count: 3, requested: 5,
      original: { status: 'ended', cells: [], location: 'X' },
      resized: { status: 'live', cells: [4, 7, 9, null, null], location: 'Y' } })
    expect(run.frames.find(frame => frame.phase === 'adopt-result')).toMatchObject({ p: 'B', tmp: 'B', count: 3 })
    expect(run.frames.find(frame => frame.phase === 'initialize-new')!.resized.cells).toEqual([4, 7, 9, 6, null])
    expect(run.frames.find(frame => frame.phase === 'update-count')).toMatchObject({ count: 5, resized: { cells: [4, 7, 9, 6, 6] } })
    expect(run.printedValues).toEqual([5, 32])
  })
  it('requires adopting the returned pointer even when the simulated location stays the same', () => {
    const run = simulateReallocationProgram({ ...DEFAULT_REALLOCATION_CONFIG, outcome: 'in-place' })
    const resized = run.frames.find(frame => frame.phase === 'reallocate')!
    expect(resized.original.location).toBe('X')
    expect(resized.resized.location).toBe('X')
    expect(resized).toMatchObject({ p: 'invalidated', tmp: 'B', original: { status: 'ended', cells: [] }, resized: { status: 'live' } })
    expect(run.frames.find(frame => frame.phase === 'adopt-result')!.p).toBe('B')
    expect(run.printedValues).toEqual([5, 32])
  })
  it('preserves the original allocation on failure even when the requested capacity is smaller', () => {
    const run = simulateReallocationProgram({ ...DEFAULT_REALLOCATION_CONFIG, outcome: 'failure', requested: 1 })
    expect(run.frames.find(frame => frame.phase === 'reallocate')).toMatchObject({ p: 'A', tmp: 'null', count: 3, requested: 1,
      original: { status: 'live', capacity: 3, cells: [4, 7, 9] }, resized: { status: 'not-created', cells: [] } })
    expect(run.frames.some(frame => ['adopt-result', 'initialize-new', 'update-count'].includes(frame.phase))).toBe(false)
    expect(run.output).toEqual(['resize failed; original kept', 'count=3, sum=20'])
    expect(run.original.status).toBe('freed')
    expect(run.resized.status).toBe('not-created')
    expect(run.printedValues).toEqual([3, 20])
  })
  it.each([1, 2, 3])('skips the new-element loop for capacity %i and reads only the valid prefix', requested => {
    const run = simulateReallocationProgram({ ...DEFAULT_REALLOCATION_CONFIG, requested })
    expect(run.frames.find(frame => frame.phase === 'new-for-init')).toMatchObject({ i: 3, iInScope: true })
    expect(run.frames.filter(frame => frame.phase === 'new-for-condition')).toHaveLength(1)
    expect(run.frames.find(frame => frame.phase === 'new-for-condition')).toMatchObject({ condition: { value: false }, activeCell: null })
    expect(run.frames.some(frame => frame.phase === 'initialize-new')).toBe(false)
    expect(run.frames.filter(frame => frame.phase === 'accumulate').map(frame => frame.activeCell)).toEqual(Array.from({ length: requested }, (_, i) => i))
    expect(run.frames.find(frame => frame.phase === 'sum-for-init')).toMatchObject({ i: 0, iInScope: true })
    expect(run.frames.find(frame => frame.phase === 'print-result')!.iInScope).toBe(false)
  })
  it('reveals the prediction on printf and invalidates both aliases when the successful result is freed', () => {
    const run = simulateReallocationProgram()
    const print = run.frames.findIndex(frame => frame.phase === 'print-result')
    expect(run.frames.slice(0, print).every(frame => frame.printedValues === null)).toBe(true)
    expect(run.frames[print]).toMatchObject({ printedValues: [5, 32], p: 'B', tmp: 'B' })
    expect(run.frames[print + 1]).toMatchObject({ phase: 'free', p: 'invalidated', tmp: 'invalidated', resized: { status: 'freed', cells: [] } })
    expect(run.frames[print + 2]).toMatchObject({ phase: 'clear-p', p: 'null', tmp: 'invalidated' })
    expect(run.frames[print + 3]).toMatchObject({ phase: 'clear-tmp', p: 'null', tmp: 'null' })
    expect(run.frames.slice(print + 1).every(frame => frame.original.cells.length === 0 && frame.resized.cells.length === 0 && frame.activeCell === null)).toBe(true)
    expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
  })
  it('retains independent snapshots, never reads outside a live block, and does not mutate presets', () => {
    const config = { ...DEFAULT_REALLOCATION_CONFIG }
    const run = simulateReallocationProgram(config)
    const before = run.frames.find(frame => frame.phase === 'set-requested')!
    const after = run.frames.find(frame => frame.phase === 'reallocate')!
    expect(before.original.cells).toEqual([4, 7, 9])
    expect(before.resized.cells).toEqual([])
    expect(before.original).not.toBe(after.original)
    expect(before.original.cells).not.toBe(after.original.cells)
    expect(after.resized.cells).not.toBe(run.resized.cells)
    for (const frame of run.frames) if (frame.activeCell !== null) {
      const block = frame.activeBlock === 'A' ? frame.original : frame.resized
      expect(block.status).toBe('live')
      expect(frame.activeCell).toBeGreaterThanOrEqual(0)
      expect(frame.activeCell).toBeLessThan(block.capacity)
      expect(block.cells[frame.activeCell]).not.toBeNull()
    }
    config.fill = 0; config.requested = 1
    expect(run.config).toMatchObject({ fill: 6, requested: 5 })
    expect(REALLOCATION_DATASETS.mixed.values).toEqual([4, 7, 9])
  })
  it('generates the guarded temporary-pointer pattern and aligns each frame to its statement', () => {
    const source = buildReallocationSource()
    expect(source.lines).toHaveLength(33)
    expect(source.lines[13].code).toBe('  int *tmp = realloc(p, (size_t)requested * sizeof *p);')
    expect(source.lines[14].code).toBe('  if (tmp != NULL) {')
    expect(source.lines[15].code).toBe('    p = tmp;')
    expect(source.lines[19].code).toBe('    count = requested;')
    expect(source.sourceText).not.toMatch(/\bp\s*=\s*realloc|\bp\s*==\s*tmp\b|\btmp\s*==\s*p\b/)
    expect(buildReallocationSource({ ...DEFAULT_REALLOCATION_CONFIG, outcome: 'in-place' }).sourceText).toBe(source.sourceText)
    expect(buildReallocationSource({ ...DEFAULT_REALLOCATION_CONFIG, outcome: 'failure' }).sourceText).toBe(source.sourceText)
    const lineByPhase = { prepare: 4, 'enter-main': 4, 'initialize-count': 5, 'allocate-original': 6, 'check-original': 7,
      'initialize-original': 10, 'set-requested': 13, reallocate: 14, 'check-result': 15, 'adopt-result': 16,
      'new-for-init': 17, 'new-for-condition': 17, 'initialize-new': 18, 'new-for-update': 17, 'update-count': 20,
      'print-failure': 22, 'initialize-sum': 24, 'sum-for-init': 25, 'sum-for-condition': 25, accumulate: 26,
      'sum-for-update': 25, 'print-result': 28, free: 29, 'clear-p': 30, 'clear-tmp': 31, 'return-main': 32, done: 33, blocked: 4 }
    for (const outcome of ['moved', 'failure'] as const) for (const [index, frame] of simulateReallocationProgram({ ...DEFAULT_REALLOCATION_CONFIG, outcome }).frames.entries()) {
      expect(frame.index).toBe(index)
      expect(frame.activeLine).toBe(frame.phase === 'initialize-original' ? 10 + frame.activeCell! : lineByPhase[frame.phase])
      expect(frame.activePart).toBe(frame.phase.includes('-for-') ? frame.phase : `line-${frame.activeLine}`)
    }
  })
  it.each([
    { dataset: '__proto__' }, { dataset: 'constructor' }, { dataset: { toString: null } }, { dataset: null },
    { outcome: 'constructor' }, { outcome: { toString: null } }, { outcome: null },
    { requested: 0 }, { requested: 6 }, { requested: 1.5 }, { requested: '5' }, { requested: Infinity },
    { fill: -1 }, { fill: 10 }, { fill: 0.5 }, { fill: NaN }, { fill: null },
  ])('blocks invalid configuration %j before creating any allocation', change => {
    const config = { ...DEFAULT_REALLOCATION_CONFIG, ...change } as ReallocationConfig
    expect(validateReallocationConfig(config).length).toBeGreaterThan(0)
    const run = simulateReallocationProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
    expect(run.frames.every(frame => frame.original.status === 'not-created' && frame.resized.status === 'not-created' && !frame.mainInScope)).toBe(true)
    expect(run.printedValues).toBeNull()
    expect(run.exitCode).toBeNull()
    expect(run.output).toEqual([])
  })
})
