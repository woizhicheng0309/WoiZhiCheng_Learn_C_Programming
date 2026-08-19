import {
  evaluateCourseCondition,
  evaluateIntegerExpression,
} from './foundationSimulator'

describe('integer expression simulator', () => {
  it.each([
    [8, 3, '+' as const, 11],
    [8, 3, '-' as const, 5],
    [8, 3, '*' as const, 24],
    [8, 3, '/' as const, 2],
    [8, 3, '%' as const, 2],
    [-7, 2, '/' as const, -3],
    [-7, 2, '%' as const, -1],
  ])('evaluates %i %s %i with C integer behavior', (left, right, operator, expected) => {
    expect(evaluateIntegerExpression(left, right, operator)).toMatchObject({
      status: 'ok',
      result: expected,
    })
  })

  it('blocks division and remainder by zero', () => {
    expect(evaluateIntegerExpression(8, 0, '/')).toMatchObject({
      status: 'blocked',
      result: null,
    })
    expect(evaluateIntegerExpression(8, 0, '%')).toMatchObject({
      status: 'blocked',
      result: null,
    })
  })
})

describe('conditional simulator', () => {
  it('requires both comparisons when using logical AND', () => {
    expect(evaluateCourseCondition(80, 65, '&&')).toMatchObject({
      scorePasses: true,
      attendancePasses: false,
      result: false,
      selectedBranch: 'else',
      output: '再練習',
    })
  })

  it('accepts either comparison when using logical OR', () => {
    expect(evaluateCourseCondition(80, 65, '||')).toMatchObject({
      result: true,
      selectedBranch: 'if',
      output: '通過',
    })
  })
})
