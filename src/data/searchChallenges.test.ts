import { SEARCH_CHALLENGE_IDS, evaluateSearchChallenge } from './searchChallenges'
it('checks first, last and not-found indexes rather than element values', () => {
  SEARCH_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateSearchChallenge(id, ['1', '3', '-1'][index]).solved).toBe(true)
    for (const answer of ['', '7', 'NaN', '1x', '1.0', '1 3']) expect(evaluateSearchChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateSearchChallenge('identify-not-found', '0').solved).toBe(false)
})
