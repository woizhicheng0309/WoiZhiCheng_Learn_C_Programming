import { INTEGER_PARSING_CHALLENGES, INTEGER_PARSING_CHALLENGE_IDS, evaluateIntegerParsingChallenge } from './integerParsingChallenges'

it('offers three independent core challenges with stable IDs', () => {
  expect(INTEGER_PARSING_CHALLENGES.map(item => item.id)).toEqual([...INTEGER_PARSING_CHALLENGE_IDS])
  expect(new Set(INTEGER_PARSING_CHALLENGE_IDS).size).toBe(3)
})
it.each([
  ['distinguish-strtol-zero', '2'], ['predict-strtol-end', '42 2'], ['predict-strtol-end', '42，2'], ['check-strtol-range', '10,1'],
] as const)('accepts the correct answer for %s', (id, answer) => {
  expect(evaluateIntegerParsingChallenge(id, answer)).toMatchObject({ solved: true })
})
it.each(['', '42', '42 2 0', '42x 2', '4.2e1 2', '-42 2', 'Infinity 2', '0x2a 2', '2 42'])('rejects malformed or incorrect answers: %j', answer => {
  expect(evaluateIntegerParsingChallenge('predict-strtol-end', answer).solved).toBe(false)
})
