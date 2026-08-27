import {
  CONDITIONAL_LIMITS,
  DEFAULT_CONDITIONAL_CONFIG,
  buildConditionalSource,
  combineConditionalValues,
  normalizeConditionalConfig,
  simulateConditional,
} from './conditionals'

describe('conditional simulator', () => {
  it('evaluates the default && example and selects else', () => {
    const simulation = simulateConditional(DEFAULT_CONDITIONAL_CONFIG)

    expect(simulation.conditionResult).toBe(false)
    expect(simulation.scorePasses).toBe(true)
    expect(simulation.attendancePasses).toBe(false)
    expect(simulation.selectedBranch).toBe('else')
    expect(simulation.output).toEqual(['再練習'])
    expect(simulation.frames.map((frame) => frame.phase)).toEqual([
      'main',
      'init-score',
      'init-attendance',
      'compare-score',
      'compare-attendance',
      'combine',
      'else-branch',
      'print',
      'return',
      'done',
    ])
    expect(simulation.frames.find((frame) => frame.phase === 'print')).toMatchObject({
      activeLine: 10,
      activePart: 'printf-practice',
      output: ['再練習'],
    })
  })

  it('short-circuits the right side when && already knows the result', () => {
    const simulation = simulateConditional({
      score: 40,
      attendance: 100,
      logicalOperator: '&&',
    })

    expect(simulation.shortCircuited).toBe(true)
    expect(simulation.frames.map((frame) => frame.phase)).toContain('short-circuit')
    expect(simulation.frames.find((frame) => frame.phase === 'short-circuit')).toMatchObject({
      scorePasses: false,
      attendancePasses: null,
      skippedComparison: 'attendance',
      conditionResult: false,
    })
    expect(simulation.output).toEqual(['再練習'])
  })

  it('short-circuits the right side when || already knows the result', () => {
    const simulation = simulateConditional({
      score: 100,
      attendance: 0,
      logicalOperator: '||',
    })

    expect(simulation.shortCircuited).toBe(true)
    expect(simulation.conditionResult).toBe(true)
    expect(simulation.selectedBranch).toBe('if')
    expect(simulation.output).toEqual(['通過'])
    expect(simulation.frames.find((frame) => frame.phase === 'print')).toMatchObject({
      activeLine: 8,
      activePart: 'printf-pass',
    })
  })

  it('normalizes values to the safe integer control bounds', () => {
    expect(normalizeConditionalConfig({
      score: 999.9,
      attendance: -3.7,
      logicalOperator: 'not-an-operator' as '&&',
    })).toEqual({
      score: CONDITIONAL_LIMITS.score.max,
      attendance: CONDITIONAL_LIMITS.attendance.min,
      logicalOperator: '&&',
    })
    expect(buildConditionalSource({ ...DEFAULT_CONDITIONAL_CONFIG, logicalOperator: '||' }).lines.find((line) => line.lineNumber === 7)?.code)
      .toContain('score >= 60 || attendance >= 70')
  })

  it('combines the truth table with the selected logical operator', () => {
    expect(combineConditionalValues(true, true, '&&')).toBe(true)
    expect(combineConditionalValues(true, false, '&&')).toBe(false)
    expect(combineConditionalValues(false, true, '||')).toBe(true)
    expect(combineConditionalValues(false, false, '||')).toBe(false)
  })
})
