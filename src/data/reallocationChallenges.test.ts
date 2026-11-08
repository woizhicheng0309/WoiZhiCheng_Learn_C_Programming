import { REALLOCATION_CHALLENGE_IDS, evaluateReallocationChallenge } from './reallocationChallenges'

it('requires a temporary pointer, preserved prefixes and initialized growth', () => {
  REALLOCATION_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateReallocationChallenge(id, ['2', '5 32', '2 11'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '2x', '2.0', '1 1', '-1', '1 2 3']) expect(evaluateReallocationChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateReallocationChallenge('predict-realloc-growth', '5，32').solved).toBe(true)
  expect(evaluateReallocationChallenge('choose-realloc-temporary', '1').solved).toBe(false)
  expect(evaluateReallocationChallenge('predict-realloc-shrink', '3 20').solved).toBe(false)
})
