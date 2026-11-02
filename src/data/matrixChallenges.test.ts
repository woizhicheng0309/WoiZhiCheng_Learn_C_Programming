import { MATRIX_CHALLENGE_IDS, evaluateMatrixChallenge } from './matrixChallenges'
it('checks cell lookup, complete column-first traversal and element offset', () => {
  const answers = ['6', '1 4 2 5 3 6', '4']
  MATRIX_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateMatrixChallenge(id, answers[index]).solved).toBe(true)
    for (const answer of ['', '0', '-1', 'NaN', '1x', '1 2 3 4 5 6', `${answers[index]} 9`]) {
      expect(evaluateMatrixChallenge(id, answer).solved).toBe(false)
    }
  })
  expect(evaluateMatrixChallenge('predict-column-traversal', '1，4，2，5，3，6').solved).toBe(true)
})
