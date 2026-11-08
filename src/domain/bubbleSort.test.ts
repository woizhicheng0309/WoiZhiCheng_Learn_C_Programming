import { BUBBLE_SORT_SAMPLES, DEFAULT_BUBBLE_SORT_CONFIG, buildBubbleSortSource, simulateBubbleSortProgram, validateBubbleSortConfig, type BubbleSortConfig } from './bubbleSort'

const numericSort = (values: readonly number[]) => [...values].sort((a, b) => a - b)
const inversionCount = (values: readonly number[], descending: boolean) => values.reduce((sum, left, i) => sum + values.slice(i + 1).filter(right => descending ? left < right : left > right).length, 0)

describe('bubble sort trace', () => {
  for (const sample of Object.keys(BUBBLE_SORT_SAMPLES) as BubbleSortConfig['sample'][]) {
    for (const order of ['ascending', 'descending'] as const) {
      for (const earlyExit of [true, false]) {
        it(`sorts ${sample} ${order}, early exit ${earlyExit}, with adjacent swaps and a fixed suffix`, () => {
          const config = { sample, order, earlyExit }
          const run = simulateBubbleSortProgram(config)
          const input = BUBBLE_SORT_SAMPLES[sample]
          const expected = [...input].sort((a, b) => order === 'ascending' ? a - b : b - a)
          expect(run.status).toBe('completed')
          expect(run.output).toEqual(expected)
          expect(run.values).toEqual(expected)
          expect(run.swaps).toBe(inversionCount(input, order === 'descending'))
          expect(run.comparisons).toBeLessThanOrEqual(10)
          expect(run.passes).toBeGreaterThanOrEqual(1)
          if (!earlyExit) { expect(run.comparisons).toBe(10); expect(run.passes).toBe(4) }
          run.frames.forEach((frame, index) => {
            expect(frame.index).toBe(index)
            expect(frame.activeLine).toBeGreaterThan(0)
            expect(frame.activeLine).toBeLessThanOrEqual(run.source.lines.length)
            expect(frame.activeIndices.every(i => i >= 0 && i < 5)).toBe(true)
            if (frame.phase === 'compare') {
              const j = frame.variables.j.value!
              expect(frame.activeIndices).toEqual([j, j + 1])
              expect(j).toBeLessThan(frame.variables.end.value!)
              expect(frame.comparisons).toBe(run.frames[index - 1].comparisons + 1)
            }
            if (frame.values) {
              expect(frame.values.slice(5 - frame.sortedCount)).toEqual(expected.slice(5 - frame.sortedCount))
              if (frame.phase === 'write-left') {
                const restored = [...frame.values]
                restored[frame.variables.j.value!] = frame.variables.temp.value!
                expect(numericSort(restored)).toEqual(numericSort(input))
              } else expect(numericSort(frame.values)).toEqual(numericSort(input))
            }
          })
          expect(run.frames.filter(frame => frame.phase === 'end-pass')).toHaveLength(run.passes)
          expect(run.frames.filter(frame => frame.phase === 'compare')).toHaveLength(run.comparisons)
          expect(run.frames.filter(frame => frame.phase === 'write-right')).toHaveLength(run.swaps)
          expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false, sortedCount: 5 })
          expect(Object.values(run.frames.at(-1)!.variables).every(variable => !variable.inScope)).toBe(true)
        })
      }
    }
  }
  it('records a genuine first pass rather than the final answer and never aliases frame snapshots', () => {
    const run = simulateBubbleSortProgram()
    expect(run.firstPassValues).toEqual([1, 4, 2, 3, 5])
    expect(run).toMatchObject({ comparisons: 9, swaps: 5, passes: 3 })
    const firstPass = run.frames.findIndex(frame => frame.phase === 'end-pass')
    expect(run.frames.slice(0, firstPass).every(frame => frame.firstPassValues === null)).toBe(true)
    expect(run.frames.slice(firstPass).every(frame => frame.firstPassValues?.join() === '1,4,2,3,5')).toBe(true)
    const initialized = run.frames.find(frame => frame.phase === 'initialize-values')!
    expect(initialized.values).toEqual([4, 1, 5, 2, 3])
    expect(initialized.variables.j).toEqual({ value: null, inScope: false })
    expect(run.frames[1].values).not.toBe(run.frames[2].values)
    expect(run.frames[1].variables.end).not.toBe(run.frames[2].variables.end)
  })
  it('requires a complete no-swap pass, then breaks without updating or retesting end', () => {
    const run = simulateBubbleSortProgram({ ...DEFAULT_BUBBLE_SORT_CONFIG, sample: 'sorted' })
    expect(run).toMatchObject({ comparisons: 4, swaps: 0, passes: 1 })
    const atBreak = run.frames.findIndex(frame => frame.phase === 'break')
    expect(run.frames[atBreak].variables.end.value).toBe(4)
    expect(run.frames[atBreak].variables.swapped.value).toBe(0)
    expect(run.frames[atBreak + 1].phase).toBe('initialize-k')
    expect(run.frames.filter(frame => frame.phase === 'compare')).toHaveLength(4)
    expect(run.frames.some(frame => frame.phase === 'decrement-end')).toBe(false)
    expect(run.frames.filter(frame => frame.phase === 'outer-condition')).toHaveLength(1)
    const full = simulateBubbleSortProgram({ ...DEFAULT_BUBBLE_SORT_CONFIG, sample: 'sorted', earlyExit: false })
    expect(full).toMatchObject({ comparisons: 10, swaps: 0, passes: 4 })
    expect(full.frames.some(frame => frame.phase === 'break' || frame.phase === 'check-early-exit')).toBe(false)
    expect(full.source.sourceText).not.toContain('if (!swapped) break;')
  })
  it('resets swapped only at the beginning of each pass and skips equal-valued exchanges', () => {
    const run = simulateBubbleSortProgram({ ...DEFAULT_BUBBLE_SORT_CONFIG, sample: 'duplicates' })
    let swapped = false
    for (const frame of run.frames) {
      if (frame.phase === 'reset-swapped') { swapped = false; expect(frame.variables.swapped.value).toBe(0) }
      if (frame.phase === 'mark-swapped') swapped = true
      if (frame.phase === 'end-pass') expect(frame.variables.swapped.value).toBe(swapped ? 1 : 0)
      if (frame.phase === 'save-temp') {
        const j = frame.variables.j.value!
        expect(frame.values![j]).not.toBe(frame.values![j + 1])
      }
      if (frame.phase === 'finish-swap') expect(frame.variables.temp.inScope).toBe(false)
      if (frame.phase === 'end-pass') expect(frame.variables.j.inScope).toBe(false)
      if (frame.phase === 'finish-pass') expect(frame.variables.swapped.inScope).toBe(false)
    }
  })
  it('keeps code line mappings aligned for ascending and descending adjacent comparisons', () => {
    expect(buildBubbleSortSource().lines[7]).toEqual({ lineNumber: 8, code: '      if (values[j] > values[j + 1]) {' })
    expect(buildBubbleSortSource({ ...DEFAULT_BUBBLE_SORT_CONFIG, order: 'descending' }).lines[7].code).toContain('<')
    const run = simulateBubbleSortProgram()
    for (const [phase, line] of [['save-temp', 9], ['write-left', 10], ['write-right', 11], ['mark-swapped', 12], ['check-early-exit', 15], ['print', 18]] as const) {
      expect(run.frames.filter(frame => frame.phase === phase).every(frame => frame.activeLine === line && frame.activePart === `line-${line}`)).toBe(true)
    }
  })
  it.each([
    { sample: '__proto__' }, { sample: 'constructor' }, { sample: 'bad' }, { sample: '1}; evil();' },
    { order: 'bad' }, { earlyExit: 1 }, { earlyExit: 'true' }, { earlyExit: undefined },
  ])('safely blocks invalid configuration %j before creating values', change => {
    const config = { ...DEFAULT_BUBBLE_SORT_CONFIG, ...change } as BubbleSortConfig
    expect(validateBubbleSortConfig(config).length).toBeGreaterThan(0)
    const run = simulateBubbleSortProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(run.values).toBeNull()
    expect(run.output).toEqual([])
    expect(run.source.sourceText).not.toContain('evil()')
  })
})
