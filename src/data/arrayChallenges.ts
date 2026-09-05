import {
  INITIAL_SCORES,
  simulateArrayProgram,
  type ArrayConfig,
  type ArraySimulationResult,
} from '../domain/arrays'

export const ARRAY_CHALLENGE_IDS = [
  'predict-index-read',
  'modify-element-to-target',
  'identify-valid-index',
] as const

export type ArrayChallengeId = (typeof ARRAY_CHALLENGE_IDS)[number]

export type ArrayChallengeKind = 'prediction' | 'configuration' | 'bounds'

export type ArrayChallengeConfig = ArrayConfig

export interface ArrayChallengeDefinition {
  id: ArrayChallengeId
  order: number
  kind: ArrayChallengeKind
  title: string
  description: string
  initialConfig: Readonly<ArrayChallengeConfig>
  editableFields: readonly (keyof ArrayChallengeConfig)[]
}

export const ARRAY_INITIAL_VALUES: readonly number[] = Object.freeze([
  ...INITIAL_SCORES,
])

export const ARRAY_PREDICTION_INDEX = 2
export const ARRAY_MODIFICATION_INDEX = 3
export const ARRAY_TARGET_VALUE = 10
export const ARRAY_BOUNDS_INDEX = ARRAY_INITIAL_VALUES.length

export const ARRAY_CHALLENGES: readonly ArrayChallengeDefinition[] = [
  {
    id: 'predict-index-read',
    order: 1,
    kind: 'prediction',
    title: '預測索引讀取結果',
    description: 'scores 是 {4, 7, 2, 9, 5} 時，預測 scores[2] 會讀到多少。',
    initialConfig: { index: ARRAY_PREDICTION_INDEX, newValue: ARRAY_TARGET_VALUE },
    editableFields: [],
  },
  {
    id: 'modify-element-to-target',
    order: 2,
    kind: 'configuration',
    title: '把指定元素改成 10',
    description: '只調整寫入的新值，讓 scores[3] 修改後讀到並輸出 10。',
    initialConfig: { index: ARRAY_MODIFICATION_INDEX, newValue: 9 },
    editableFields: ['newValue'],
  },
  {
    id: 'identify-valid-index',
    order: 3,
    kind: 'bounds',
    title: '辨識合法索引與越界',
    description: 'scores 有 5 個元素；判斷 scores[5] 是合法索引還是已經越界。',
    initialConfig: { index: ARRAY_BOUNDS_INDEX, newValue: ARRAY_TARGET_VALUE },
    editableFields: [],
  },
]

export const ARRAY_INDEX_CLASSIFICATION_OPTIONS = [
  { id: 'valid', label: '合法索引，可以安全讀取' },
  { id: 'out-of-bounds', label: '越界索引，不可以讀取' },
] as const

export type ArrayIndexClassification =
  (typeof ARRAY_INDEX_CLASSIFICATION_OPTIONS)[number]['id']

export interface ArrayChallengeEvaluation {
  solved: boolean
  message: string
  simulation: ArraySimulationResult
  values: readonly number[]
  index: number
  value: number | null
  inBounds: boolean
}

const challengesById = new Map(
  ARRAY_CHALLENGES.map((challenge) => [challenge.id, challenge]),
)

function copyValues(values: readonly number[] = ARRAY_INITIAL_VALUES): readonly number[] {
  return Object.freeze([...values])
}

export function getArrayChallengeById(
  id: ArrayChallengeId,
): ArrayChallengeDefinition | undefined {
  return challengesById.get(id)
}

export function isLegalArrayIndex(index: number, length: number): boolean {
  return Number.isInteger(index)
    && Number.isInteger(length)
    && length >= 0
    && index >= 0
    && index < length
}

export function classifyArrayIndex(
  index: number,
  length = ARRAY_INITIAL_VALUES.length,
): ArrayIndexClassification {
  return isLegalArrayIndex(index, length) ? 'valid' : 'out-of-bounds'
}

export function evaluateArrayIndexPrediction(
  prediction: number | null,
): ArrayChallengeEvaluation {
  const simulation = simulateArrayProgram({
    index: ARRAY_PREDICTION_INDEX,
    newValue: ARRAY_TARGET_VALUE,
  })
  const values = copyValues(simulation.initialScores)
  const index = ARRAY_PREDICTION_INDEX
  const value = simulation.selectedValue
  const solved = prediction !== null
    && simulation.status === 'completed'
    && Object.is(prediction, value)

  return {
    solved,
    message: solved
      ? '答對了！陣列索引從 0 開始，所以 scores[2] 是第 3 個元素，值為 2。'
      : '再從 0 開始數一次：scores[0] 是 4、scores[1] 是 7，接著才是 scores[2]。',
    simulation,
    values,
    index,
    value,
    inBounds: true,
  }
}

export function evaluateArrayElementModification(
  config: ArrayChallengeConfig,
): ArrayChallengeEvaluation {
  const simulation = simulateArrayProgram(config)
  const values = copyValues(simulation.finalScores)
  const indexIsLegal = isLegalArrayIndex(config.index, ARRAY_INITIAL_VALUES.length)
  const keepsSpecifiedIndex = config.index === ARRAY_MODIFICATION_INDEX
  const value = values[ARRAY_MODIFICATION_INDEX]
  const solved = keepsSpecifiedIndex
    && simulation.status === 'completed'
    && Object.is(config.newValue, ARRAY_TARGET_VALUE)
    && Object.is(value, ARRAY_TARGET_VALUE)

  let message: string
  if (!keepsSpecifiedIndex) {
    message = '這一題指定修改 scores[3]；請保留索引 3，只調整要寫入的新值。'
  } else if (simulation.status === 'blocked') {
    message = `這個新值無法寫入 int 陣列：${simulation.message}`
  } else if (!solved) {
    message = `目前 scores[3] 修改後是 ${String(value)}；請讓它實際讀到並輸出 10。`
  } else {
    message = '完成！scores[3] 已從 9 改成 10，修改後讀取與輸出也都是 10。'
  }

  return {
    solved,
    message,
    simulation,
    values,
    index: config.index,
    value,
    inBounds: indexIsLegal,
  }
}

export function evaluateArrayIndexClassification(
  answer: ArrayIndexClassification | null,
): ArrayChallengeEvaluation {
  const index = ARRAY_BOUNDS_INDEX
  const simulation = simulateArrayProgram({ index, newValue: ARRAY_TARGET_VALUE })
  const values = copyValues(simulation.finalScores)
  const inBounds = isLegalArrayIndex(index, values.length)
  const solved = simulation.status === 'blocked'
    && simulation.blockReason === 'index-out-of-bounds'
    && answer === classifyArrayIndex(index, values.length)

  return {
    solved,
    message: solved
      ? '答對了！5 個元素的合法索引是 0 到 4；scores[5] 已越界，不能把它當成可讀取的元素。'
      : '陣列索引從 0 開始：長度是 5 時，最後一個合法索引是 4；越界位置沒有可安全假定的值。',
    simulation,
    values,
    index,
    value: null,
    inBounds,
  }
}

export type ArrayChallengeAttempt =
  | {
      challengeId: 'predict-index-read'
      prediction: number | null
    }
  | {
      challengeId: 'modify-element-to-target'
      config: ArrayChallengeConfig
    }
  | {
      challengeId: 'identify-valid-index'
      answer: ArrayIndexClassification | null
    }

export function evaluateArrayChallenge(
  attempt: ArrayChallengeAttempt,
): ArrayChallengeEvaluation {
  switch (attempt.challengeId) {
    case 'predict-index-read':
      return evaluateArrayIndexPrediction(attempt.prediction)
    case 'modify-element-to-target':
      return evaluateArrayElementModification(attempt.config)
    case 'identify-valid-index':
      return evaluateArrayIndexClassification(attempt.answer)
  }
}

export const evaluateArrayPrediction = evaluateArrayIndexPrediction
export const evaluateArrayModification = evaluateArrayElementModification
export const evaluateArrayBounds = evaluateArrayIndexClassification
