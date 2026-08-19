export const CHALLENGE_IDS = [
  'zero-to-four',
  'even-two-to-ten',
  'countdown-five-to-one',
] as const

export type ChallengeId = (typeof CHALLENGE_IDS)[number]

export interface ChallengeDefinition {
  id: ChallengeId
  order: number
  title: string
  description: string
  targetOutput: readonly number[]
}

export const FOR_LOOP_CHALLENGES: readonly ChallengeDefinition[] = [
  {
    id: 'zero-to-four',
    order: 1,
    title: '從零開始',
    description: '調整參數，讓程式依序輸出 0 1 2 3 4。',
    targetOutput: [0, 1, 2, 3, 4],
  },
  {
    id: 'even-two-to-ten',
    order: 2,
    title: '偶數步進',
    description: '調整參數，讓程式依序輸出 2 4 6 8 10。',
    targetOutput: [2, 4, 6, 8, 10],
  },
  {
    id: 'countdown-five-to-one',
    order: 3,
    title: '倒數練習',
    description: '調整參數，讓程式依序輸出 5 4 3 2 1。',
    targetOutput: [5, 4, 3, 2, 1],
  },
]

const challengesById = new Map(
  FOR_LOOP_CHALLENGES.map((challenge) => [challenge.id, challenge]),
)

export function getChallengeById(
  id: ChallengeId,
): ChallengeDefinition | undefined {
  return challengesById.get(id)
}

export function outputSequencesMatch(
  actual: readonly number[],
  expected: readonly number[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => Object.is(value, expected[index]))
  )
}

/** Evaluate a challenge using only the values actually printed by the loop. */
export function isChallengeSolved(
  id: ChallengeId,
  actualOutput: readonly number[],
): boolean {
  const challenge = getChallengeById(id)
  return challenge
    ? outputSequencesMatch(actualOutput, challenge.targetOutput)
    : false
}
