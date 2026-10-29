import {
  DEFAULT_SWAP_CONFIG,
  SWAP_LIMITS,
  buildSwapSource,
  simulateSwapProgram,
  validateSwapConfig,
  type SwapConfig,
  type SwapMode,
  type SwapPhase,
  type SwapSimulationResult,
} from './swap'

const config = (overrides: Partial<SwapConfig> = {}): SwapConfig => ({
  ...DEFAULT_SWAP_CONFIG,
  ...overrides,
})
const frameFor = (result: SwapSimulationResult, phase: SwapPhase) =>
  result.frames.find((frame) => frame.phase === phase)!

describe('swap integer copies', () => {
  it('swaps only local parameters and prints the unchanged caller values', () => {
    const result = simulateSwapProgram()
    expect(result.status).toBe('completed')
    expect(result.validationIssues).toEqual([])
    expect(result.outputText).toBe('5 9')
    expect(frameFor(result, 'bind-parameters')).toMatchObject({
      activeFunction: 'swap',
      memory: {
        main: { x: 5, y: 9, status: 'suspended' },
        swap: { a: 5, b: 9, temp: null, status: 'active' },
      },
    })
    expect(frameFor(result, 'save-temp').memory.swap.temp).toBe(5)
    expect(frameFor(result, 'write-first')).toMatchObject({
      changedVariable: 'a',
      memory: { main: { x: 5, y: 9 }, swap: { a: 9, b: 9, temp: 5 } },
    })
    expect(frameFor(result, 'write-second')).toMatchObject({
      changedVariable: 'b',
      memory: { main: { x: 5, y: 9 }, swap: { a: 9, b: 5, temp: 5 } },
    })
  })

  it('creates and returns the callee framework before resuming the caller', () => {
    const result = simulateSwapProgram()
    expect(frameFor(result, 'enter-main')).toMatchObject({
      activeFunction: 'main',
      memory: { main: { x: null, y: null, status: 'active' }, swap: { status: 'not-created' } },
    })
    expect(frameFor(result, 'init-x').memory.main).toMatchObject({ x: 5, y: null })
    expect(frameFor(result, 'call-swap')).toMatchObject({
      activeFunction: 'main',
      memory: { main: { status: 'active' }, swap: { status: 'not-created' } },
    })
    expect(frameFor(result, 'return-swap')).toMatchObject({
      activeFunction: 'main', activeLine: 7,
      memory: { main: { status: 'active' }, swap: { status: 'returned' } },
    })
    expect(frameFor(result, 'print')).toMatchObject({
      activeFunction: 'main', memory: { main: { status: 'active' }, swap: { status: 'returned' } },
    })
    expect(frameFor(result, 'done')).toMatchObject({
      activeFunction: null, memory: { main: { status: 'returned' }, swap: { status: 'returned' } },
    })
    expect(result.frames.filter((frame) => frame.index < frameFor(result, 'print').index)
      .every((frame) => frame.outputText === null)).toBe(true)
  })
})

describe('swap via copied pointer values', () => {
  it('modifies caller memory while a and b keep the same address copies', () => {
    const result = simulateSwapProgram(config({ mode: 'pointer' }))
    expect(result.outputText).toBe('9 5')
    const bind = frameFor(result, 'bind-parameters')
    const first = frameFor(result, 'write-first')
    const second = frameFor(result, 'write-second')
    expect(bind.memory.swap).toEqual({ a: '&x', b: '&y', temp: null, status: 'active' })
    expect(first).toMatchObject({
      changedVariable: 'x', activeFunction: 'swap',
      memory: { main: { x: 9, y: 9, status: 'suspended' }, swap: { a: '&x', b: '&y', temp: 5 } },
    })
    expect(second).toMatchObject({
      changedVariable: 'y', activeFunction: 'swap',
      memory: { main: { x: 9, y: 5, status: 'suspended' }, swap: { a: '&x', b: '&y', temp: 5 } },
    })
    expect(bind.explanation).toContain('位址副本')
    expect(frameFor(result, 'call-swap').explanation).toContain('以值傳遞')
    expect(frameFor(result, 'return-swap').memory.main).toMatchObject({ x: 9, y: 5 })
  })

  it.each([
    { x: -10, y: -3 },
    { x: 7, y: 7 },
    { x: 0, y: -4 },
    { x: SWAP_LIMITS.min, y: SWAP_LIMITS.max },
  ])('preserves values for x=$x and y=$y across both modes', ({ x, y }) => {
    const byValue = simulateSwapProgram(config({ x, y }))
    const byPointer = simulateSwapProgram(config({ x, y, mode: 'pointer' }))
    expect(byValue.status).toBe('completed')
    expect(byPointer.status).toBe('completed')
    expect(byValue.outputText).toBe(`${x} ${y}`)
    expect(byPointer.outputText).toBe(`${y} ${x}`)
    expect(frameFor(byPointer, 'save-temp').memory.swap.temp).toBe(x)
    expect(frameFor(byPointer, 'write-first').memory.main).toMatchObject({ x: y, y })
    expect(frameFor(byPointer, 'write-second').memory.main).toMatchObject({ x: y, y: x })
  })
})

describe('swap source and trace consistency', () => {
  it.each(['value', 'pointer'] as const)('matches every %s trace frame to its source line and index', (mode) => {
    const result = simulateSwapProgram(config({ mode }))
    expect(result.frames.map((frame) => frame.phase)).toEqual([
      'enter-main', 'init-x', 'init-y', 'call-swap', 'bind-parameters',
      'save-temp', 'write-first', 'write-second', 'return-swap',
      'print', 'return-main', 'done',
    ])
    expect(result.source.lines).toHaveLength(15)
    result.frames.forEach((frame, index) => {
      expect(frame.index).toBe(index)
      expect(frame.activePart).toBe(`line-${frame.activeLine}`)
      expect(result.source.lines[frame.activeLine - 1].phases).toContain(frame.phase)
    })
    expect(result.source.sourceText).toBe(result.source.lines.map((line) => line.code).join('\n'))
    expect(result.source.lines[11].code).toContain(mode === 'pointer' ? 'swap(&x, &y);' : 'swap(x, y);')
    expect(result.source.lines[2].code).toBe(mode === 'pointer' ? 'void swap(int *a, int *b) {' : 'void swap(int a, int b) {')
    expect(result.source.lines[4].code).toBe(mode === 'pointer' ? '  *a = *b;' : '  a = b;')
  })

  it('keeps nested snapshots and input independent of later mutations', () => {
    const input = config({ mode: 'pointer' })
    const result = simulateSwapProgram(input)
    input.x = 99
    input.mode = 'value'
    expect(result.config).toEqual({ x: 5, y: 9, mode: 'pointer' })
    const bind = frameFor(result, 'bind-parameters')
    const first = frameFor(result, 'write-first')
    expect(bind.memory.main.x).toBe(5)
    expect(bind.memory.swap.temp).toBeNull()
    expect(bind.memory.main).not.toBe(first.memory.main)
    expect(bind.memory.swap).not.toBe(first.memory.swap)
    expect(bind.memory.main.status).toBe('suspended')
    expect(bind.memory.swap.status).toBe('active')
    expect(result.frames[0].memory.swap.status).toBe('not-created')
  })
})

describe('swap input validation', () => {
  it.each(['x', 'y'] as const)('blocks invalid %s before initialization or a function call', (field) => {
    for (const value of [NaN, Infinity, -Infinity, 2.5, SWAP_LIMITS.min - 1, SWAP_LIMITS.max + 1]) {
      const result = simulateSwapProgram(config({ [field]: value }))
      expect(result.status).toBe('blocked')
      expect(result.outputText).toBeNull()
      expect(result.frames.map((frame) => frame.phase)).toEqual(['enter-main', 'blocked'])
      expect(result.frames.at(-1)?.memory).toEqual({
        main: { x: null, y: null, status: 'active' },
        swap: { a: null, b: null, temp: null, status: 'not-created' },
      })
      expect(result.validationIssues).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
    }
  })

  it('rejects an unknown runtime mode without injecting it into source', () => {
    const input = config({ mode: 'invalid();' as SwapMode })
    expect(validateSwapConfig(input)).toEqual([{ field: 'mode', message: expect.any(String) }])
    expect(simulateSwapProgram(input).status).toBe('blocked')
    expect(buildSwapSource(input).sourceText).not.toContain('invalid();')
  })

  it('keeps non-numeric runtime input out of the displayed C literals', () => {
    const input = config({ x: '1; unsafe();' as unknown as number, y: NaN })
    const source = buildSwapSource(input).sourceText
    expect(source).not.toMatch(/unsafe|NaN/)
    expect(source).toContain('simulation blocked')
    expect(simulateSwapProgram(input).status).toBe('blocked')
  })
})
