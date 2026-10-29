import {
  POINTER_CHALLENGES,
  POINTER_CHALLENGE_IDS,
  evaluateNullPointer,
  evaluatePointerPrediction,
  evaluatePointerWrite,
} from './pointerChallenges'

describe('pointer practice challenges', () => {
  it('has a prediction, a pointer write, and a NULL-safety challenge', () => {
    expect(POINTER_CHALLENGES.map((challenge) => challenge.id)).toEqual(POINTER_CHALLENGE_IDS)
    expect(new Set(POINTER_CHALLENGE_IDS).size).toBe(3)
  })

  it('requires the pointee value rather than the other variable or a null answer', () => {
    expect(evaluatePointerPrediction(5).solved).toBe(true)
    for (const answer of [null, 9, 12, NaN, Infinity]) {
      expect(evaluatePointerPrediction(answer).solved).toBe(false)
    }
  })

  it('checks the real write and rejects missing, invalid, or incorrect values', () => {
    expect(evaluatePointerWrite(12)).toMatchObject({ solved: true, message: expect.stringContaining('x 仍然是 5') })
    for (const answer of [null, 5, 9, 12.5, NaN, Infinity, -21, 101]) {
      expect(evaluatePointerWrite(answer).solved).toBe(false)
    }
  })

  it('requires identifying NULL dereference as unsafe and explains undefined behavior', () => {
    expect(evaluateNullPointer('unsafe')).toMatchObject({ solved: true, message: expect.stringContaining('未定義行為') })
    expect(evaluateNullPointer('safe').solved).toBe(false)
    expect(evaluateNullPointer(null).solved).toBe(false)
  })
})
