import {
  ARRAY_BOUNDS_INDEX,
  ARRAY_CHALLENGE_IDS,
  ARRAY_CHALLENGES,
  ARRAY_INITIAL_VALUES,
  ARRAY_MODIFICATION_INDEX,
  ARRAY_PREDICTION_INDEX,
  ARRAY_TARGET_VALUE,
  classifyArrayIndex,
  evaluateArrayChallenge,
  evaluateArrayElementModification,
  evaluateArrayIndexClassification,
  evaluateArrayIndexPrediction,
  getArrayChallengeById,
  isLegalArrayIndex,
} from './arrayChallenges'

describe('array challenges', () => {
  it('defines three stable challenges in learning order', () => {
    expect(ARRAY_CHALLENGES.map((challenge) => challenge.id)).toEqual(
      ARRAY_CHALLENGE_IDS,
    )
    expect(ARRAY_CHALLENGES.map((challenge) => challenge.order)).toEqual([1, 2, 3])
    expect(ARRAY_CHALLENGES.map((challenge) => challenge.kind)).toEqual([
      'prediction',
      'configuration',
      'bounds',
    ])
    expect(ARRAY_CHALLENGES.map((challenge) => challenge.editableFields)).toEqual([
      [],
      ['newValue'],
      [],
    ])
  })

  it('keeps the exercises aligned with the fixed five-element example', () => {
    expect(ARRAY_INITIAL_VALUES).toEqual([4, 7, 2, 9, 5])
    expect(ARRAY_PREDICTION_INDEX).toBe(2)
    expect(ARRAY_MODIFICATION_INDEX).toBe(3)
    expect(ARRAY_TARGET_VALUE).toBe(10)
    expect(ARRAY_BOUNDS_INDEX).toBe(ARRAY_INITIAL_VALUES.length)
  })

  it('looks up known IDs and returns undefined for an unknown runtime ID', () => {
    expect(getArrayChallengeById('modify-element-to-target')?.order).toBe(2)
    expect(
      getArrayChallengeById('unknown' as (typeof ARRAY_CHALLENGE_IDS)[number]),
    ).toBeUndefined()
  })

  it.each([
    { index: 0, length: 5, expected: true },
    { index: 4, length: 5, expected: true },
    { index: -1, length: 5, expected: false },
    { index: 5, length: 5, expected: false },
    { index: 1.5, length: 5, expected: false },
    { index: Number.NaN, length: 5, expected: false },
    { index: 0, length: -1, expected: false },
    { index: 0, length: 2.5, expected: false },
  ])(
    'classifies index $index for length $length without reading outside the array',
    ({ index, length, expected }) => {
      expect(isLegalArrayIndex(index, length)).toBe(expected)
      expect(classifyArrayIndex(index, length)).toBe(
        expected ? 'valid' : 'out-of-bounds',
      )
    },
  )

  it('checks the index prediction against the actual element', () => {
    const correct = evaluateArrayIndexPrediction(2)

    expect(correct.solved).toBe(true)
    expect(correct.index).toBe(2)
    expect(correct.value).toBe(2)
    expect(correct.inBounds).toBe(true)
    expect(correct.simulation.status).toBe('completed')
    expect(correct.simulation.selectedValue).toBe(2)
    expect(evaluateArrayIndexPrediction(7).solved).toBe(false)
    expect(evaluateArrayIndexPrediction(null).solved).toBe(false)
  })

  it('requires writing 10 to the specified index and reports the resulting value', () => {
    const correct = evaluateArrayElementModification({ index: 3, newValue: 10 })

    expect(correct.solved).toBe(true)
    expect(correct.values).toEqual([4, 7, 2, 10, 5])
    expect(correct.value).toBe(10)
    expect(correct.inBounds).toBe(true)
    expect(correct.simulation.output).toEqual([9, 10])

    expect(
      evaluateArrayElementModification({ index: 3, newValue: 9 }).solved,
    ).toBe(false)
    expect(
      evaluateArrayElementModification({ index: 2, newValue: 10 }).solved,
    ).toBe(false)
  })

  it('rejects invalid C int writes without inventing a successful mutation', () => {
    const fractional = evaluateArrayElementModification({ index: 3, newValue: 10.5 })
    const notANumber = evaluateArrayElementModification({
      index: 3,
      newValue: Number.NaN,
    })
    const outOfBounds = evaluateArrayElementModification({ index: 5, newValue: 10 })

    expect(fractional.solved).toBe(false)
    expect(fractional.values).toEqual(ARRAY_INITIAL_VALUES)
    expect(notANumber.solved).toBe(false)
    expect(notANumber.values).toEqual(ARRAY_INITIAL_VALUES)
    expect(outOfBounds.solved).toBe(false)
    expect(outOfBounds.inBounds).toBe(false)
    expect(outOfBounds.values).toEqual(ARRAY_INITIAL_VALUES)
    expect(outOfBounds.simulation.status).toBe('blocked')
  })

  it('identifies index 5 as out of bounds and never supplies a value for it', () => {
    const correct = evaluateArrayIndexClassification('out-of-bounds')

    expect(correct.solved).toBe(true)
    expect(correct.index).toBe(5)
    expect(correct.inBounds).toBe(false)
    expect(correct.value).toBeNull()
    expect(correct.simulation.status).toBe('blocked')
    expect(correct.simulation.blockReason).toBe('index-out-of-bounds')
    expect(correct.simulation.output).toEqual([])
    expect(correct.message).toContain('合法索引是 0 到 4')
    expect(evaluateArrayIndexClassification('valid').solved).toBe(false)
    expect(evaluateArrayIndexClassification(null).solved).toBe(false)
  })

  it('dispatches all three discriminated challenge attempts', () => {
    expect(evaluateArrayChallenge({
      challengeId: 'predict-index-read',
      prediction: 2,
    }).solved).toBe(true)
    expect(evaluateArrayChallenge({
      challengeId: 'modify-element-to-target',
      config: { index: 3, newValue: 10 },
    }).solved).toBe(true)
    expect(evaluateArrayChallenge({
      challengeId: 'identify-valid-index',
      answer: 'out-of-bounds',
    }).solved).toBe(true)
  })

  it('does not mutate submitted config or shared initial values', () => {
    const submitted = { index: 3, newValue: 10 }
    const originalConfig = { ...submitted }
    const originalValues = [...ARRAY_INITIAL_VALUES]

    const evaluation = evaluateArrayElementModification(submitted)

    expect(submitted).toEqual(originalConfig)
    expect(ARRAY_INITIAL_VALUES).toEqual(originalValues)
    expect(evaluation.values).not.toBe(ARRAY_INITIAL_VALUES)
    expect(Object.isFrozen(evaluation.values)).toBe(true)
  })
})
