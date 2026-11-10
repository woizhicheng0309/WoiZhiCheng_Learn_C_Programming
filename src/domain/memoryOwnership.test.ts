import { DEFAULT_MEMORY_OWNERSHIP_CONFIG, simulateMemoryOwnershipProgram, type MemoryOwnershipConfig } from './memoryOwnership'

const run = (overrides: Partial<MemoryOwnershipConfig> = {}) => simulateMemoryOwnershipProgram({ ...DEFAULT_MEMORY_OWNERSHIP_CONFIG, ...overrides })

it('copies the address first and changes release responsibility only after clearing the source', () => {
  const simulation = run()
  const frame = (phase: string) => simulation.frames.find(item => item.phase === phase)!
  expect(frame('allocate')).toMatchObject({ heap: 'live', heapValue: null, source: 'live', view: 'unset' })
  expect(frame('borrow')).toMatchObject({ source: 'live', destination: 'null', view: 'live', responsibility: 'source' })
  expect(frame('copy-pointer')).toMatchObject({ source: 'live', destination: 'live', view: 'live', responsibility: 'source', freeCount: 0 })
  expect(frame('clear-source')).toMatchObject({ source: 'null', destination: 'live', view: 'live', responsibility: 'destination', heapValue: 42 })
  expect(frame('select-destination')).toMatchObject({ cleanup: 'destination', heap: 'live' })
  expect(frame('observe')).toMatchObject({ observed: 42, view: 'live', heap: 'live' })
  expect(simulation.frames.filter(item => item.phase === 'allocate')).toHaveLength(1)
  expect(simulation.source.lines[frame('clear-source').activeLine - 1].code).toBe('  from->data = NULL;')
})

it.each([
  ['transfer', 'destination', 'source', 100],
  ['retain', 'source', 'destination', 0],
] as const)('invalidates all live aliases on free and clears them individually for %s', (strategy, releaser, other, value) => {
  const simulation = run({ strategy, value })
  const frame = (phase: string) => simulation.frames.find(item => item.phase === phase)!
  const released = frame('free')
  expect(released).toMatchObject({
    [releaser]: 'invalid', [other]: 'null', view: 'invalid', heap: 'released', heapValue: null,
    releaseParameter: releaser, cleanup: releaser, responsibility: null, observed: value, freeCount: 1,
  })
  expect(frame('observe').index).toBeLessThan(released.index)
  expect(frame('clear-owner')).toMatchObject({ [releaser]: 'null', view: 'invalid' })
  expect(frame('leave-release')).toMatchObject({ activeFunction: 'main', releaseParameter: null, view: 'invalid' })
  expect(frame('clear-view')).toMatchObject({ source: 'null', destination: 'null', view: 'null', observed: value })
  expect(frame('print')).toMatchObject({ printedOutcome: releaser, freeCount: 1 })
  expect(simulation.frames.at(-1)).toMatchObject({ phase: 'done', source: 'unset', destination: 'unset', view: 'unset', heap: 'released' })
  expect(simulation).toMatchObject({ freeCount: 1, exitCode: 0, stdout: `value=${value}, released_by=${releaser}\n` })
  expect(simulation.frames.filter(item => item.phase === 'free')).toHaveLength(1)
  expect(simulation.frames.some(item => item.phase === 'call-transfer')).toBe(strategy === 'transfer')
  expect(simulation.frames.every(item => item.heap !== 'released' || ![item.source, item.destination, item.view].includes('live'))).toBe(true)
})

it.each(['transfer', 'retain'] as const)('handles allocator failure before a view exists for %s', strategy => {
  const simulation = run({ outcome: 'failure', strategy })
  expect(simulation).toMatchObject({ status: 'completed', freeCount: 0, exitCode: 1, stdout: 'allocation failed\n' })
  expect(simulation.frames.find(frame => frame.phase === 'check-allocation')).toMatchObject({ source: 'null', destination: 'null', view: 'unset' })
  expect(simulation.frames.every(frame => frame.heap === 'not-allocated' && frame.responsibility === null && frame.freeCount === 0)).toBe(true)
  expect(simulation.frames.some(frame => ['borrow', 'observe', 'call-transfer', 'call-release', 'free'].includes(frame.phase))).toBe(false)
  expect(simulation.source.sourceText).toBe(run({ strategy }).source.sourceText)
})

it.each([{ strategy: 'constructor' }, { outcome: 'other' }, { value: -1 }, { value: 101 }, { value: 0.5 }])('blocks invalid input before allocation %j', overrides => {
  const simulation = run(overrides as Partial<MemoryOwnershipConfig>)
  expect(simulation).toMatchObject({ status: 'blocked', freeCount: 0, exitCode: null })
  expect(simulation.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
})
