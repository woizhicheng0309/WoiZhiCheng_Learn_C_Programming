import { INSERTION_SAMPLES, DEFAULT_INSERTION_SORT_CONFIG, simulateInsertionSortProgram, type InsertionSortConfig } from './insertionSort'

describe('insertion sort and guarded shifting', () => {
  it.each(Object.keys(INSERTION_SAMPLES).flatMap(sample => ['ascending', 'descending'].map(order => ({ sample, order }))) as InsertionSortConfig[])('sorts $sample in $order order without losing the saved key', config => {
    const initial = [...INSERTION_SAMPLES[config.sample]]
    const expected = [...initial].sort((a, b) => config.order === 'ascending' ? a - b : b - a)
    const result = simulateInsertionSortProgram(config)
    expect(result).toMatchObject({ status: 'completed', values: expected, output: expected })
    let inversions = 0
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      if (config.order === 'ascending' ? initial[i] > initial[j] : initial[i] < initial[j]) inversions++
    }
    expect(result.shifts).toBe(inversions)
    expect(result.comparisons).toBeGreaterThanOrEqual(result.shifts)
    expect(result.comparisons).toBeLessThanOrEqual(result.shifts + 4)
    const passes = result.frames.filter(frame => frame.phase === 'end-pass')
    expect(passes.map(frame => frame.sortedCount)).toEqual([2, 3, 4, 5])
    for (const frame of passes) {
      expect(frame.values!.slice(0, frame.sortedCount)).toEqual(initial.slice(0, frame.sortedCount).sort((a, b) => config.order === 'ascending' ? a - b : b - a))
      expect(frame.variables.key.inScope).toBe(false)
      expect(frame.variables.j.inScope).toBe(false)
    }
    for (const frame of result.frames) {
      expect(result.source.lines[frame.activeLine - 1]).toBeDefined()
      expect(frame.activeIndices.every(index => index >= 0 && index < 5)).toBe(true)
      if (frame.holeIndex !== null) {
        const recovered = frame.values!.filter((_, index) => index !== frame.holeIndex).concat(frame.variables.key.value!)
        expect(recovered.sort((a, b) => a - b)).toEqual([...initial].sort((a, b) => a - b))
      }
    }
    expect(result.frames.at(-1)).toMatchObject({ mainInScope: false, holeIndex: null, sortedCount: 5 })
    expect(Object.values(result.frames.at(-1)!.variables).every(variable => !variable.inScope)).toBe(true)
  })
  it('short-circuits at j = -1 and writes key to index zero instead of reading the negative index', () => {
    const result = simulateInsertionSortProgram({ sample: 'reverse', order: 'ascending' })
    expect(result).toMatchObject({ comparisons: 10, shifts: 10 })
    const guards = result.frames.filter(frame => frame.phase === 'check-index' && frame.variables.j.value === -1)
    expect(guards).toHaveLength(4)
    for (const frame of guards) {
      expect(frame).toMatchObject({ activePart: 'index-guard', activeIndices: [] })
      expect(result.frames[frame.index + 1]).toMatchObject({ phase: 'write-key', activeIndices: [0] })
    }
    expect(result.frames.filter(frame => frame.phase === 'compare-value').every(frame => frame.variables.j.value! >= 0 && frame.activePart === 'value-compare')).toBe(true)
  })
  it('preserves key while a right shift temporarily duplicates an array value', () => {
    const result = simulateInsertionSortProgram()
    const firstShift = result.frames.find(frame => frame.phase === 'shift')!
    expect(firstShift).toMatchObject({ activeLine: 9, values: [4, 4, 1, 5, 2], holeIndex: 0, variables: { key: { value: 3, inScope: true } } })
    expect(result.firstPassValues).toEqual([3, 4, 1, 5, 2])
    const firstPass = result.frames.find(frame => frame.phase === 'end-pass')!
    expect(result.frames.slice(0, firstPass.index).every(frame => frame.firstPassValues === null)).toBe(true)
    expect(result.frames.filter(frame => frame.firstPassValues).every(frame => frame.firstPassValues!.join() === '3,4,1,5,2')).toBe(true)
    expect(result).toMatchObject({ comparisons: 8, shifts: 6 })
  })
  it('does not shift equal elements or right-shift already sorted input', () => {
    const sorted = simulateInsertionSortProgram({ sample: 'sorted', order: 'ascending' })
    expect(sorted).toMatchObject({ comparisons: 4, shifts: 0 })
    const duplicate = simulateInsertionSortProgram({ sample: 'duplicates', order: 'ascending' })
    for (const frame of duplicate.frames.filter(frame => frame.phase === 'compare-value')) {
      if (frame.values![frame.variables.j.value!] === frame.variables.key.value) expect(duplicate.frames[frame.index + 1].phase).toBe('write-key')
    }
  })
  it('rejects invalid runtime enums and keeps source construction safe', () => {
    for (const config of [{ sample: 'unsafe();', order: 'ascending' }, { sample: '__proto__', order: 'ascending' }, { sample: 'mixed', order: 'unsafe();' }]) {
      const result = simulateInsertionSortProgram(config as InsertionSortConfig)
      expect(result).toMatchObject({ status: 'blocked', values: null, comparisons: 0, shifts: 0 })
      expect(result.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
      expect(result.source.sourceText).not.toMatch(/unsafe|__proto__/)
    }
  })
  it('copies input, variables, values and first-pass snapshots independently', () => {
    const config = { ...DEFAULT_INSERTION_SORT_CONFIG }
    const result = simulateInsertionSortProgram(config)
    config.order = 'descending'
    expect(result.config.order).toBe('ascending')
    const frame = result.frames.find(item => item.phase === 'shift')!
    const next = result.frames[frame.index + 1]
    expect(frame.variables.key).not.toBe(next.variables.key)
    expect(frame.values).not.toBe(next.values)
    expect(result.firstPassValues).not.toBe(result.frames.at(-1)?.firstPassValues)
    ;(frame.values as number[])[0] = 99
    expect(next.values![0]).toBe(4)
    expect(INSERTION_SAMPLES.mixed[0]).toBe(4)
  })
})
