import { DEFAULT_FUNCTION_CONFIG } from '../domain/functions'
import {
  FUNCTION_CHALLENGE_IDS,
  FUNCTION_CHALLENGES,
  FUNCTION_TARGET_RETURN_VALUE,
  evaluateFunctionChallenge,
  evaluateFunctionPrediction,
  evaluateFunctionScope,
  evaluateMakeReturnTen,
  getFunctionChallengeById,
} from './functionChallenges'

describe('function challenges', () => {
  it('defines three stable challenges in learning order', () => {
    expect(FUNCTION_CHALLENGES.map((challenge) => challenge.id)).toEqual(
      FUNCTION_CHALLENGE_IDS,
    )
    expect(FUNCTION_CHALLENGES.map((challenge) => challenge.order)).toEqual([
      1, 2, 3,
    ])
    expect(FUNCTION_CHALLENGES.map((challenge) => challenge.kind)).toEqual([
      'prediction',
      'configuration',
      'scope',
    ])
    expect(FUNCTION_CHALLENGES.map((challenge) => challenge.editableFields)).toEqual([
      [],
      ['x', 'y'],
      [],
    ])
  })

  it('looks up known IDs and returns undefined for an unknown runtime ID', () => {
    expect(getFunctionChallengeById('make-return-ten')?.order).toBe(2)
    expect(
      getFunctionChallengeById('unknown' as (typeof FUNCTION_CHALLENGE_IDS)[number]),
    ).toBeUndefined()
  })

  it('checks the return prediction against the actual simulation', () => {
    const correct = evaluateFunctionPrediction(7)

    expect(correct.solved).toBe(true)
    expect(correct.simulation.returnValue).toBe(7)
    expect(correct.simulation.answerValue).toBe(7)
    expect(correct.simulation.output).toEqual([7])
    expect(evaluateFunctionPrediction(6).solved).toBe(false)
    expect(evaluateFunctionPrediction(null).solved).toBe(false)
  })

  it.each([
    { x: 4, y: 6 },
    { x: -10, y: 20 },
    { x: 20, y: -10 },
    { x: 10, y: 0 },
  ])('accepts any legal arguments whose real return value is 10', ({ x, y }) => {
    const evaluation = evaluateMakeReturnTen({ x, y })

    expect(evaluation.solved).toBe(true)
    expect(evaluation.simulation.status).toBe('completed')
    expect(evaluation.simulation.returnValue).toBe(FUNCTION_TARGET_RETURN_VALUE)
    expect(evaluation.simulation.output).toEqual([FUNCTION_TARGET_RETURN_VALUE])
  })

  it('rejects a wrong return and any blocked config', () => {
    expect(evaluateMakeReturnTen({ x: 4, y: 3 }).solved).toBe(false)

    const blocked = evaluateMakeReturnTen({ x: Number.NaN, y: 10 })
    expect(blocked.solved).toBe(false)
    expect(blocked.simulation.status).toBe('blocked')
    expect(blocked.simulation.output).toEqual([])

    expect(evaluateMakeReturnTen({ x: 21, y: -11 }).solved).toBe(false)
  })

  it('identifies answer as the only listed name still in main scope', () => {
    const correct = evaluateFunctionScope('answer')

    expect(correct.solved).toBe(true)
    expect(evaluateFunctionScope('result').solved).toBe(false)
    expect(evaluateFunctionScope('a').solved).toBe(false)
    expect(evaluateFunctionScope('b').solved).toBe(false)
    expect(evaluateFunctionScope(null).solved).toBe(false)

    const backInMain = correct.simulation.frames.find(
      (frame) => frame.phase === 'assign-answer',
    )!
    expect(backInMain.mainFrame.answer.inScope).toBe(true)
    expect(backInMain.addFrame.a.inScope).toBe(false)
    expect(backInMain.addFrame.b.inScope).toBe(false)
    expect(backInMain.addFrame.result.inScope).toBe(false)
  })

  it('dispatches all three discriminated challenge attempts', () => {
    expect(evaluateFunctionChallenge({
      challengeId: 'predict-return-value',
      prediction: 7,
    }).solved).toBe(true)
    expect(evaluateFunctionChallenge({
      challengeId: 'make-return-ten',
      config: { x: 3, y: 7 },
    }).solved).toBe(true)
    expect(evaluateFunctionChallenge({
      challengeId: 'identify-local-scope',
      answer: 'answer',
    }).solved).toBe(true)
  })

  it('does not mutate a submitted config while evaluating it', () => {
    const submitted = { ...DEFAULT_FUNCTION_CONFIG }
    const original = { ...submitted }

    evaluateMakeReturnTen(submitted)

    expect(submitted).toEqual(original)
  })
})
