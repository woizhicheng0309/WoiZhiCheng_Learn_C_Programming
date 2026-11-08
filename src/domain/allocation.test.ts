import { DEFAULT_ALLOCATION_CONFIG, buildAllocationSource, simulateAllocationProgram, validateAllocationConfig, type AllocationConfig } from './allocation'

describe('dynamic allocation and lifetime', () => {
  it('distinguishes uninitialized malloc elements from calloc integer zeros', () => {
    const malloc = simulateAllocationProgram().frames.find(frame => frame.phase === 'allocate')!
    const calloc = simulateAllocationProgram({ ...DEFAULT_ALLOCATION_CONFIG, allocator: 'calloc' }).frames.find(frame => frame.phase === 'allocate')!
    expect(malloc).toMatchObject({ pointer: 'heap', heapStatus: 'live', cells: [null, null, null] })
    expect(calloc).toMatchObject({ pointer: 'heap', heapStatus: 'live', cells: [0, 0, 0] })
    expect(malloc.sum).toBeNull()
    expect(calloc.sum).toBeNull()
  })
  for (const allocator of ['malloc', 'calloc'] as const) for (const count of [1, 2, 3, 4, 5]) {
    it(`initializes before reading ${count} ${allocator} elements at the supported value boundaries`, () => {
      for (const start of [0, 5, 20]) {
        const run = simulateAllocationProgram({ allocator, outcome: 'success', count, start })
        expect(run.status).toBe('completed')
        expect(run.sum).toBe(count * start + count * (count - 1) / 2)
        expect(run.output).toEqual([`sum=${run.sum}`])
        expect(run.exitCode).toBe(0)
        const reads = run.frames.filter(frame => frame.phase === 'accumulate')
        expect(reads.map(frame => frame.activeCell)).toEqual(Array.from({ length: count }, (_, index) => index))
        for (const frame of reads) {
          const write = run.frames[frame.index - 1]
          expect(write).toMatchObject({ phase: 'initialize-cell', activeCell: frame.i, heapStatus: 'live' })
          expect(frame.cells[frame.i!]).toBe(start + frame.i!)
          expect(frame.sum).toBe((frame.i! + 1) * start + frame.i! * (frame.i! + 1) / 2)
        }
      }
    })
  }
  it.each(['malloc', 'calloc'] as const)('handles %s failure without initializing, reading or freeing a block', allocator => {
    const run = simulateAllocationProgram({ ...DEFAULT_ALLOCATION_CONFIG, allocator, outcome: 'failure' })
    expect(run.status).toBe('completed')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'enter-main', 'initialize-count', 'allocate', 'check-allocation', 'print-failure', 'return-failure', 'done'])
    expect(run.frames.find(frame => frame.phase === 'check-allocation')).toMatchObject({ condition: { expression: 'p == NULL', value: true }, pointer: 'null', heapStatus: 'failed' })
    expect(run.frames.every(frame => frame.cells.length === 0 && frame.sum === null && frame.activeCell === null)).toBe(true)
    expect(run.sum).toBeNull()
    expect(run.exitCode).toBe(1)
    expect(run.output).toEqual(['allocation failed'])
    expect(run.frames.find(frame => frame.phase === 'print-failure')!.predictionValue).toBeNull()
    expect(run.frames.find(frame => frame.phase === 'return-failure')!.predictionValue).toBe(1)
  })
  it('checks the final loop index without accessing the element after capacity', () => {
    const run = simulateAllocationProgram({ ...DEFAULT_ALLOCATION_CONFIG, count: 5 })
    const checks = run.frames.filter(frame => frame.phase === 'for-condition')
    expect(checks.map(frame => frame.i)).toEqual([0, 1, 2, 3, 4, 5])
    expect(checks.at(-1)).toMatchObject({ condition: { expression: '5 < 5', value: false }, activeCell: null, iInScope: true })
    expect(run.frames[checks.at(-1)!.index + 1]).toMatchObject({ phase: 'print-sum', iInScope: false })
    expect(run.frames.every(frame => frame.activeCell === null || (frame.activeCell >= 0 && frame.activeCell < 5))).toBe(true)
  })
  it('prints before freeing, hides freed cells, then overwrites the invalid pointer without reading it', () => {
    const run = simulateAllocationProgram()
    const printed = run.frames.findIndex(frame => frame.phase === 'print-sum')
    expect(run.frames.slice(0, printed).every(frame => frame.output.length === 0 && frame.predictionValue === null)).toBe(true)
    expect(run.frames[printed]).toMatchObject({ cells: [5, 6, 7], heapStatus: 'live', pointer: 'heap', predictionValue: 18 })
    expect(run.frames[printed + 1]).toMatchObject({ phase: 'free', heapStatus: 'freed', pointer: 'invalidated', cells: [] })
    expect(run.frames[printed + 2]).toMatchObject({ phase: 'clear-pointer', heapStatus: 'freed', pointer: 'null', cells: [] })
    expect(run.frames.filter(frame => frame.phase === 'free')).toHaveLength(1)
    expect(run.frames.slice(printed + 1).every(frame => frame.cells.length === 0 && frame.activeCell === null)).toBe(true)
    expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false, exitCode: 0 })
  })
  it('keeps prior allocation and initialization snapshots independent', () => {
    const config = { ...DEFAULT_ALLOCATION_CONFIG }
    const run = simulateAllocationProgram(config)
    const allocated = run.frames.find(frame => frame.phase === 'allocate')!
    const firstWrite = run.frames.find(frame => frame.phase === 'initialize-cell')!
    const printed = run.frames.find(frame => frame.phase === 'print-sum')!
    expect(allocated.cells).toEqual([null, null, null])
    expect(firstWrite.cells).toEqual([5, null, null])
    expect(printed.cells).toEqual([5, 6, 7])
    expect(allocated.cells).not.toBe(firstWrite.cells)
    expect(firstWrite.cells).not.toBe(printed.cells)
    expect(printed.cells).not.toBe(run.cells)
    config.count = 1; config.start = 0
    expect(run.config).toMatchObject({ count: 3, start: 5 })
  })
  it('generates the actual allocation calls and does not promise an outcome in C source', () => {
    const malloc = buildAllocationSource()
    const calloc = buildAllocationSource({ ...DEFAULT_ALLOCATION_CONFIG, allocator: 'calloc' })
    expect(malloc.lines[1].code).toBe('#include <stdlib.h>')
    expect(malloc.lines[5].code).toBe('  int *p = malloc((size_t)count * sizeof *p);')
    expect(calloc.lines[5].code).toBe('  int *p = calloc((size_t)count, sizeof *p);')
    expect(buildAllocationSource({ ...DEFAULT_ALLOCATION_CONFIG, outcome: 'failure' }).sourceText).toBe(malloc.sourceText)
    expect(malloc.lines[6].code).toBe('  if (p == NULL) {')
    expect(malloc.lines[12].code).toBe('    p[i] = 5 + i;')
    expect(malloc.lines[16].code).toBe('  free(p);')
    expect(malloc.lines[17].code).toBe('  p = NULL;')
    const lineByPhase = { prepare: 4, 'enter-main': 4, 'initialize-count': 5, allocate: 6, 'check-allocation': 7,
      'print-failure': 8, 'return-failure': 9, 'initialize-sum': 11, 'for-init': 12, 'for-condition': 12, 'for-update': 12,
      'initialize-cell': 13, accumulate: 14, 'print-sum': 16, free: 17, 'clear-pointer': 18, 'return-success': 19, done: 20, blocked: 4 }
    for (const outcome of ['success', 'failure'] as const) for (const [index, frame] of simulateAllocationProgram({ ...DEFAULT_ALLOCATION_CONFIG, outcome }).frames.entries()) {
      expect(frame.index).toBe(index)
      expect(frame.activeLine).toBe(lineByPhase[frame.phase])
      expect(frame.activePart).toBe(frame.phase.startsWith('for-') ? frame.phase : `line-${frame.activeLine}`)
    }
  })
  it.each([
    { allocator: '__proto__' }, { allocator: 'constructor' }, { allocator: { toString: null } }, { allocator: null },
    { outcome: 'other' }, { outcome: null }, { outcome: { toString: null } },
    { count: 0 }, { count: 6 }, { count: -1 }, { count: 1.5 }, { count: '3' }, { count: Infinity },
    { start: -1 }, { start: 21 }, { start: NaN }, { start: null }, { start: 0.5 },
  ])('blocks invalid configuration %j before requesting a block', change => {
    const config = { ...DEFAULT_ALLOCATION_CONFIG, ...change } as AllocationConfig
    expect(validateAllocationConfig(config).length).toBeGreaterThan(0)
    const run = simulateAllocationProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
    expect(run.frames.every(frame => !frame.mainInScope && frame.heapStatus === 'not-requested' && frame.cells.length === 0 && frame.pointer === 'undeclared')).toBe(true)
    expect(run.exitCode).toBeNull()
    expect(run.output).toEqual([])
  })
})
