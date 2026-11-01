import { SWITCH_CHALLENGE_IDS, evaluateSwitchChallenge } from './switchChallenges'

it('accepts only the complete ordered output for each switch challenge', () => {
  const answers = ['Coffee Done', 'Tea Coffee Water Done', 'Water Done']
  SWITCH_CHALLENGE_IDS.forEach((id, index) => {
    expect(evaluateSwitchChallenge(id, answers[index]).solved).toBe(true)
    for (const answer of ['', 'Coffee', 'Done Coffee', `${answers[index]} Done`, 'Tea Done']) {
      expect(evaluateSwitchChallenge(id, answer).solved).toBe(false)
    }
  })
  expect(evaluateSwitchChallenge('predict-switch-fallthrough', 'Tea，Coffee，Water，Done').solved).toBe(true)
})
