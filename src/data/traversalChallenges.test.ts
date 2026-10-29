import {
  TRAVERSAL_CHALLENGES,
  TRAVERSAL_CHALLENGE_IDS,
  evaluateOnePast,
  evaluateTraversalOffset,
  evaluateTraversalStep,
} from './traversalChallenges'

describe('pointer traversal challenges', () => {
  it('orders offset prediction, element scaling and one-past safety', () => {
    expect(TRAVERSAL_CHALLENGES.map((challenge) => challenge.id)).toEqual(TRAVERSAL_CHALLENGE_IDS)
    expect(new Set(TRAVERSAL_CHALLENGE_IDS).size).toBe(3)
  })

  it('reads the third element for a two-element pointer displacement', () => {
    expect(evaluateTraversalOffset(2)).toMatchObject({ solved: true, message: expect.stringContaining('scores[2]') })
    for (const answer of [null, 4, 7, 9, NaN, Infinity]) {
      expect(evaluateTraversalOffset(answer).solved).toBe(false)
    }
  })

  it('requires element-sized steps without assuming a fixed int byte size', () => {
    const correct = evaluateTraversalStep('one-element')
    expect(correct.solved).toBe(true)
    expect(correct.message).toContain('sizeof(*p)')
    expect(correct.message).toContain('不能固定假定為 4 bytes')
    expect(evaluateTraversalStep('one-byte').solved).toBe(false)
    expect(evaluateTraversalStep(null).solved).toBe(false)
  })

  it('allows forming one-past but rejects dereferencing it', () => {
    expect(evaluateOnePast('form-only')).toMatchObject({
      solved: true, message: expect.stringContaining('卻不能解參照'),
    })
    expect(evaluateOnePast('dereference').solved).toBe(false)
    expect(evaluateOnePast(null).solved).toBe(false)
  })
})
