import { STRING_COMPARISON_CHALLENGE_IDS, evaluateStringComparisonChallenge } from './stringComparisonChallenges'

it('requires the first different index, a prefix sign and the portable positive-result test', () => {
  STRING_COMPARISON_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateStringComparisonChallenge(id, ['2', '-1', '2'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '2x', '0', '2.0', '2 2']) expect(evaluateStringComparisonChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateStringComparisonChallenge('compare-prefix-sign', '1').solved).toBe(false)
  expect(evaluateStringComparisonChallenge('choose-strcmp-sign-check', '1').solved).toBe(false)
  expect(evaluateStringComparisonChallenge('find-first-difference', ' 2 ').solved).toBe(true)
})
