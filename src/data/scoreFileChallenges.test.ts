import { SCORE_FILE_CHALLENGES, SCORE_FILE_CHALLENGE_IDS, evaluateScoreFileChallenge } from './scoreFileChallenges'

it('offers three core challenges with stable independent IDs', () => {
  expect(SCORE_FILE_CHALLENGES.map(item => item.id)).toEqual([...SCORE_FILE_CHALLENGE_IDS])
  expect(new Set(SCORE_FILE_CHALLENGE_IDS).size).toBe(3)
})
it.each([
  ['validate-whole-score-record', '2'], ['predict-score-file-totals', '3 3 180'], ['predict-score-file-totals', '3，3，180'], ['handle-no-valid-scores', '2'],
] as const)('accepts the independently known answer for %s', (id, answer) => {
  expect(evaluateScoreFileChallenge(id, answer).solved).toBe(true)
})
it.each(['', '3 3', '3 3 180 0', '3x 3 180', '3 3 1.8e2', '-3 3 180', '0x3 3 180', 'Infinity 3 180', '6 0 180'])('rejects invalid answers: %j', answer => {
  expect(evaluateScoreFileChallenge('predict-score-file-totals', answer).solved).toBe(false)
})
