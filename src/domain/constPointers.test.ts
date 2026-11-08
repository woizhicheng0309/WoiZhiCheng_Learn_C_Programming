import { CONST_POINTER_KINDS, CONST_POINTER_OPERATIONS, DEFAULT_CONST_POINTER_CONFIG, buildConstPointerSource, simulateConstPointerProgram, validateConstPointerConfig, type ConstPointerConfig } from './constPointers'

const forbidden = new Set(['pointee-const:write-through', 'both-const:write-through', 'pointer-const:rebind', 'both-const:rebind'])
describe('const pointer assignment rules', () => {
  for (const kind of Object.keys(CONST_POINTER_KINDS) as ConstPointerConfig['kind'][]) {
    for (const operation of Object.keys(CONST_POINTER_OPERATIONS) as ConstPointerConfig['operation'][]) {
      for (const target of ['x', 'y'] as const) {
        it(`checks ${kind}, ${operation}, initially pointing to ${target}`, () => {
          const config = { kind, operation, target }
          expect(validateConstPointerConfig(config)).toEqual([])
          const run = simulateConstPointerProgram(config)
          if (forbidden.has(`${kind}:${operation}`)) {
            expect(run.status).toBe('compile-error')
            expect(run.frames.map(frame => frame.phase)).toEqual(['check-program', 'blocked'])
            expect(run.frames.every(frame => !frame.mainInScope && frame.values.x === null && frame.values.y === null && frame.target === null)).toBe(true)
            expect(run.frames.at(-1)!.activeLine).toBe(7)
            expect(run.frames.at(-1)!.explanation).toContain('編譯階段')
            expect(run.output).toEqual([])
            expect(run.printedValues).toBeNull()
            return
          }
          const expected = { x: 10, y: 20 }
          let finalTarget = target
          if (operation === 'write-through') expected[target] = 30
          if (operation === 'direct-write') expected.x = 30
          if (operation === 'rebind') finalTarget = target === 'x' ? 'y' : 'x'
          expect(run.status).toBe('completed')
          expect(run.values).toEqual(expected)
          expect(run.target).toBe(finalTarget)
          expect(run.printedValues).toEqual([expected.x, expected.y, expected[finalTarget]])
          expect(run.output).toEqual([`x=${expected.x}, y=${expected.y}, *p=${expected[finalTarget]}`])
          expect(run.frames[0]).toMatchObject({ phase: 'check-program', mainInScope: false, target: null, values: { x: null, y: null } })
          expect(run.frames[1].phase).toBe('enter-main')
          expect(run.frames.find(frame => frame.phase === operation)?.activeLine).toBe(7)
          expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
          for (const [index, frame] of run.frames.entries()) {
            expect(frame.index).toBe(index)
            expect(frame.activeLine).toBeGreaterThan(0)
            expect(frame.activeLine).toBeLessThanOrEqual(run.source.lines.length)
            expect(frame.activePart).toBe(`line-${frame.activeLine}`)
          }
        })
      }
    }
  }
  it('permits direct changes to a mutable original even through a read-only alias', () => {
    for (const kind of ['pointee-const', 'both-const'] as const) {
      const run = simulateConstPointerProgram({ kind, operation: 'direct-write', target: 'x' })
      expect(run).toMatchObject({ status: 'completed', target: 'x', printedValues: [30, 20, 30] })
      const before = run.frames.find(frame => frame.phase === 'bind-pointer')!
      const after = run.frames.find(frame => frame.phase === 'direct-write')!
      expect(before.values).toEqual({ x: 10, y: 20 })
      expect(after.values).toEqual({ x: 30, y: 20 })
      expect(before.values).not.toBe(after.values)
    }
  })
  it('distinguishes a pointer rebind from a write and reveals output only at printf', () => {
    const run = simulateConstPointerProgram()
    const rebound = run.frames.find(frame => frame.phase === 'rebind')!
    expect(rebound).toMatchObject({ target: 'y', values: { x: 10, y: 20 }, activeTarget: 'p', printedValues: null, output: [] })
    const printed = run.frames.find(frame => frame.phase === 'print')!
    expect(printed.printedValues).toEqual([10, 20, 20])
    expect(printed.printedValues).not.toBe(run.printedValues)
    expect(run.frames.find(frame => frame.phase === 'initialize-x')!.values.y).toBeNull()
    expect(run.frames.find(frame => frame.phase === 'initialize-y')!.target).toBeNull()
  })
  it('emits the four distinct C declarations and does not cast away const', () => {
    const declarations = {
      mutable: 'int *p', 'pointee-const': 'const int *p', 'pointer-const': 'int *const p', 'both-const': 'const int *const p',
    }
    for (const kind of Object.keys(declarations) as ConstPointerConfig['kind'][]) {
      const source = buildConstPointerSource({ ...DEFAULT_CONST_POINTER_CONFIG, kind })
      expect(source.lines[5]).toEqual({ lineNumber: 6, code: `  ${declarations[kind]} = &x;` })
      expect(source.sourceText).not.toContain('(int *)')
      expect(source.lines[7].code).toBe('  printf("x=%d, y=%d, *p=%d\\n", x, y, *p);')
    }
  })
  it.each([
    { kind: '__proto__' }, { kind: 'constructor' }, { kind: 'bad; evil();' }, { kind: { toString: null } },
    { operation: '__proto__' }, { operation: { toString: null } }, { operation: null },
    { target: 'other' }, { target: '&x; evil();' }, { target: null },
  ])('blocks invalid configuration %j without building runtime objects', change => {
    const config = { ...DEFAULT_CONST_POINTER_CONFIG, ...change } as ConstPointerConfig
    expect(validateConstPointerConfig(config).length).toBeGreaterThan(0)
    const run = simulateConstPointerProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.every(frame => !frame.mainInScope)).toBe(true)
    expect(run.values).toEqual({ x: null, y: null })
    expect(run.target).toBeNull()
    expect(run.output).toEqual([])
    expect(run.source.sourceText).not.toContain('evil()')
  })
})
