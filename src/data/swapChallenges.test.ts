import {
  SWAP_CHALLENGES,
  SWAP_CHALLENGE_IDS,
  evaluatePointerCall,
  evaluateSwapTemp,
  evaluateValueSwap,
} from './swapChallenges'

describe('swap practice challenges', () => {
  it('defines three distinct challenges in the required learning order', () => {
    expect(SWAP_CHALLENGES.map((challenge) => challenge.id)).toEqual(SWAP_CHALLENGE_IDS)
    expect(new Set(SWAP_CHALLENGE_IDS).size).toBe(3)
  })

  it('requires predicting unchanged caller values after swapping integer copies', () => {
    expect(evaluateValueSwap(5, 9)).toMatchObject({ solved: true, message: expect.stringContaining('副本') })
    for (const [x, y] of [[9, 5], [9, 9], [5, 5], [null, 9], [5, null], [NaN, 9], [5, Infinity]]) {
      expect(evaluateValueSwap(x, y).solved).toBe(false)
    }
  })

  it('chooses address arguments and explains that their values are copied', () => {
    expect(evaluatePointerCall('addresses')).toMatchObject({
      solved: true,
      message: expect.stringContaining('C 仍是以值傳遞'),
    })
    expect(evaluatePointerCall('addresses').message).toContain('swap(&x, &y)')
    expect(evaluatePointerCall('values').solved).toBe(false)
    expect(evaluatePointerCall(null).solved).toBe(false)
  })

  it('distinguishes the broken no-temp program from a correct pointer swap', () => {
    expect(evaluateSwapTemp('both-nine')).toMatchObject({
      solved: true,
      message: expect.stringContaining('最後都是 9'),
    })
    expect(evaluateSwapTemp('swapped').solved).toBe(false)
    expect(evaluateSwapTemp('swapped').message).toContain('5 已被 9 覆寫')
    expect(evaluateSwapTemp(null).solved).toBe(false)
  })
})
