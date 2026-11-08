import { STRUCTURE_CHALLENGE_IDS, evaluateStructureChallenge } from './structureChallenges'

it('requires dot access, independent member values and zero-filled omitted members', () => {
  STRUCTURE_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateStructureChallenge(id, ['1', '80 95', '0 0'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '0.0', '1 1']) expect(evaluateStructureChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateStructureChallenge('predict-structure-copy', '80，95').solved).toBe(true)
  expect(evaluateStructureChallenge('predict-structure-copy', '95 95').solved).toBe(false)
  expect(evaluateStructureChallenge('choose-struct-member', '2').solved).toBe(false)
  expect(evaluateStructureChallenge('predict-partial-structure', '0').solved).toBe(false)
})
