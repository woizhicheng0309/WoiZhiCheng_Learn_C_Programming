import { DEFAULT_SELECTION_SORT_CONFIG, SORT_SAMPLES, simulateSelectionSortProgram, type SelectionSortConfig } from './selectionSort'

describe('selection sort', () => {
  it.each(Object.keys(SORT_SAMPLES).flatMap(sample => ['ascending', 'descending'].map(order => ({ sample, order }))) as SelectionSortConfig[])('sorts $sample in $order order while preserving every element', config => {
    const initial = [...SORT_SAMPLES[config.sample]]
    const expected = [...initial].sort((a, b) => config.order === 'ascending' ? a - b : b - a)
    const result = simulateSelectionSortProgram(config)
    expect(result).toMatchObject({ status: 'completed', values: expected, output: expected, comparisons: 10 })
    expect(result.swaps).toBeLessThanOrEqual(4)
    expect(result.frames.filter(frame => frame.phase === 'compare')).toHaveLength(10)
    expect(result.frames.filter(frame => frame.phase === 'end-pass').map(frame => frame.sortedCount)).toEqual([1, 2, 3, 4])
    for (const frame of result.frames.filter(frame => frame.phase === 'end-pass')) {
      expect(frame.values!.slice(0, frame.sortedCount)).toEqual(expected.slice(0, frame.sortedCount))
      expect([...frame.values!].sort((a, b) => a - b)).toEqual([...initial].sort((a, b) => a - b))
      expect(frame.variables.best.inScope).toBe(false)
    }
    result.frames.forEach(frame => {
      expect(result.source.lines[frame.activeLine - 1]).toBeDefined()
      expect(frame.activeIndices.every(index => index >= 0 && index < 5)).toBe(true)
    })
    expect(result.frames.at(-1)).toMatchObject({ sortedCount: 5, mainInScope: false })
    expect(Object.values(result.frames.at(-1)!.variables).every(variable => !variable.inScope)).toBe(true)
  })
  it('models the temporary duplicate during the three-step swap and only reveals first-pass state at its end', () => {
    const result = simulateSelectionSortProgram()
    expect(result.firstPassValues).toEqual([1, 4, 5, 2, 3])
    expect(result.swaps).toBe(3)
    const save = result.frames.find(frame => frame.phase === 'save-temp')!
    const front = result.frames[save.index + 1]
    const back = result.frames[save.index + 2]
    expect(save).toMatchObject({ activeLine: 13, values: [4, 1, 5, 2, 3], variables: { temp: { value: 4, inScope: true } } })
    expect(front).toMatchObject({ phase: 'write-front', activeLine: 14, values: [1, 1, 5, 2, 3], swaps: 0 })
    expect(back).toMatchObject({ phase: 'write-best', activeLine: 15, values: [1, 4, 5, 2, 3], swaps: 1 })
    expect(result.frames[save.index + 3].variables.temp.inScope).toBe(false)
    const firstPass = result.frames.find(frame => frame.phase === 'end-pass')!
    expect(result.frames.slice(0, firstPass.index).every(frame => frame.firstPassValues === null)).toBe(true)
    expect(firstPass.firstPassValues).toEqual([1, 4, 5, 2, 3])
    expect(result.frames.filter(frame => frame.firstPassValues).every(frame => frame.firstPassValues!.join() === '1,4,5,2,3')).toBe(true)
  })
  it('skips self-swaps on already sorted data but still performs ten element comparisons', () => {
    const result = simulateSelectionSortProgram({ sample: 'sorted', order: 'ascending' })
    expect(result).toMatchObject({ swaps: 0, comparisons: 10 })
    expect(result.frames.some(frame => frame.phase === 'save-temp')).toBe(false)
    expect(result.frames.filter(frame => frame.phase === 'check-swap')).toHaveLength(4)
    expect(result.frames.filter(frame => frame.phase === 'compare').map(frame => frame.variables.j.value)).toEqual([1, 2, 3, 4, 2, 3, 4, 3, 4, 4])
    expect(result.frames.filter(frame => frame.phase === 'check-swap').every(frame => !frame.variables.j.inScope && frame.variables.best.inScope)).toBe(true)
  })
  it('blocks invalid runtime enums and does not put them into C source', () => {
    for (const config of [{ sample: 'unsafe();', order: 'ascending' }, { sample: '__proto__', order: 'ascending' }, { sample: 'mixed', order: 'unsafe();' }]) {
      const result = simulateSelectionSortProgram(config as SelectionSortConfig)
      expect(result).toMatchObject({ status: 'blocked', values: null, output: [], comparisons: 0 })
      expect(result.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
      expect(result.source.sourceText).not.toMatch(/unsafe|__proto__/)
    }
  })
  it('copies config, each variable, arrays and first-pass snapshots independently', () => {
    const config = { ...DEFAULT_SELECTION_SORT_CONFIG }
    const result = simulateSelectionSortProgram(config)
    config.order = 'descending'
    expect(result.config.order).toBe('ascending')
    const frame = result.frames.find(item => item.phase === 'save-temp')!
    const next = result.frames[frame.index + 1]
    expect(frame.values).not.toBe(next.values)
    expect(frame.variables.temp).not.toBe(next.variables.temp)
    expect(result.firstPassValues).not.toBe(result.frames.at(-1)?.firstPassValues)
    ;(frame.values as number[])[0] = 99
    expect(next.values![0]).toBe(1)
    expect(SORT_SAMPLES.mixed[0]).toBe(4)
  })
})
