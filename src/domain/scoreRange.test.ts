import { DEFAULT_SCORE_RANGE_CONFIG, SCORE_RANGE_SAMPLES, simulateScoreRangeProject, type ScoreRangeConfig } from './scoreRange'

const run = (overrides: Partial<ScoreRangeConfig> = {}) => simulateScoreRangeProject({ ...DEFAULT_SCORE_RANGE_CONFIG, ...overrides })

it('sorts complete records stably and includes all duplicate scores at either boundary', () => {
  const simulation = run({ low: 80, high: 80 })
  const sorted = simulation.frames.find(frame => frame.phase === 'sorted')!
  expect(sorted.rows).toEqual([
    { id: 16, score: 0 }, { id: 12, score: 60 }, { id: 11, score: 80 },
    { id: 13, score: 80 }, { id: 15, score: 80 }, { id: 14, score: 100 },
  ])
  expect(simulation).toMatchObject({ status: 'completed', begin: 2, end: 5, matches: 3, report: '11,80\n13,80\n15,80\n' })
  expect(simulation.output).toBe('begin=2, end=5, matches=3\n11,80\n13,80\n15,80\n')
  expect(simulation.frames[1].rows?.[0]).toEqual({ id: 11, score: 80 })
})

it('preserves a complete key through shifts and checks the left index before reading it', () => {
  const simulation = run()
  const key = simulation.frames.find(frame => frame.phase === 'save-key')!
  expect(key).toMatchObject({ key: { id: 12, score: 60 }, hole: 1 })
  const shifted = simulation.frames.find(frame => frame.phase === 'shift')!
  expect(shifted.rows?.slice(0, 2)).toEqual([{ id: 11, score: 80 }, { id: 11, score: 80 }])
  expect(shifted.key).toEqual({ id: 12, score: 60 })
  expect(shifted.hole).toBe(0)
  const guarded = simulation.frames.find(frame => frame.phase === 'sort-condition' && frame.j === -1)!
  expect(guarded.activeIndices).toEqual([])
  const inserted = simulation.frames.find(frame => frame.phase === 'insert')!
  expect(inserted.rows?.slice(0, 2)).toEqual([{ id: 12, score: 60 }, { id: 11, score: 80 }])
  expect(inserted).toMatchObject({ hole: null, sortedPrefix: 2 })
  expect(simulation.source.lines[guarded.activeLine - 1].code).toContain('j >= 0 && rows[j].score > key.score')
})

it.each([
  [75, 75, 0, 6], [0, 74, 0, 0], [76, 100, 6, 6], [0, 100, 0, 6],
] as const)('handles an all-equal input for %i through %i', (low, high, begin, end) => {
  const simulation = run({ sample: 'equal', low, high })
  expect(simulation).toMatchObject({ begin, end, matches: end - begin })
  expect(simulation.frames.some(frame => frame.phase === 'shift')).toBe(false)
  const outputFrames = simulation.frames.filter(frame => frame.phase === 'print-record')
  expect(outputFrames).toHaveLength(end - begin)
  if (begin === end) expect(simulation.report).toBe('')
})

it('does not probe an empty prefix and leaves unused rows unchanged', () => {
  const empty = run({ count: 0 })
  expect(empty).toMatchObject({ begin: 0, end: 0, matches: 0, report: '' })
  expect(empty.frames.some(frame => ['save-key', 'mid', 'compare', 'print-record'].includes(frame.phase))).toBe(false)
  const prefix = run({ count: 2, low: 0, high: 100 })
  expect(prefix.frames.find(frame => frame.phase === 'sorted')?.rows?.slice(2)).toEqual(SCORE_RANGE_SAMPLES.mixed.rows.slice(2))
  expect(prefix.report).toBe('12,60\n11,80\n')
})

it('keeps every mid in range, shrinks each half-open search, and reveals only at output', () => {
  const simulation = run({ low: 80, high: 80 })
  for (const frame of simulation.frames) {
    if (frame.search?.mid !== null && frame.search?.mid !== undefined) {
      expect(frame.search.mid).toBeGreaterThanOrEqual(0)
      expect(frame.search.mid).toBeLessThan(6)
    }
    expect(frame.activeLine).toBeGreaterThan(0)
    expect(frame.activeLine).toBeLessThanOrEqual(simulation.source.lines.length)
    expect(frame.activePart).toBe(`line-${frame.activeLine}`)
  }
  for (const kind of ['lower', 'upper']) {
    const widths = simulation.frames.filter(frame => frame.phase === 'bound-condition' && frame.search?.kind === kind)
      .map(frame => frame.search!.right - frame.search!.left)
    expect(widths.at(-1)).toBe(0)
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1])
  }
  const reveal = simulation.frames.findIndex(frame => frame.phase === 'print-summary')
  expect(simulation.frames.slice(0, reveal).every(frame => !frame.revealed && frame.output === '')).toBe(true)
  expect(simulation.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
})

it('matches independent stable filtering for every prefix and representative score ranges', () => {
  // Include duplicate boundaries, empty gaps, extremes, and the full score domain.
  for (const sample of Object.keys(SCORE_RANGE_SAMPLES) as ScoreRangeConfig['sample'][]) {
    for (let count = 0; count <= 6; count++) {
      const input = SCORE_RANGE_SAMPLES[sample].rows.slice(0, count)
      const sorted = [...input].sort((a, b) => a.score - b.score)
      for (const [low, high] of [[0, 0], [0, 100], [60, 80], [75, 75], [76, 79], [80, 80], [81, 100], [100, 100]]) {
        const simulation = run({ sample, count, low, high })
        const expected = sorted.filter(row => row.score >= low && row.score <= high)
        expect(simulation.report).toBe(expected.map(row => `${row.id},${row.score}\n`).join(''))
        expect(simulation.matches).toBe(expected.length)
        expect(simulation.begin).toBe(sorted.filter(row => row.score < low).length)
        expect(simulation.end).toBe(sorted.filter(row => row.score <= high).length)
        expect(simulation.frames.find(frame => frame.phase === 'sorted')?.rows?.slice(0, count)).toEqual(sorted)
      }
    }
  }
})

it.each([{ sample: 'constructor' }, { count: -1 }, { count: 7 }, { count: 0.5 }, { low: -1 }, { high: 101 }, { low: 90, high: 80 }])('blocks invalid settings before creating records %j', overrides => {
  const simulation = run(overrides as Partial<ScoreRangeConfig>)
  expect(simulation).toMatchObject({ status: 'blocked', begin: null, end: null, matches: null, output: '', report: '' })
  expect(simulation.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
  expect(simulation.frames.every(frame => frame.rows === null)).toBe(true)
})
