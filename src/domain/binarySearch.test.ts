import { BINARY_VALUES, DEFAULT_BINARY_SEARCH_CONFIG, simulateBinarySearchProgram } from './binarySearch'

describe('binary search and inclusive intervals', () => {
  it('checks the default middle indexes and excludes a mismatching midpoint', () => {
    const result = simulateBinarySearchProgram()
    expect(result).toMatchObject({ status: 'completed', found: 5, output: 'index = 5', inspectedIndices: [3, 5], inspections: 2 })
    expect(result.frames.find(frame => frame.phase === 'move-left')).toMatchObject({ left: 4, right: 6, mid: 3 })
    expect(result.frames.filter(frame => frame.phase === 'initialize-mid').map(frame => [frame.left, frame.right, frame.mid])).toEqual([[0, 6, 3], [4, 6, 5]])
    const exit = result.frames.findIndex(frame => frame.phase === 'break')
    expect(result.frames.slice(exit).map(frame => frame.phase)).toEqual(['break', 'print', 'return-main', 'done'])
    expect(result.frames[exit + 1]).toMatchObject({ midInScope: false, mainInScope: true, left: 4, right: 6 })
    expect(result.frames.slice(0, exit + 1).every(frame => frame.output === null)).toBe(true)
  })
  it('matches an independent linear lookup for all allowed prefixes and targets', () => {
    for (let count = 0; count <= 7; count++) for (let target = -5; target <= 25; target++) {
      const result = simulateBinarySearchProgram({ count, target })
      expect(result.found).toBe(BINARY_VALUES.slice(0, count).indexOf(target))
      expect(result.inspections).toBeLessThanOrEqual(count ? Math.floor(Math.log2(count)) + 1 : 0)
      const mids = result.frames.filter(frame => frame.phase === 'initialize-mid')
      let previousWidth = count + 1
      for (const frame of mids) {
        expect(frame.left).toBeGreaterThanOrEqual(0)
        expect(frame.right).toBeLessThan(count)
        expect(frame.mid).toBeGreaterThanOrEqual(frame.left!)
        expect(frame.mid).toBeLessThanOrEqual(frame.right!)
        const width = frame.right! - frame.left! + 1
        expect(width).toBeLessThan(previousWidth)
        previousWidth = width
      }
      expect(result.frames.filter(frame => frame.activeIndex !== null).every(frame => frame.activeIndex! >= 0 && frame.activeIndex! < count)).toBe(true)
      expect(result.frames.at(-1)).toMatchObject({ midInScope: false, mainInScope: false })
      result.frames.forEach(frame => expect(result.source.lines[frame.activeLine - 1]).toBeDefined())
    }
  })
  it.each([
    { count: 0, target: 2, path: [], found: -1 },
    { count: 1, target: 2, path: [0], found: 0 },
    { count: 1, target: 3, path: [0], found: -1 },
    { count: 7, target: 2, path: [3, 1, 0], found: 0 },
    { count: 7, target: 18, path: [3, 5, 6], found: 6 },
    { count: 7, target: 10, path: [3, 5, 4], found: -1 },
    { count: 5, target: 15, path: [2, 3, 4], found: -1 },
  ])('handles count $count and target $target', ({ count, target, path, found }) => {
    const result = simulateBinarySearchProgram({ count, target })
    expect(result.inspectedIndices).toEqual(path)
    expect(result.found).toBe(found)
    if (found === -1) {
      const condition = result.frames.filter(frame => frame.phase === 'condition').at(-1)!
      expect(condition.left!).toBeGreaterThan(condition.right!)
    }
    expect(result.frames.filter(frame => frame.values).every(frame => frame.values!.join() === BINARY_VALUES.join())).toBe(true)
  })
  it('keeps mid local to each while body and main bounds alive through printf', () => {
    const result = simulateBinarySearchProgram({ target: 10, count: 7 })
    expect(result.frames.filter(frame => frame.phase === 'condition').every(frame => !frame.midInScope)).toBe(true)
    expect(result.frames.filter(frame => frame.phase === 'compare-equal').every(frame => frame.midInScope)).toBe(true)
    expect(result.frames.find(frame => frame.phase === 'print')).toMatchObject({ left: 4, right: 3, midInScope: false, mainInScope: true })
  })
  it.each([{ count: -1 }, { count: 8 }, { count: 1.5 }, { target: -6 }, { target: 26 }, { target: NaN }, { count: Infinity }])('blocks invalid config %j before initialization', overrides => {
    const result = simulateBinarySearchProgram({ ...DEFAULT_BINARY_SEARCH_CONFIG, ...overrides })
    expect(result).toMatchObject({ status: 'blocked', found: null, inspections: 0, output: null })
    expect(result.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(result.frames.at(-1)?.values).toBeNull()
    expect(result.source.sourceText).not.toMatch(/NaN|Infinity/)
  })
  it('copies config and snapshots independently', () => {
    const config = { ...DEFAULT_BINARY_SEARCH_CONFIG }
    const result = simulateBinarySearchProgram(config)
    config.target = 2
    expect(result.config.target).toBe(15)
    const frame = result.frames.find(item => item.phase === 'compare-equal')!
    const next = result.frames[frame.index + 1]
    expect(frame.values).not.toBe(next.values)
    expect(frame.inspectedIndices).not.toBe(next.inspectedIndices)
    ;(frame.values as number[])[0] = 99
    expect(next.values![0]).toBe(2)
    expect(BINARY_VALUES[0]).toBe(2)
  })
})
