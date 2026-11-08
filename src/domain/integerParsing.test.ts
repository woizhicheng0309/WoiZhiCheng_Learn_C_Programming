import { DEFAULT_INTEGER_PARSING_CONFIG, INTEGER_INPUT_PRESETS, buildIntegerParsingSource, escapeIntegerInput, longModelLimits, simulateIntegerParsingProgram, validateIntegerParsingConfig, type IntegerParsingConfig } from './integerParsing'

const run = (text: string, overrides: Partial<IntegerParsingConfig> = {}) => simulateIntegerParsingProgram({ ...DEFAULT_INTEGER_PARSING_CONFIG, text, ...overrides })

it.each([
  ['0', '0', 1], ['-0', '0', 2], ['+0', '0', 2], ['000', '0', 3],
  ['42', '42', 2], ['010', '10', 3], [' \t-17', '-17', 5],
  ['2147483647', '2147483647', 10], ['-2147483648', '-2147483648', 11],
])('accepts complete base-ten input %j', (text, value, end) => {
  expect(run(text)).toMatchObject({ status: 'completed', value, conversionEnd: end, endIndex: end, errno: '0', exitCode: 0, stdout: `value=${value}\n` })
})
it.each(['', ' ', '\t\n', '+', '-', ' +', 'abc', ' +x', '--1'])('rejects no-conversion input %j and returns end to the original start', text => {
  const result = run(text)
  expect(result).toMatchObject({ value: '0', conversionEnd: 0, endIndex: 0, errno: '0', exitCode: 1, stdout: 'no digits\n' })
  expect(result.frames.some(frame => frame.phase === 'check-range')).toBe(false)
  expect(result.frames.some(frame => frame.phase === 'set-policy')).toBe(false)
})
it.each([
  ['42abc', '42', 2], ['0x10', '0', 1], ['12.5', '12', 2], ['1 2', '1', 1], ['42\n', '42', 2],
])('retains the converted prefix but rejects trailing input %j', (text, value, end) => {
  expect(run(text)).toMatchObject({ value, conversionEnd: end, endIndex: end, errno: '0', exitCode: 3, stdout: 'trailing data\n' })
})
it('distinguishes the original conversion end from the later moved pointer', () => {
  expect(run(' \t-17 \n')).toMatchObject({ value: '-17', conversionEnd: 5, endIndex: 5, exitCode: 3 })
  const result = run(' \t-17 \n', { allowTrailingSpace: true })
  expect(result).toMatchObject({ value: '-17', conversionEnd: 5, endIndex: 7, exitCode: 0 })
  expect(result.frames.filter(frame => frame.phase === 'advance-end').map(frame => frame.endIndex)).toEqual([6, 7])
  expect(result.frames.filter(frame => frame.phase === 'tail-condition').map(frame => frame.condition?.value)).toEqual([true, true, false])
})
it('recognizes all C-locale ASCII spaces and still rejects nonspace suffixes', () => {
  expect(run('\t\n\r\v\f 42 \t\n\r\v\f', { allowTrailingSpace: true })).toMatchObject({ value: '42', exitCode: 0 })
  expect(run('42 \tx', { allowTrailingSpace: true })).toMatchObject({ endIndex: 4, conversionEnd: 2, exitCode: 3 })
})
it.each([
  [32, '2147483648', '2147483647'], [32, '-2147483649', '-2147483648'],
  [64, '9223372036854775808', '9223372036854775807'], [64, '-9223372036854775809', '-9223372036854775808'],
] as const)('clamps %i-bit overflow %s while consuming every decimal digit', (longBits, text, value) => {
  expect(run(text, { longBits })).toMatchObject({ value, conversionEnd: text.length, endIndex: text.length, errno: 'ERANGE', exitCode: 2, stdout: 'out of range\n' })
})
it.each(['9223372036854775807', '-9223372036854775808', '9007199254740993'])('preserves exact 64-bit values beyond Number precision: %s', text => {
  expect(run(text, { longBits: 64 })).toMatchObject({ value: text, errno: '0', exitCode: 0, stdout: `value=${text}\n` })
})
it('changes the simulated range without changing the C long declaration', () => {
  expect(run('2147483648').exitCode).toBe(2)
  expect(run('2147483648', { longBits: 64 }).exitCode).toBe(0)
  expect(run('2147483648').source).toEqual(run('2147483648', { longBits: 64 }).source)
  expect(longModelLimits(32)).toEqual({ min: '-2147483648', max: '2147483647' })
  expect(longModelLimits(64)).toEqual({ min: '-9223372036854775808', max: '9223372036854775807' })
})
it('checks range before trailing data and never accepts a clamped return value', () => {
  const text = '9'.repeat(35) + ' abc'
  const result = run(text, { allowTrailingSpace: true })
  expect(result).toMatchObject({ value: '2147483647', conversionEnd: 35, endIndex: 35, errno: 'ERANGE', exitCode: 2 })
  expect(result.frames.some(frame => frame.phase === 'check-tail')).toBe(false)
})
it('keeps conceptual scan details separate from main variables until the call returns', () => {
  const result = run(' +123')
  const scanning = result.frames.filter(frame => ['begin-conversion', 'skip-leading-space', 'read-sign', 'read-digit'].includes(frame.phase))
  expect(scanning.length).toBe(6)
  for (const frame of scanning) expect(frame).toMatchObject({ value: null, endIndex: null, conversionEnd: null, errno: '0', predictionValue: null })
  expect(scanning.at(-1)).toMatchObject({ magnitude: '123', sign: 1, digitCount: 3, scanIndex: 5 })
  expect(run(' +').frames.find(frame => frame.phase === 'finish-conversion')).toMatchObject({ scanIndex: 2, endIndex: 0, value: '0' })
})
it.each(['42', '', '42x', '2147483648'])('only reveals prediction on return, preserves output, and ends main scope: %j', text => {
  const result = run(text)
  for (const frame of result.frames) {
    expect(frame.activePart).toBe(`line-${frame.activeLine}`)
    expect(frame.activeLine).toBeGreaterThanOrEqual(1)
    expect(frame.activeLine).toBeLessThanOrEqual(result.source.lines.length)
    if (!frame.phase.startsWith('return-') && frame.phase !== 'done') expect(frame.predictionValue).toBeNull()
  }
  expect(result.frames.at(-2)).toMatchObject({ mainInScope: true, exitCode: result.exitCode, predictionValue: result.exitCode })
  expect(result.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false, output: result.output })
  expect(result.frames[0].output).toEqual([])
})
it('escapes C string literals including C11 trigraph characters without source injection', () => {
  const text = '"\\??/\t\n\r\v\f'
  expect(escapeIntegerInput(text)).toBe('\\"\\\\\\?\\?/\\t\\n\\r\\v\\f')
  const source = buildIntegerParsingSource({ ...DEFAULT_INTEGER_PARSING_CONFIG, text })
  expect(source.lines).toHaveLength(31)
  expect(source.lines[6].code).toBe(`  const char text[] = "${escapeIntegerInput(text)}";`)
  expect(source.sourceText.split('\n')).toHaveLength(31)
  expect(source.lines[20].code).toContain('isspace((unsigned char)*end)')
  expect(source.lines[24].code).toBe("  if (*end != '\\0') {")
  expect(source.lines[28].code).toBe('  printf("value=%ld\\n", value);')
})
it.each([
  { text: '中' }, { text: '\0' }, { text: '1'.repeat(41) }, { text: 1 }, { text: { toString: null } },
  { longBits: '32' }, { longBits: 16 }, { longBits: NaN }, { allowTrailingSpace: 'false' }, { allowTrailingSpace: 0 },
])('blocks invalid configuration before creating objects: %j', overrides => {
  const config = { ...DEFAULT_INTEGER_PARSING_CONFIG, ...overrides } as IntegerParsingConfig
  expect(validateIntegerParsingConfig(config).length).toBeGreaterThan(0)
  const result = simulateIntegerParsingProgram(config)
  expect(result).toMatchObject({ status: 'blocked', exitCode: null, value: null, output: [] })
  expect(result.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
  expect(result.frames.at(-1)).toMatchObject({ mainInScope: false, textDeclared: false, endDeclared: false })
})
it('accepts every preset and does not mutate the supplied configuration', () => {
  for (const preset of Object.values(INTEGER_INPUT_PRESETS)) {
    const config = Object.freeze({ ...DEFAULT_INTEGER_PARSING_CONFIG, text: preset.text })
    expect(simulateIntegerParsingProgram(config).status).toBe('completed')
    expect(config.text).toBe(preset.text)
  }
})
