import { DYNAMIC_RECORDS_CHALLENGES, evaluateDynamicRecordsChallenge } from './dynamicRecordsChallenges'
it.each(DYNAMIC_RECORDS_CHALLENGES)('requires every part of $title', challenge => {
  expect(evaluateDynamicRecordsChallenge(challenge.id, challenge.expected.join('，')).solved).toBe(true)
  for (const answer of ['', '6', '6 8 3 0', '-1 2 0', '6x 8 3', '6 8 NaN']) expect(evaluateDynamicRecordsChallenge(challenge.id, answer).solved).toBe(false)
})
