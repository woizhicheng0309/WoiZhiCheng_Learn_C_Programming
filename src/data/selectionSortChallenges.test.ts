import { SELECTION_SORT_CHALLENGE_IDS, evaluateSelectionSortChallenge } from './selectionSortChallenges'
it('requires the candidate index, exact first-pass order and element comparison count', () => {
  SELECTION_SORT_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateSelectionSortChallenge(id, ['1', '1 4 5 2 3', '10'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '0', '1.0', '1 2 3 4 5']) expect(evaluateSelectionSortChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateSelectionSortChallenge('predict-first-pass', '1，4，5，2，3').solved).toBe(true)
  expect(evaluateSelectionSortChallenge('count-sorted-comparisons', '0').solved).toBe(false)
})
