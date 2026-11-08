import { ALLOCATION_CHALLENGE_IDS, evaluateAllocationChallenge } from './allocationChallenges'

it('requires initialization, the computed sum and no use after free', () => {
  ALLOCATION_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateAllocationChallenge(id, ['2', '18', '3'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '2.0', '2 3', '-1']) expect(evaluateAllocationChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateAllocationChallenge('choose-malloc-initialization', '1').solved).toBe(false)
  expect(evaluateAllocationChallenge('predict-allocated-sum', '0').solved).toBe(false)
  expect(evaluateAllocationChallenge('check-free-lifetime', '2').solved).toBe(false)
})
