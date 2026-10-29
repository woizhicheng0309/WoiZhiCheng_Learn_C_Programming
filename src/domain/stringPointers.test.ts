import {
  DEFAULT_STRING_POINTER_CONFIG,
  STRING_POINTER_SAMPLES,
  buildStringPointerSource,
  getStringPointerSample,
  simulateStringPointerProgram,
  validateStringPointerConfig,
  type StringPointerConfig,
  type StringSample,
  type StringStop,
} from './stringPointers'

const config = (overrides: Partial<StringPointerConfig> = {}): StringPointerConfig => ({
  ...DEFAULT_STRING_POINTER_CONFIG,
  ...overrides,
})

describe('char array storage', () => {
  it('stores actual NUL chars separately from escaped source literals and digit 0', () => {
    const word = getStringPointerSample('word')!
    const digitZero = getStringPointerSample('digit-zero')!
    const embedded = getStringPointerSample('embedded-nul')!
    expect(word.characters).toEqual(['C', 'O', 'D', 'E', '\0'])
    expect(digitZero.characters).toEqual(['C', '0', 'D', 'E', '\0'])
    expect(embedded.characters).toEqual(['C', 'O', '\0', 'D', 'E', '\0'])
    expect(embedded.literal).toBe('CO\\0DE')
    expect(embedded.characters[2]).toHaveLength(1)
    expect(embedded.characters[2].charCodeAt(0)).toBe(0)
    expect(digitZero.characters[1].charCodeAt(0)).toBe(48)
    expect(embedded.characters).toHaveLength(6)
  })
})

describe('normal NUL-terminated string traversal', () => {
  it.each([
    { sample: 'word' as const, text: 'CODE', length: 4 },
    { sample: 'digit-zero' as const, text: 'C0DE', length: 4 },
    { sample: 'embedded-nul' as const, text: 'CO', length: 2 },
  ])('outputs $text and counts $length for $sample', ({ sample, text, length }) => {
    const result = simulateStringPointerProgram(config({ sample }))
    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(result.validationIssues).toEqual([])
    expect(result.output).toEqual([...text])
    expect(result.outputText).toBe(text)
    expect(result.length).toBe(length)
    const conditions = result.frames.filter((frame) => frame.phase === 'condition')
    expect(conditions.map((frame) => frame.conditionResult)).toEqual([
      ...Array.from({ length }, () => true), false,
    ])
    const finalCondition = conditions.at(-1)!
    expect(finalCondition).toMatchObject({
      readIndex: length,
      conditionCharacter: '\0',
      conditionResult: false,
      memory: { pointerIndex: length, length, inScope: true },
    })
    expect(result.frames.filter((frame) => frame.phase === 'read-character')).toHaveLength(length)
    expect(result.frames.filter((frame) => frame.phase === 'increment-length')).toHaveLength(length)
    expect(finalCondition.output).not.toContain('\0')
    expect(result.frames.at(-1)?.memory.inScope).toBe(false)
  })

  it('reads to compare without emitting or counting, then emits and counts as separate steps', () => {
    const result = simulateStringPointerProgram()
    const condition = result.frames.find((frame) => frame.phase === 'condition')!
    const read = result.frames.find((frame) => frame.phase === 'read-character')!
    const increment = result.frames.find((frame) => frame.phase === 'increment-length')!
    const advance = result.frames.find((frame) => frame.phase === 'advance-pointer')!
    expect(condition).toMatchObject({ readIndex: 0, conditionCharacter: 'C', output: [], memory: { length: 0 } })
    expect(read).toMatchObject({ readIndex: 0, conditionCharacter: null, output: ['C'], memory: { length: 0, pointerIndex: 0 } })
    expect(increment).toMatchObject({ readIndex: null, memory: { length: 1, pointerIndex: 0 }, output: ['C'] })
    expect(advance).toMatchObject({ readIndex: null, memory: { length: 1, pointerIndex: 1 }, output: ['C'] })
  })

  it('keeps the chars after an embedded NUL in storage without treating them as string content', () => {
    const result = simulateStringPointerProgram(config({ sample: 'embedded-nul' }))
    expect(result.frames.at(-1)?.memory.characters).toEqual(['C', 'O', '\0', 'D', 'E', '\0'])
    expect(result.frames.filter((frame) => frame.readIndex !== null)
      .every((frame) => frame.readIndex! <= 2)).toBe(true)
    expect(result.outputText).toBe('CO')
    expect(result.length).toBe(2)
    expect(result.message).toContain('第一個空字元')
  })
})

describe('digit 0 is not the NUL sentinel', () => {
  it('stops early on a visible digit 0 without undefined behavior', () => {
    const result = simulateStringPointerProgram(config({ sample: 'digit-zero', stopAt: 'digit-zero' }))
    expect(result.status).toBe('completed')
    expect(result.blockReason).toBeNull()
    expect(result.output).toEqual(['C'])
    expect(result.length).toBe(1)
    expect(result.frames.filter((frame) => frame.phase === 'condition').at(-1)).toMatchObject({
      readIndex: 1, conditionCharacter: '0', conditionResult: false,
    })
    expect(result.message).toContain('48')
  })

  it.each(['word', 'embedded-nul'] as const)('emits raw NUL bytes in $0, then blocks before a one-past condition read', (sample) => {
    const characters = getStringPointerSample(sample)!.characters
    const result = simulateStringPointerProgram(config({ sample, stopAt: 'digit-zero' }))
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('out-of-bounds')
    expect(result.validationIssues).toEqual([])
    expect(result.output).toEqual(characters)
    expect(result.length).toBe(characters.length)
    expect(result.outputText).toBe(sample === 'word' ? 'CODE\\0' : 'CO\\0DE\\0')
    expect(result.output).toContain('\0')
    expect(result.outputText).not.toContain('\0')
    const advance = result.frames.at(-2)!
    const blocked = result.frames.at(-1)!
    expect(advance).toMatchObject({ phase: 'advance-pointer', readIndex: null, memory: { pointerIndex: characters.length } })
    expect(blocked).toMatchObject({
      phase: 'blocked', activeLine: 7, activePart: 'line-7',
      readIndex: null, conditionCharacter: null, conditionResult: null,
      memory: { pointerIndex: characters.length, length: characters.length, inScope: true },
    })
    expect(result.frames.every((frame) => frame.readIndex === null || frame.readIndex < characters.length)).toBe(true)
    expect(result.frames.filter((frame) => frame.phase === 'condition').every((frame) => frame.conditionResult)).toBe(true)
    expect(result.frames.some((frame) => frame.phase === 'print-length' || frame.phase === 'done')).toBe(false)
    expect(result.message).toContain('未定義行為')
    expect(result.frames.find((frame) => frame.phase === 'read-character' && frame.output.at(-1) === '\0')?.explanation)
      .toContain('並非真的印出反斜線和 0')
  })
})

describe('string pointer source and snapshots', () => {
  it.each(STRING_POINTER_SAMPLES)('matches all $id frame/source mappings for both sentinels', (sample) => {
    for (const stopAt of ['nul', 'digit-zero'] as const) {
      const result = simulateStringPointerProgram(config({ sample: sample.id, stopAt }))
      expect(result.source.lines).toHaveLength(14)
      expect(result.source.lines[3].code).toBe(`  char text[] = "${sample.literal}";`)
      expect(result.source.lines[4].code).toBe('  char *p = text;')
      expect(result.source.lines[6].code).toBe(stopAt === 'nul' ? "  while (*p != '\\0') {" : "  while (*p != '0') {")
      expect(result.source.lines[11].code).toBe('  printf("\\nlength = %d\\n", length);')
      expect(result.source.sourceText).not.toContain('\0')
      expect(result.source.sourceText).toBe(result.source.lines.map((line) => line.code).join('\n'))
      result.frames.forEach((frame, index) => {
        expect(frame.index).toBe(index)
        expect(frame.activePart).toBe(`line-${frame.activeLine}`)
        expect(result.source.lines[frame.activeLine - 1].phases).toContain(frame.phase)
        if (frame.phase !== 'condition') {
          expect(frame.conditionCharacter).toBeNull()
          expect(frame.conditionResult).toBeNull()
        }
        if (frame.phase !== 'condition' && frame.phase !== 'read-character') expect(frame.readIndex).toBeNull()
      })
    }
  })

  it('keeps input, char storage, output and earlier counts independent of later frames', () => {
    const input = config()
    const result = simulateStringPointerProgram(input)
    input.sample = 'embedded-nul'
    expect(result.config.sample).toBe('word')
    const initialized = result.frames.find((frame) => frame.phase === 'initialize-string')!
    const bound = result.frames.find((frame) => frame.phase === 'bind-pointer')!
    expect(result.frames[0].memory.characters).toBeNull()
    expect(initialized.memory.characters).not.toBe(bound.memory.characters)
    expect(initialized.memory.characters).not.toBe(STRING_POINTER_SAMPLES[0].characters)
    expect(initialized.memory.pointerIndex).toBeNull()
    expect(bound.memory.pointerIndex).toBe(0)
    expect(initialized.memory.length).toBeNull()
    expect(result.frames[0].output).toEqual([])
    expect(result.output).not.toBe(result.frames.at(-1)?.output)
    expect(result.output).toEqual(['C', 'O', 'D', 'E'])
    expect(STRING_POINTER_SAMPLES[0].characters).toEqual(['C', 'O', 'D', 'E', '\0'])
  })
})

describe('string pointer input validation', () => {
  it('blocks unknown preset/stop values before initialization and excludes raw input from C', () => {
    const input = config({ sample: '"; unsafe();' as StringSample, stopAt: "'); unsafe();" as StringStop })
    expect(validateStringPointerConfig(input).map((issue) => issue.field)).toEqual(['sample', 'stopAt'])
    const result = simulateStringPointerProgram(input)
    expect(result.status).toBe('blocked')
    expect(result.blockReason).toBe('invalid-config')
    expect(result.frames.map((frame) => frame.phase)).toEqual(['enter-main', 'blocked'])
    expect(result.frames.at(-1)?.memory).toEqual({ characters: null, pointerIndex: null, length: null, inScope: true })
    expect(result.length).toBeNull()
    expect(result.output).toEqual([])
    expect(result.outputText).toBe('')
    expect(buildStringPointerSource(input).sourceText).not.toContain('unsafe();')
    expect(getStringPointerSample('invalid' as StringSample)).toBeUndefined()
  })

  it('rejects each invalid field independently while accepting every preset/sentinel combination', () => {
    expect(simulateStringPointerProgram(config({ stopAt: 'invalid' as StringStop })).blockReason).toBe('invalid-config')
    expect(simulateStringPointerProgram(config({ sample: 'invalid' as StringSample })).blockReason).toBe('invalid-config')
    for (const sample of STRING_POINTER_SAMPLES) {
      for (const stopAt of ['nul', 'digit-zero'] as const) {
        expect(validateStringPointerConfig(config({ sample: sample.id, stopAt }))).toEqual([])
      }
    }
  })
})
