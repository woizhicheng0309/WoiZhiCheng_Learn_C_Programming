import {
  LOOP_CONTROL_CHALLENGES,
  LOOP_CONTROL_CHALLENGE_IDS,
  evaluateBreakOutput,
  evaluateContinueSum,
  evaluateContinueUpdate,
} from './loopControlChallenges'

describe('break and continue challenges', () => {
  it('orders the output prediction, sum prediction and control-flow decision', () => {
    expect(LOOP_CONTROL_CHALLENGES.map((challenge) => challenge.id))
      .toEqual(LOOP_CONTROL_CHALLENGE_IDS)
    expect(new Set(LOOP_CONTROL_CHALLENGE_IDS).size).toBe(3)
  })

  it('accepts the exact output before break with common separators', () => {
    for (const answer of ['1 2', ' 1, 2 ', '1，2', '1\n2']) {
      expect(evaluateBreakOutput(answer)).toMatchObject({
        solved: true,
        message: expect.stringContaining('不會執行 i++'),
      })
    }
    for (const answer of ['', '1 2 3', '2 1', '1.0 2', '1 NaN', '1 2x']) {
      expect(evaluateBreakOutput(answer).solved).toBe(false)
    }
  })

  it('includes later iterations in the sum after continue', () => {
    expect(evaluateContinueSum(12)).toMatchObject({
      solved: true,
      message: expect.stringContaining('1 + 2 + 4 + 5 = 12'),
    })
    for (const answer of [null, 3, 15, 12.5, Number.NaN, Infinity]) {
      expect(evaluateContinueSum(answer).solved).toBe(false)
    }
  })

  it('requires the for update before the next condition', () => {
    expect(evaluateContinueUpdate('increment')).toMatchObject({
      solved: true,
      message: expect.stringContaining('更新式 i++'),
    })
    expect(evaluateContinueUpdate('condition').solved).toBe(false)
    expect(evaluateContinueUpdate('exit').solved).toBe(false)
    expect(evaluateContinueUpdate(null).solved).toBe(false)
  })
})
