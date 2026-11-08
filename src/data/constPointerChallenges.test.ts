import { CONST_POINTER_CHALLENGE_IDS, evaluateConstPointerChallenge } from './constPointerChallenges'

it('requires the correct const placement, fixed-pointer write and mutable-original alias value', () => {
  CONST_POINTER_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateConstPointerChallenge(id, ['1', '30 20 30', '30'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '0', '30.0', '10 20 10']) expect(evaluateConstPointerChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateConstPointerChallenge('predict-fixed-pointer-write', '30，20，30').solved).toBe(true)
  expect(evaluateConstPointerChallenge('choose-pointee-const', '2').solved).toBe(false)
  expect(evaluateConstPointerChallenge('predict-direct-alias-write', '10').solved).toBe(false)
})
