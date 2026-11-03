import { INSERTION_SORT_CHALLENGE_IDS, evaluateInsertionSortChallenge } from './insertionSortChallenges'
it('checks the first insertion pass, short-circuiting and shifts on sorted input', () => {
  INSERTION_SORT_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateInsertionSortChallenge(id, ['3 4 1 5 2', '0', '0'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '-1', '1.0', '1 2 3 4 5']) expect(evaluateInsertionSortChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateInsertionSortChallenge('predict-insertion-pass', '3，4，1，5，2').solved).toBe(true)
  expect(evaluateInsertionSortChallenge('identify-short-circuit', '1').solved).toBe(false)
  expect(evaluateInsertionSortChallenge('count-insertion-shifts', '4').solved).toBe(false)
})
