import {
  CHALLENGE_IDS,
  FOR_LOOP_CHALLENGES,
  isChallengeSolved,
  outputSequencesMatch,
} from './challenges'

describe('for-loop challenges', () => {
  it('defines the three required target sequences', () => {
    expect(FOR_LOOP_CHALLENGES.map((challenge) => challenge.targetOutput)).toEqual([
      [0, 1, 2, 3, 4],
      [2, 4, 6, 8, 10],
      [5, 4, 3, 2, 1],
    ])
    expect(FOR_LOOP_CHALLENGES.map((challenge) => challenge.id)).toEqual(
      CHALLENGE_IDS,
    )
  })

  it('requires an exact output sequence', () => {
    expect(isChallengeSolved('zero-to-four', [0, 1, 2, 3, 4])).toBe(true)
    expect(isChallengeSolved('zero-to-four', [0, 1, 2, 3])).toBe(false)
    expect(isChallengeSolved('zero-to-four', [0, 1, 2, 3, 4, 5])).toBe(false)
    expect(isChallengeSolved('zero-to-four', [1, 0, 2, 3, 4])).toBe(false)
  })

  it('does not mutate or coerce the simulator output', () => {
    const output = [2, 4, 6, 8, 10] as const

    expect(isChallengeSolved('even-two-to-ten', output)).toBe(true)
    expect(output).toEqual([2, 4, 6, 8, 10])
    expect(outputSequencesMatch([0], [-0])).toBe(false)
    expect(outputSequencesMatch([2, 4], ['2', 4] as unknown as number[])).toBe(
      false,
    )
  })
})
