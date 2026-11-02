import { RECURSION_CHALLENGE_IDS, evaluateRecursionChallenge } from './recursionChallenges'
it('checks the factorial, zero base case and innermost first return', () => {
  RECURSION_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateRecursionChallenge(id, ['6', '1', '1'][index]).solved).toBe(true)
    for (const answer of ['', '-1', 'NaN', '1e0', '6x', '0']) expect(evaluateRecursionChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateRecursionChallenge('identify-first-return', '4').solved).toBe(false)
})
