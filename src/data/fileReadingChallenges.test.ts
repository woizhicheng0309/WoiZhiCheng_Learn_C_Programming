import { FILE_READING_CHALLENGE_IDS, evaluateFileReadingChallenge } from './fileReadingChallenges'

it('checks fgets guards, chunk counts and the distinction between EOF and a read error', () => {
  FILE_READING_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateFileReadingChallenge(id, ['2', '4', '0 1'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '2x', '2.0', '-1', '1 2 3']) expect(evaluateFileReadingChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateFileReadingChallenge('choose-fgets-guard', '1').solved).toBe(false)
  expect(evaluateFileReadingChallenge('predict-fgets-chunks', '2').solved).toBe(false)
  expect(evaluateFileReadingChallenge('distinguish-file-read-error', '1 0').solved).toBe(false)
  expect(evaluateFileReadingChallenge('distinguish-file-read-error', '0，1').solved).toBe(true)
})
