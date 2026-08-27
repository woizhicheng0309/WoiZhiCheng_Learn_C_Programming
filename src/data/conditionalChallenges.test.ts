import { DEFAULT_CONDITIONAL_CONFIG } from '../domain/conditionals'
import {
  evaluateConditionalPrediction,
  evaluateConditionalRepair,
  evaluateMakeBothPass,
} from './conditionalChallenges'

describe('conditional challenge evaluators', () => {
  it('checks the predicted branch against the actual simulation', () => {
    expect(evaluateConditionalPrediction('else').solved).toBe(true)
    expect(evaluateConditionalPrediction('if').solved).toBe(false)
    expect(evaluateConditionalPrediction(null).solved).toBe(false)
  })

  it('requires both thresholds and && for the configuration challenge', () => {
    expect(evaluateMakeBothPass({
      ...DEFAULT_CONDITIONAL_CONFIG,
      score: 60,
      attendance: 70,
    }).solved).toBe(true)
    expect(evaluateMakeBothPass({
      ...DEFAULT_CONDITIONAL_CONFIG,
      score: 100,
      attendance: 0,
      logicalOperator: '||',
    }).solved).toBe(false)
  })

  it('requires the right diagnosis and repairs || to &&', () => {
    expect(evaluateConditionalRepair('or-allows-one', '&&').solved).toBe(true)
    expect(evaluateConditionalRepair('attendance-is-ignored', '&&').solved).toBe(false)
    expect(evaluateConditionalRepair('or-allows-one', '||').solved).toBe(false)
  })
})

