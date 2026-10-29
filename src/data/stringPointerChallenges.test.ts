import {
  STRING_POINTER_CHALLENGES,
  STRING_POINTER_CHALLENGE_IDS,
  evaluateDigitZeroLength,
  evaluateEmbeddedNul,
  evaluateStringTerminator,
} from './stringPointerChallenges'

describe('char pointer challenges', () => {
  it('orders digit zero length, correct terminator and embedded NUL', () => {
    expect(STRING_POINTER_CHALLENGES.map((challenge) => challenge.id)).toEqual(STRING_POINTER_CHALLENGE_IDS)
    expect(new Set(STRING_POINTER_CHALLENGE_IDS).size).toBe(3)
  })

  it('counts the digit 0 as part of C0DE content but excludes the implicit NUL', () => {
    expect(evaluateDigitZeroLength(4)).toMatchObject({ solved: true, message: expect.stringContaining('長度是 4') })
    for (const answer of [null, 1, 3, 5, NaN, Infinity, 4.5]) {
      expect(evaluateDigitZeroLength(answer).solved).toBe(false)
    }
  })

  it('requires NUL rather than the visible digit and explains their different code values', () => {
    const correct = evaluateStringTerminator('nul')
    expect(correct.solved).toBe(true)
    expect(correct.message).toContain('0 與 48')
    expect(evaluateStringTerminator('digit-zero').solved).toBe(false)
    expect(evaluateStringTerminator(null).solved).toBe(false)
  })

  it('stops at the first embedded NUL despite additional stored letters', () => {
    expect(evaluateEmbeddedNul('CO')).toMatchObject({ solved: true, message: expect.stringContaining('長度是 2') })
    expect(evaluateEmbeddedNul('CO').message).toContain('仍在陣列中')
    expect(evaluateEmbeddedNul('CODE').solved).toBe(false)
    expect(evaluateEmbeddedNul(null).solved).toBe(false)
  })
})
