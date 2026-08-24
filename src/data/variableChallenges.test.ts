import {
  VARIABLE_CHALLENGE_IDS,
  VARIABLE_CHALLENGES,
  evaluateDivisionPrediction,
  evaluateDivisionRepair,
  evaluateMakeFourteen,
  evaluateVariableChallenge,
} from './variableChallenges'

describe('variable challenges', () => {
  it('defines the prediction, configuration, and diagnosis sequence', () => {
    expect(VARIABLE_CHALLENGES.map((challenge) => challenge.id)).toEqual(
      VARIABLE_CHALLENGE_IDS,
    )
    expect(VARIABLE_CHALLENGES.map((challenge) => challenge.kind)).toEqual([
      'prediction',
      'configuration',
      'diagnosis',
    ])
    expect(VARIABLE_CHALLENGES.map((challenge) => challenge.editableFields)).toEqual([
      [],
      ['x', 'y'],
      ['y'],
    ])
  })

  it('accepts only 2 for the fixed 5 / 2 int prediction', () => {
    const correct = evaluateDivisionPrediction(2)

    expect(correct.solved).toBe(true)
    expect(correct.simulation.output).toEqual([2])
    expect(evaluateDivisionPrediction(2.5).solved).toBe(false)
    expect(evaluateDivisionPrediction(null).solved).toBe(false)
  })

  it.each([
    { x: 7, y: 7 },
    { x: -6, y: 20 },
    { x: 20, y: -6 },
  ])('accepts any legal int addition that actually outputs 14', ({ x, y }) => {
    const evaluation = evaluateMakeFourteen({
      valueType: 'int',
      x,
      y,
      operator: '+',
    })

    expect(evaluation.solved).toBe(true)
    expect(evaluation.simulation.output).toEqual([14])
  })

  it('rejects 14 produced by changing the required type or operator', () => {
    expect(
      evaluateMakeFourteen({
        valueType: 'double',
        x: 7,
        y: 7,
        operator: '+',
      }).solved,
    ).toBe(false)
    expect(
      evaluateMakeFourteen({
        valueType: 'int',
        x: 20,
        y: 6,
        operator: '-',
      }).solved,
    ).toBe(false)
  })

  it('requires both the correct diagnosis and the exact y repair', () => {
    const initialConfig = {
      valueType: 'int' as const,
      x: 8,
      y: 0,
      operator: '/' as const,
    }
    const repairedConfig = { ...initialConfig, y: 2 }

    expect(
      evaluateDivisionRepair('division-by-zero', initialConfig).solved,
    ).toBe(false)
    expect(
      evaluateDivisionRepair('integer-division', repairedConfig).solved,
    ).toBe(false)

    const correct = evaluateDivisionRepair('division-by-zero', repairedConfig)
    expect(correct.solved).toBe(true)
    expect(correct.simulation.output).toEqual([4])
  })

  it('does not allow fields other than y to be changed in the repair', () => {
    expect(
      evaluateDivisionRepair('division-by-zero', {
        valueType: 'int',
        x: 4,
        y: 1,
        operator: '/',
      }).solved,
    ).toBe(false)
  })

  it('dispatches all three discriminated challenge attempts', () => {
    expect(
      evaluateVariableChallenge({
        challengeId: 'predict-int-division',
        prediction: 2,
      }).solved,
    ).toBe(true)
    expect(
      evaluateVariableChallenge({
        challengeId: 'make-fourteen',
        config: { valueType: 'int', x: 10, y: 4, operator: '+' },
      }).solved,
    ).toBe(true)
    expect(
      evaluateVariableChallenge({
        challengeId: 'repair-division-by-zero',
        diagnosis: 'division-by-zero',
        config: { valueType: 'int', x: 8, y: 2, operator: '/' },
      }).solved,
    ).toBe(true)
  })
})
