import {
  DEFAULT_POINTER_CONFIG,
  POINTER_LIMITS,
  buildPointerSource,
  simulatePointerProgram,
  validatePointerConfig,
  type PointerConfig,
  type PointerTarget,
} from './pointers'

const config = (overrides: Partial<PointerConfig> = {}): PointerConfig => ({
  ...DEFAULT_POINTER_CONFIG,
  ...overrides,
})

describe('pointer execution trace', () => {
  it('reads the pointee, writes through the same pointer, and preserves the copied value', () => {
    const result = simulatePointerProgram()
    expect(result.status).toBe('completed')
    expect(result.validationIssues).toEqual([])
    expect(result.selectedValue).toBe(5)
    expect(result.outputText).toBe('5 -> 12')
    expect(result.frames.map((frame) => frame.phase)).toEqual([
      'enter-main', 'declare-values', 'bind-pointer', 'read-pointer',
      'write-pointer', 'print', 'return-main', 'done',
    ])
    const read = result.frames.find((frame) => frame.phase === 'read-pointer')!
    const write = result.frames.find((frame) => frame.phase === 'write-pointer')!
    expect(read.memory).toMatchObject({ x: 5, y: 9, selected: 5, pointerTarget: 'x' })
    expect(write.memory).toMatchObject({ x: 12, y: 9, selected: 5, pointerTarget: 'x' })
    expect(read.accessKind).toBe('read')
    expect(write.accessKind).toBe('write')
    expect(result.frames.at(-1)?.memory.inScope).toBe(false)
  })

  it('redirects every dereference to y when p stores &y', () => {
    const result = simulatePointerProgram(config({ x: -3, y: 18, target: 'y', newValue: 0 }))
    const write = result.frames.find((frame) => frame.phase === 'write-pointer')!
    expect(result.outputText).toBe('18 -> 0')
    expect(write.memory).toMatchObject({ x: -3, y: 0, selected: 18, pointerTarget: 'y' })
    expect(result.source.sourceText).toContain('int *p = &y;')
  })

  it('binds NULL but stops before reading, writing, or fabricating an output', () => {
    const result = simulatePointerProgram(config({ target: 'null' }))
    expect(result.status).toBe('blocked')
    expect(result.validationIssues).toEqual([])
    expect(result.frames.map((frame) => frame.phase)).toEqual([
      'enter-main', 'declare-values', 'bind-pointer', 'blocked',
    ])
    expect(result.frames.at(-1)).toMatchObject({
      activeLine: 7,
      activePart: 'line-7',
      accessKind: 'none',
      memory: { x: 5, y: 9, pointerTarget: 'null', pointerDeclared: true, selectedDeclared: false, selected: null },
    })
    expect(result.selectedValue).toBeNull()
    expect(result.outputText).toBeNull()
    expect(result.message).toContain('未定義行為')
    expect(result.source.sourceText).toContain('int *p = NULL;')
  })

  it('keeps snapshots and config independent of future steps and caller mutations', () => {
    const input = config()
    const result = simulatePointerProgram(input)
    input.x = 99
    expect(result.config.x).toBe(5)
    expect(result.frames[0].memory.valuesDeclared).toBe(false)
    expect(result.frames[1].memory.x).toBe(5)
    expect(result.frames[1].memory.inScope).toBe(true)
    expect(result.frames[1].memory).not.toBe(result.frames[2].memory)
    expect(simulatePointerProgram().outputText).toBe('5 -> 12')
  })

  it('matches trace indexes and highlights to the generated C source', () => {
    const result = simulatePointerProgram()
    result.frames.forEach((frame, index) => {
      expect(frame.index).toBe(index)
      expect(frame.activePart).toBe(`line-${frame.activeLine}`)
      expect(result.source.lines[frame.activeLine - 1].phases).toContain(frame.phase)
    })
    expect(buildPointerSource().sourceText).toContain('printf("%d -> %d\\n", selected, *p);')
  })
})

describe('pointer configuration validation', () => {
  it.each(['x', 'y', 'newValue'] as const)('rejects unsafe values in %s', (field) => {
    for (const value of [NaN, Infinity, -Infinity, 0.5, POINTER_LIMITS.min - 1, POINTER_LIMITS.max + 1]) {
      const result = simulatePointerProgram(config({ [field]: value }))
      expect(result.status).toBe('blocked')
      expect(result.validationIssues).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
      expect(result.frames.map((frame) => frame.phase)).toEqual(['enter-main', 'blocked'])
      expect(result.frames.at(-1)?.memory.valuesDeclared).toBe(false)
      expect(result.selectedValue).toBeNull()
      expect(result.outputText).toBeNull()
    }
  })

  it('rejects an unknown runtime target without inserting it into source', () => {
    const invalid = config({ target: 'not-a-variable' as PointerTarget })
    expect(validatePointerConfig(invalid)).toEqual([
      { field: 'target', message: expect.any(String) },
    ])
    expect(simulatePointerProgram(invalid).status).toBe('blocked')
    expect(buildPointerSource(invalid).sourceText).not.toContain('not-a-variable')
  })

  it('accepts both integer boundaries and uses valid C placeholders for nonfinite numbers', () => {
    expect(validatePointerConfig(config({ x: POINTER_LIMITS.min, y: POINTER_LIMITS.max }))).toEqual([])
    const source = buildPointerSource(config({ x: NaN, y: Infinity, newValue: -Infinity })).sourceText
    expect(source).not.toMatch(/NaN|Infinity/)
    expect(source).toContain('simulation blocked')
  })
})
