import { STRING_COPY_CHALLENGE_IDS, evaluateStringCopyChallenge } from './stringCopyChallenges'

it('requires the terminator, spare capacity and the distinct length/array size', () => {
  STRING_COPY_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateStringCopyChallenge(id, ['5', '5', '2 6'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '0', '4', '5.0']) expect(evaluateStringCopyChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateStringCopyChallenge('compare-string-length-size', '2，6').solved).toBe(true)
  expect(evaluateStringCopyChallenge('compare-string-length-size', '2 3').solved).toBe(false)
  expect(evaluateStringCopyChallenge('compare-string-length-size', '6 2').solved).toBe(false)
})
