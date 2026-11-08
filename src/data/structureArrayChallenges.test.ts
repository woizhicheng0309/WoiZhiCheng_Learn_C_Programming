import { STRUCTURE_ARRAY_CHALLENGE_IDS, evaluateStructureArrayChallenge } from './structureArrayChallenges'

it('checks array member syntax, updated totals and the first failing index', () => {
  STRUCTURE_ARRAY_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateStructureArrayChallenge(id, ['1', '245 2', '2 3'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '1.0', '1 1', '-1', '1 2 3']) expect(evaluateStructureArrayChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateStructureArrayChallenge('predict-structure-array-totals', '245，2').solved).toBe(true)
  expect(evaluateStructureArrayChallenge('predict-structure-array-totals', '235 2').solved).toBe(false)
  expect(evaluateStructureArrayChallenge('check-structure-array-bound', '3 3').solved).toBe(false)
  expect(evaluateStructureArrayChallenge('choose-structure-array-member', '2').solved).toBe(false)
})
