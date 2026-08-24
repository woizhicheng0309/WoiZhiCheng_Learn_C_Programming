import {
  simulateVariableProgram,
  type VariableConfig,
  type VariableSimulationResult,
} from '../domain/variables'

export const VARIABLE_CHALLENGE_IDS = [
  'predict-int-division',
  'make-fourteen',
  'repair-division-by-zero',
] as const

export type VariableChallengeId = (typeof VARIABLE_CHALLENGE_IDS)[number]

export type VariableChallengeKind = 'prediction' | 'configuration' | 'diagnosis'

export interface VariableChallengeDefinition {
  id: VariableChallengeId
  order: number
  kind: VariableChallengeKind
  title: string
  description: string
  initialConfig: Readonly<VariableConfig>
  editableFields: readonly (keyof VariableConfig)[]
}

export const VARIABLE_CHALLENGES: readonly VariableChallengeDefinition[] = [
  {
    id: 'predict-int-division',
    order: 1,
    kind: 'prediction',
    title: '先猜，再揭曉',
    description: '預測 int result = 5 / 2 的輸出結果。',
    initialConfig: { valueType: 'int', x: 5, y: 2, operator: '/' },
    editableFields: [],
  },
  {
    id: 'make-fourteen',
    order: 2,
    kind: 'configuration',
    title: '組合出 14',
    description: '保持 int 與加法，調整 x、y，讓實際輸出成為 14。',
    initialConfig: { valueType: 'int', x: 5, y: 2, operator: '+' },
    editableFields: ['x', 'y'],
  },
  {
    id: 'repair-division-by-zero',
    order: 3,
    kind: 'diagnosis',
    title: '找出錯誤並修好',
    description: '診斷 8 / 0 無法執行的原因，再把 y 改為 2。',
    initialConfig: { valueType: 'int', x: 8, y: 0, operator: '/' },
    editableFields: ['y'],
  },
]

export const VARIABLE_DIAGNOSIS_OPTIONS = [
  { id: 'division-by-zero', label: '除數 y 是 0' },
  { id: 'integer-division', label: 'int 不能進行除法' },
  { id: 'wrong-operator', label: '除法應該改成加法' },
] as const

export type VariableDiagnosis =
  (typeof VARIABLE_DIAGNOSIS_OPTIONS)[number]['id']

export interface VariableChallengeEvaluation {
  solved: boolean
  message: string
  simulation: VariableSimulationResult
}

const challengesById = new Map(
  VARIABLE_CHALLENGES.map((challenge) => [challenge.id, challenge]),
)

export function getVariableChallengeById(
  id: VariableChallengeId,
): VariableChallengeDefinition | undefined {
  return challengesById.get(id)
}

export function evaluateDivisionPrediction(
  prediction: number | null,
): VariableChallengeEvaluation {
  const simulation = simulateVariableProgram(
    getVariableChallengeById('predict-int-division')!.initialConfig,
  )
  const solved = prediction !== null && Object.is(prediction, 2)

  return {
    solved,
    message: solved
      ? '答對了！C 的 int 除法會捨去小數部分，所以 5 / 2 是 2。'
      : '再想一想：兩個 int 相除時，小數部分不會保留下來。',
    simulation,
  }
}

export function evaluateMakeFourteen(
  config: VariableConfig,
): VariableChallengeEvaluation {
  const simulation = simulateVariableProgram(config)
  const keepsRequiredProgram =
    config.valueType === 'int' && config.operator === '+'
  const solved =
    keepsRequiredProgram &&
    simulation.status === 'completed' &&
    simulation.output.length === 1 &&
    Object.is(simulation.output[0], 14)

  return {
    solved,
    message: solved
      ? `成功！${config.x} + ${config.y} 的實際輸出是 14。`
      : keepsRequiredProgram
        ? '目前的實際輸出還不是 14，請再調整 x 或 y。'
        : '這一題必須保持 int 型別與 + 運算子，只調整 x、y。',
    simulation,
  }
}

export function evaluateDivisionRepair(
  diagnosis: VariableDiagnosis | null,
  config: VariableConfig,
): VariableChallengeEvaluation {
  const simulation = simulateVariableProgram(config)
  const diagnosed = diagnosis === 'division-by-zero'
  const keepsRequiredProgram =
    config.valueType === 'int' && config.x === 8 && config.operator === '/'
  const repaired =
    keepsRequiredProgram &&
    config.y === 2 &&
    simulation.status === 'completed' &&
    simulation.output.length === 1 &&
    Object.is(simulation.output[0], 4)
  const solved = diagnosed && repaired

  let message: string
  if (!diagnosed) {
    message = '請先找出 8 / 0 無法執行的真正原因。'
  } else if (!keepsRequiredProgram) {
    message = '診斷正確；這一題只能調整 y，請保留 int x = 8 與除法。'
  } else if (!repaired) {
    message = '診斷正確！接著把唯一可調的 y 改成 2，讓輸出成為 4。'
  } else {
    message = '完成！你找出除以零，並把 y 修正為 2，實際輸出是 4。'
  }

  return { solved, message, simulation }
}

export type VariableChallengeAttempt =
  | {
      challengeId: 'predict-int-division'
      prediction: number | null
    }
  | {
      challengeId: 'make-fourteen'
      config: VariableConfig
    }
  | {
      challengeId: 'repair-division-by-zero'
      diagnosis: VariableDiagnosis | null
      config: VariableConfig
    }

export function evaluateVariableChallenge(
  attempt: VariableChallengeAttempt,
): VariableChallengeEvaluation {
  switch (attempt.challengeId) {
    case 'predict-int-division':
      return evaluateDivisionPrediction(attempt.prediction)
    case 'make-fourteen':
      return evaluateMakeFourteen(attempt.config)
    case 'repair-division-by-zero':
      return evaluateDivisionRepair(attempt.diagnosis, attempt.config)
  }
}
