import { STRUCTURE_POINTER_CHALLENGE_IDS, evaluateStructurePointerChallenge } from './structurePointerChallenges'

it('checks member syntax, address copying and the null guard independently of lab controls', () => {
  STRUCTURE_POINTER_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateStructurePointerChallenge(id, ['1', '95 70', '1 0'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '1.0', '1 1', '-1', '1 2 3']) expect(evaluateStructurePointerChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateStructurePointerChallenge('predict-structure-pointer-alias', '95，70').solved).toBe(true)
  expect(evaluateStructurePointerChallenge('predict-structure-pointer-alias', '70 95').solved).toBe(false)
  expect(evaluateStructurePointerChallenge('choose-structure-arrow', '3').solved).toBe(false)
  expect(evaluateStructurePointerChallenge('check-structure-null-guard', '0 0').solved).toBe(false)
})
