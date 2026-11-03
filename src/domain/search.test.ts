import { DEFAULT_SEARCH_CONFIG, SEARCH_VALUES, simulateSearchProgram, type SearchConfig } from './search'

describe('linear search', () => {
  it.each([
    { mode: 'first' as const, found: 1, path: [0, 1] },
    { mode: 'last' as const, found: 3, path: [0, 1, 2, 3, 4] },
  ])('finds the $mode match for duplicates', ({ mode, found, path }) => {
    const result = simulateSearchProgram({ ...DEFAULT_SEARCH_CONFIG, mode })
    expect(result).toMatchObject({ status: 'completed', found, comparedIndices: path, comparisons: path.length, output: `index = ${found}` })
    expect(result.frames.filter(frame => frame.phase === 'record').map(frame => frame.found)).toEqual(mode === 'first' ? [1] : [1, 3])
    expect(result.frames.filter(frame => frame.phase === 'compare').map(frame => frame.activeIndex)).toEqual(path)
    const print = result.frames.find(frame => frame.phase === 'print')!
    expect(print).toMatchObject({ iInScope: false, mainInScope: true })
    expect(result.frames.slice(0, print.index).every(frame => frame.output === null)).toBe(true)
    expect(result.frames.at(-1)?.mainInScope).toBe(false)
    result.frames.forEach(frame => expect(result.source.lines[frame.activeLine - 1]).toBeDefined())
  })
  it('breaks before increment or a second match, while the last-match search checks every cell', () => {
    const first = simulateSearchProgram()
    const exit = first.frames.findIndex(frame => frame.phase === 'break')
    expect(first.frames.slice(exit).map(frame => frame.phase)).toEqual(['break', 'print', 'return-main', 'done'])
    expect(first.frames[exit].i).toBe(1)
    const last = simulateSearchProgram({ ...DEFAULT_SEARCH_CONFIG, mode: 'last' })
    expect(last.frames.some(frame => frame.phase === 'break')).toBe(false)
    expect(last.frames.find(frame => frame.phase === 'print')?.i).toBe(5)
    expect(last.frames.filter(frame => frame.phase === 'compare').every(frame => frame.i! < 5)).toBe(true)
  })
  it('matches an independent expected index for every supported target and both modes', () => {
    for (const mode of ['first', 'last'] as const) for (let target = -5; target <= 15; target++) {
      const expected = mode === 'first' ? SEARCH_VALUES.indexOf(target) : SEARCH_VALUES.lastIndexOf(target)
      const result = simulateSearchProgram({ target, mode })
      expect(result.found).toBe(expected)
      expect(result.comparisons).toBe(mode === 'last' || expected === -1 ? 5 : expected + 1)
      expect(result.frames.filter(frame => frame.values).every(frame => frame.values!.join() === SEARCH_VALUES.join())).toBe(true)
    }
  })
  it.each(['first', 'last'] as const)('keeps -1 when %s search finds nothing', mode => {
    const result = simulateSearchProgram({ target: 9, mode })
    expect(result).toMatchObject({ found: -1, comparisons: 5, output: 'index = -1' })
    expect(result.frames.some(frame => frame.phase === 'record')).toBe(false)
    expect(result.frames.filter(frame => frame.activeIndex !== null).every(frame => frame.activeIndex! >= 0 && frame.activeIndex! < 5)).toBe(true)
  })
  it.each([-6, 16, 1.5, NaN, Infinity])('blocks invalid target %s before initialization', target => {
    const result = simulateSearchProgram({ target, mode: 'first' })
    expect(result).toMatchObject({ status: 'blocked', found: null, comparisons: 0, output: null })
    expect(result.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(result.source.sourceText).not.toMatch(/NaN|Infinity/)
  })
  it('rejects runtime enum input and independently copies config and snapshots', () => {
    const invalid = simulateSearchProgram({ target: 7, mode: 'unsafe();' as SearchConfig['mode'] })
    expect(invalid.status).toBe('blocked')
    expect(invalid.source.sourceText).not.toContain('unsafe();')
    const config = { ...DEFAULT_SEARCH_CONFIG }
    const result = simulateSearchProgram(config)
    config.target = 4
    expect(result.config.target).toBe(7)
    const comparison = result.frames.find(frame => frame.phase === 'compare')!
    const next = result.frames[comparison.index + 1]
    expect(comparison.values).not.toBe(next.values)
    expect(comparison.comparedIndices).not.toBe(next.comparedIndices)
    ;(comparison.values as number[])[0] = 99
    expect(next.values![0]).toBe(4)
    expect(SEARCH_VALUES[0]).toBe(4)
  })
})
