import { DEFAULT_STRING_COMPARISON_CONFIG, STRING_COMPARISON_SAMPLES, buildStringComparisonSource, simulateStringComparisonProgram, validateStringComparisonConfig, type StringComparisonConfig } from './stringComparison'

const expectedCases = {
  different: { manual: 1, index: 2 }, prefix: { manual: -1, index: 3 }, equal: { manual: 0, index: 4 },
  empty: { manual: -1, index: 0 }, 'embedded-nul': { manual: 0, index: 2 }, 'first-character': { manual: 1, index: 0 }, case: { manual: 1, index: 0 },
} as const
describe('string comparison and strcmp signs', () => {
  for (const sample of Object.keys(STRING_COMPARISON_SAMPLES) as StringComparisonConfig['sample'][]) {
    for (const reversed of [false, true]) {
      it(`compares ${sample}, reversed ${reversed}, without reading beyond either string`, () => {
        const run = simulateStringComparisonProgram({ sample, reversed })
        const base = expectedCases[sample]
        const expected = base.manual === 0 ? 0 : reversed ? -base.manual : base.manual
        const sign = expected < 0 ? 'negative' : expected > 0 ? 'positive' : 'zero'
        expect(run.status).toBe('completed')
        expect(run.manual).toBe(expected)
        expect(run.librarySign).toBe(sign)
        expect(run.decisiveIndex).toBe(base.index)
        expect(run.matchedIndices).toEqual(Array.from({ length: base.index }, (_, index) => index))
        expect(run.output).toEqual([`manual=${expected}`, `strcmp: ${sign}`])
        for (const [index, frame] of run.frames.entries()) {
          expect(frame.index).toBe(index)
          expect(frame.activeLine).toBeGreaterThan(0)
          expect(frame.activeLine).toBeLessThanOrEqual(run.source.lines.length)
          if (frame.left) expect(frame.left).toEqual(run.left)
          if (frame.right) expect(frame.right).toEqual(run.right)
          if (frame.leftReadIndex !== null) {
            expect(frame.leftReadIndex).toBeGreaterThanOrEqual(0)
            expect(frame.leftReadIndex).toBeLessThan(frame.left!.length)
            expect(frame.leftReadIndex).toBeLessThanOrEqual(frame.left!.indexOf('\0'))
          }
          if (frame.rightReadIndex !== null) {
            expect(frame.rightReadIndex).toBeGreaterThanOrEqual(0)
            expect(frame.rightReadIndex).toBeLessThan(frame.right!.length)
            expect(frame.rightReadIndex).toBeLessThanOrEqual(frame.right!.indexOf('\0'))
          }
        }
        expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
      })
    }
  }
  it('short-circuits the equality operand at a left terminator, then reads the final pair on separate lines', () => {
    const run = simulateStringComparisonProgram({ ...DEFAULT_STRING_COMPARISON_CONFIG, sample: 'prefix' })
    const frames = run.frames
    const guard = frames.findIndex(frame => frame.phase === 'check-terminator' && frame.left![frame.i!] === '\0')
    expect(frames[guard]).toMatchObject({ i: 3, activePart: 'terminator-guard', leftReadIndex: 3, rightReadIndex: null })
    expect(frames.slice(guard + 1, guard + 4).map(frame => frame.phase)).toEqual(['end-while', 'read-a', 'read-b'])
    expect(frames[guard + 3]).toMatchObject({ a: 0, b: 84, leftReadIndex: null, rightReadIndex: 3 })
    expect(frames.filter(frame => frame.phase === 'compare-pair').every(frame => frame.i! < 3)).toBe(true)
  })
  it('stops at the first different character even when the shorter string sorts later', () => {
    const run = simulateStringComparisonProgram({ sample: 'first-character', reversed: false })
    expect(run).toMatchObject({ manual: 1, decisiveIndex: 0, matchedIndices: [] })
    expect(run.frames.some(frame => frame.phase === 'increment-i')).toBe(false)
    const pair = run.frames.find(frame => frame.phase === 'compare-pair')!
    expect(pair).toMatchObject({ activePart: 'pair-equality', leftReadIndex: 0, rightReadIndex: 0 })
  })
  it('preserves physical data after embedded NULs but excludes it from comparison', () => {
    const run = simulateStringComparisonProgram({ sample: 'embedded-nul', reversed: false })
    expect(run.left).toEqual(['C', 'O', '\0', 'Z', '\0'])
    expect(run.right).toEqual(['C', 'O', '\0', 'A', '\0'])
    expect(run).toMatchObject({ manual: 0, librarySign: 'zero', decisiveIndex: 2 })
    expect(run.frames.every(frame => frame.leftReadIndex === null || frame.leftReadIndex <= 2)).toBe(true)
    expect(run.frames.every(frame => frame.rightReadIndex === null || frame.rightReadIndex <= 2)).toBe(true)
    expect(run.source.sourceText).toContain('"CO\\0Z"')
    expect(run.source.sourceText).not.toContain('\0')
  })
  it('uses ASCII byte values for the case example and normalizes the manual result only', () => {
    const run = simulateStringComparisonProgram({ sample: 'case', reversed: false })
    expect(run.frames.find(frame => frame.phase === 'calculate-manual')).toMatchObject({ a: 97, b: 66, manual: 1, librarySign: null })
    expect(run.frames.find(frame => frame.phase === 'call-strcmp')).toMatchObject({ manual: 1, librarySign: 'positive' })
    expect(run.source.sourceText).toContain('unsigned char a = (unsigned char)left[i];')
    expect(run.source.sourceText).toContain('int manual = (a > b) - (a < b);')
    expect(run.source.sourceText).toContain('int library = strcmp(left, right);')
    expect(run.source.sourceText).not.toMatch(/library == (1|-1)/)
  })
  it('takes only the matching if/else print branch for each sign', () => {
    for (const [sample, line, positiveCheck] of [['prefix', 16, false], ['different', 17, true], ['equal', 18, true]] as const) {
      const run = simulateStringComparisonProgram({ sample, reversed: false })
      expect(run.frames.filter(frame => frame.phase === 'print-relation')).toHaveLength(1)
      expect(run.frames.find(frame => frame.phase === 'print-relation')!.activeLine).toBe(line)
      expect(run.frames.some(frame => frame.phase === 'check-positive')).toBe(positiveCheck)
    }
  })
  it('keeps historical arrays, matches and output independent and leaves i in scope after while', () => {
    const run = simulateStringComparisonProgram()
    const initialized = run.frames.find(frame => frame.phase === 'initialize-right')!
    const later = run.frames.find(frame => frame.phase === 'compare-pair')!
    expect(initialized.left).not.toBe(later.left)
    expect(initialized.right).not.toBe(later.right)
    expect(initialized.matchedIndices).toEqual([])
    expect(later.matchedIndices).toEqual([0])
    expect(initialized.output).toEqual([])
    expect(run.frames.find(frame => frame.phase === 'end-while')).toMatchObject({ i: 2, mainInScope: true })
    const strcmpIndex = run.frames.findIndex(frame => frame.phase === 'call-strcmp')
    expect(run.frames.slice(0, strcmpIndex).every(frame => frame.librarySign === null)).toBe(true)
    expect(run.frames.slice(0, strcmpIndex + 1).every(frame => frame.output.length === 0)).toBe(true)
    expect(buildStringComparisonSource().lines[7].code).toBe("  while (left[i] != '\\0' && left[i] == right[i]) {")
  })
  it.each([
    { sample: '__proto__' }, { sample: 'constructor' }, { sample: 'bad"; evil();' }, { sample: { toString: null } }, { sample: null }, { sample: [] },
    { reversed: 'false' }, { reversed: 0 }, { reversed: null }, { reversed: undefined },
  ])('blocks unsupported configuration %j before array initialization', change => {
    const config = { ...DEFAULT_STRING_COMPARISON_CONFIG, ...change } as StringComparisonConfig
    expect(validateStringComparisonConfig(config).length).toBeGreaterThan(0)
    const run = simulateStringComparisonProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(run.left).toBeNull()
    expect(run.right).toBeNull()
    expect(run.librarySign).toBeNull()
    expect(run.output).toEqual([])
    expect(run.source.sourceText).not.toContain('evil()')
  })
})
