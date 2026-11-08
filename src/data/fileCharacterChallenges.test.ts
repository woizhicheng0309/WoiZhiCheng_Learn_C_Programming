import { FILE_CHARACTER_CHALLENGE_IDS, evaluateFileCharacterChallenge } from './fileCharacterChallenges'

it('requires int storage, zero-byte processing and no invented EOF after break', () => {
  FILE_CHARACTER_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateFileCharacterChallenge(id, ['2', '4 1', '2 0'][index]).solved).toBe(true)
    for (const answer of ['', 'NaN', '2x', '2.0', '-1', '1 2 3']) expect(evaluateFileCharacterChallenge(id, answer).solved).toBe(false)
  })
  expect(evaluateFileCharacterChallenge('choose-fgetc-int', '3').solved).toBe(false)
  expect(evaluateFileCharacterChallenge('predict-fgetc-zero-byte', '1 0').solved).toBe(false)
  expect(evaluateFileCharacterChallenge('check-fgetc-early-stop', '2 1').solved).toBe(false)
  expect(evaluateFileCharacterChallenge('predict-fgetc-zero-byte', '4，1').solved).toBe(true)
})
