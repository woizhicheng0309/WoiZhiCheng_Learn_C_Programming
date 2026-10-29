import {
  WHILE_CHALLENGES,
  WHILE_CHALLENGE_IDS,
  evaluateDoOnce,
  evaluateWhileUpdate,
  evaluateWhileZero,
} from './whileChallenges'

describe('while and do-while challenges', () => {
  it('orders pre-test prediction, post-test prediction and variable updates', () => {
    expect(WHILE_CHALLENGES.map((challenge) => challenge.id)).toEqual(WHILE_CHALLENGE_IDS)
    expect(new Set(WHILE_CHALLENGE_IDS).size).toBe(3)
  })

  it('requires zero bodies when the initial while condition is false', () => {
    expect(evaluateWhileZero(0)).toMatchObject({ solved: true, message: expect.stringContaining('不會更新 i') })
    for (const answer of [null, 1, 5, NaN, Infinity, 0.5]) expect(evaluateWhileZero(answer).solved).toBe(false)
  })

  it('requires one do-while body and explains the comparison after updating', () => {
    expect(evaluateDoOnce(1)).toMatchObject({ solved: true, message: expect.stringContaining('6 < 3') })
    for (const answer of [null, 0, 5, NaN, Infinity, 1.5]) expect(evaluateDoOnce(answer).solved).toBe(false)
  })

  it('requires changing i rather than assuming printf changes it', () => {
    expect(evaluateWhileUpdate('increment')).toMatchObject({ solved: true, message: expect.stringContaining('printf 只輸出') })
    expect(evaluateWhileUpdate('unchanged').solved).toBe(false)
    expect(evaluateWhileUpdate(null).solved).toBe(false)
  })
})
