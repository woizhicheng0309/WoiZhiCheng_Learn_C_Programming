import { BINARY_SEARCH_CHALLENGE_IDS, evaluateBinarySearchChallenge } from './binarySearchChallenges'
it('checks middle index, next left bound and the missing-target sentinel', () => {
  BINARY_SEARCH_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateBinarySearchChallenge(id, ['3', '4', '-1'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1e0', '3.0', '3x', '9']) expect(evaluateBinarySearchChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateBinarySearchChallenge('update-left-bound', '3').solved).toBe(false)
})
