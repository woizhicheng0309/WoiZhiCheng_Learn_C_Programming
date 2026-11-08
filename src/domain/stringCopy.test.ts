import { DEFAULT_STRING_COPY_CONFIG, STRING_COPY_CAPACITIES, STRING_COPY_SAMPLES, buildStringCopySource, simulateStringCopyProgram, validateStringCopyConfig, type StringCopyConfig } from './stringCopy'

const expectedLengths = { word: 4, 'digit-zero': 4, 'embedded-nul': 2, empty: 0 }
describe('safe string copy', () => {
  for (const sample of Object.keys(STRING_COPY_SAMPLES) as StringCopyConfig['sample'][]) {
    for (const capacity of STRING_COPY_CAPACITIES) {
      it(`copies ${sample} into ${capacity} cells only when the terminator also fits`, () => {
        const run = simulateStringCopyProgram({ sample, capacity })
        const length = expectedLengths[sample]
        const characters = STRING_COPY_SAMPLES[sample].characters
        const fits = length + 1 <= capacity
        expect(run.status).toBe('completed')
        expect(run.length).toBe(length)
        expect(run.sourceSize).toBe(characters.length)
        expect(run.fits).toBe(fits)
        expect(run.copied).toBe(fits)
        expect(run.copiedCount).toBe(fits ? length + 1 : 0)
        expect(run.output[0]).toBe(`length=${length}, capacity=${capacity}`)
        expect(run.output[1]).toBe(fits ? characters.slice(0, length).join('') : 'buffer too small')
        expect(run.destination).toEqual(fits ? [...characters.slice(0, length + 1), ...Array.from({ length: capacity - length - 1 }, () => null)] : Array.from({ length: capacity }, () => null))
        for (const [index, frame] of run.frames.entries()) {
          expect(frame.index).toBe(index)
          expect(frame.activeLine).toBeGreaterThan(0)
          expect(frame.activeLine).toBeLessThanOrEqual(run.source.lines.length)
          if (frame.source) expect(frame.source).toEqual(characters)
          if (frame.activeIndex !== null) {
            expect(frame.phase).toBe('copy-character')
            expect(frame.activeIndex).toBeLessThan(characters.length)
            expect(frame.activeIndex).toBeLessThan(capacity)
            expect(frame.destination![frame.activeIndex]).toBe(characters[frame.activeIndex])
            expect(frame.iInScope).toBe(true)
          }
          if (frame.phase === 'print-string') {
            expect(frame.copied).toBe(true)
            expect(frame.destination![length]).toBe('\0')
          }
        }
        if (!fits) {
          expect(run.frames.some(frame => ['initialize-i', 'copy-character', 'print-string'].includes(frame.phase))).toBe(false)
          expect(run.frames.find(frame => frame.phase === 'reject-copy')!.destination!.every(value => value === null)).toBe(true)
        }
        expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false, iInScope: false })
      })
    }
  }
  it('copies exactly one terminator even for an empty string', () => {
    const run = simulateStringCopyProgram({ sample: 'empty', capacity: 1 })
    expect(run).toMatchObject({ length: 0, copiedCount: 1, destination: ['\0'], output: ['length=0, capacity=1', ''] })
    const terminalWrite = run.frames.find(frame => frame.phase === 'copy-character')!
    expect(terminalWrite).toMatchObject({ i: 0, activeIndex: 0, copied: true })
    const failedCondition = run.frames.find(frame => frame.phase === 'copy-condition' && frame.i === 1)!
    expect(failedCondition.activeIndex).toBeNull()
  })
  it('does not copy bytes after an embedded terminator or initialize the unused tail', () => {
    const run = simulateStringCopyProgram({ sample: 'embedded-nul', capacity: 8 })
    expect(run).toMatchObject({ length: 2, sourceSize: 6, copiedCount: 3 })
    expect(run.destination).toEqual(['C', 'O', '\0', null, null, null, null, null])
    expect(run.output.at(-1)).toBe('CO')
    expect(run.frames.filter(frame => frame.phase === 'copy-character').map(frame => frame.activeIndex)).toEqual([0, 1, 2])
  })
  it('uses strict capacity checking, a terminator-inclusive loop and valid source line mappings', () => {
    const source = buildStringCopySource().sourceText
    expect(source).toContain('if (length < sizeof destination)')
    expect(source).toContain('i <= length')
    expect(source).toContain('size_t length = strlen(source);')
    expect(source).toContain('length=%zu, capacity=%zu\\n')
    const run = simulateStringCopyProgram()
    for (const [phase, line] of [['measure-length', 7], ['check-capacity', 9], ['copy-character', 11], ['print-string', 13]] as const) {
      expect(run.frames.filter(frame => frame.phase === phase).every(frame => frame.activeLine === line && frame.activePart === `line-${line}`)).toBe(true)
    }
    const rejected = simulateStringCopyProgram({ sample: 'word', capacity: 3 })
    expect(rejected.frames.find(frame => frame.phase === 'reject-copy')!.activeLine).toBe(15)
  })
  it('keeps independent snapshots of source, uninitialized storage and partial copies', () => {
    const run = simulateStringCopyProgram()
    const declared = run.frames.find(frame => frame.phase === 'declare-destination')!
    const first = run.frames.find(frame => frame.phase === 'copy-character')!
    expect(declared.destination).toEqual([null, null, null, null, null])
    expect(first.destination).toEqual(['C', null, null, null, null])
    expect(first.copied).toBe(false)
    expect(first.source).not.toBe(declared.source)
    expect(first.destination).not.toBe(declared.destination)
    expect(run.frames.find(frame => frame.phase === 'enter-main')!.length).toBeNull()
  })
  it.each([
    { sample: '__proto__' }, { sample: 'constructor' }, { sample: 'bad"; evil();' },
    { capacity: 0 }, { capacity: 2 }, { capacity: 4 }, { capacity: 9 }, { capacity: 5.5 }, { capacity: Infinity }, { capacity: '5' },
  ])('blocks unsupported configuration %j before allocating arrays', change => {
    const config = { ...DEFAULT_STRING_COPY_CONFIG, ...change } as StringCopyConfig
    expect(validateStringCopyConfig(config).length).toBeGreaterThan(0)
    const run = simulateStringCopyProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(run.destination).toBeNull()
    expect(run.output).toEqual([])
    expect(run.source.sourceText).not.toContain('evil()')
    expect(run.source.sourceText).not.toContain('Infinity')
  })
})
