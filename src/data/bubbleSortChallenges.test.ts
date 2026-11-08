import { BUBBLE_SORT_CHALLENGE_IDS, evaluateBubbleSortChallenge } from './bubbleSortChallenges'

it('accepts the exact first pass, four comparisons and the whole-pass stopping condition', () => {
  BUBBLE_SORT_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateBubbleSortChallenge(id, ['1 4 2 3 5', '4', '2'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '1x', '0', '1.0', '1 2 3 4 5']) expect(evaluateBubbleSortChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateBubbleSortChallenge('predict-bubble-pass', '1，4，2，3，5').solved).toBe(true)
  expect(evaluateBubbleSortChallenge('count-early-comparisons', '10').solved).toBe(false)
  expect(evaluateBubbleSortChallenge('identify-whole-pass', '1').solved).toBe(false)
})
