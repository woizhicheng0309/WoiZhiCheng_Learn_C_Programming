import { ARRAY_PARAMETER_CHALLENGE_IDS, evaluateArrayParameterChallenge } from './arrayParameterChallenges'

it('requires the prefix sum, the actual caller array and an explicit element count', () => {
  ARRAY_PARAMETER_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateArrayParameterChallenge(id, ['13', '6 9 4 9 5', '2'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '0', '13.0', '4 7 2 9 5']) expect(evaluateArrayParameterChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateArrayParameterChallenge('predict-shared-array', '6，9，4，9，5').solved).toBe(true)
  expect(evaluateArrayParameterChallenge('predict-array-return', '27').solved).toBe(false)
  expect(evaluateArrayParameterChallenge('choose-explicit-count', '1').solved).toBe(false)
})
