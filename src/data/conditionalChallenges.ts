import {
  DEFAULT_CONDITIONAL_CONFIG,
  CONDITIONAL_LIMITS,
  CONDITIONAL_LOGICAL_OPERATORS,
  simulateConditional,
  type ConditionalBranch,
  type ConditionalConfig,
  type ConditionalLogicalOperator,
  type ConditionalSimulationResult,
} from '../domain/conditionals'

export const CONDITIONAL_CHALLENGE_IDS = [
  'predict-mixed-condition',
  'make-both-pass',
  'repair-loose-rule',
] as const

export type ConditionalChallengeId = (typeof CONDITIONAL_CHALLENGE_IDS)[number]

export type ConditionalChallengeKind = 'prediction' | 'configuration' | 'diagnosis'

export interface ConditionalChallengeDefinition {
  id: ConditionalChallengeId
  order: number
  kind: ConditionalChallengeKind
  title: string
  description: string
  initialConfig: Readonly<ConditionalConfig>
  editableFields: readonly (keyof ConditionalConfig)[]
}

export const CONDITIONAL_CHALLENGES: readonly ConditionalChallengeDefinition[] = [
  {
    id: 'predict-mixed-condition',
    order: 1,
    kind: 'prediction',
    title: '先判斷分支',
    description: '預測預設分數與出席率會走進 if 還是 else？',
    initialConfig: DEFAULT_CONDITIONAL_CONFIG,
    editableFields: [],
  },
  {
    id: 'make-both-pass',
    order: 2,
    kind: 'configuration',
    title: '讓兩關都通過',
    description: '保持 &&，調整分數與出席率，讓程式輸出「通過」。',
    initialConfig: { ...DEFAULT_CONDITIONAL_CONFIG },
    editableFields: ['score', 'attendance'],
  },
  {
    id: 'repair-loose-rule',
    order: 3,
    kind: 'diagnosis',
    title: '找出過寬規則',
    description: '規則要求兩項都達標，卻使用了 ||；找出問題並修正運算子。',
    initialConfig: { ...DEFAULT_CONDITIONAL_CONFIG, logicalOperator: '||' },
    editableFields: ['logicalOperator'],
  },
]

export const CONDITIONAL_DIAGNOSIS_OPTIONS = [
  {
    id: 'or-allows-one',
    label: '|| 只要一邊為真就通過，無法要求兩項都達標',
  },
  {
    id: 'assignment-instead-of-comparison',
    label: 'if 裡少了大括號，所以條件不會比較',
  },
  {
    id: 'attendance-is-ignored',
    label: 'attendance 變數不能放進 if 條件',
  },
] as const

export type ConditionalDiagnosis =
  (typeof CONDITIONAL_DIAGNOSIS_OPTIONS)[number]['id']

export interface ConditionalChallengeEvaluation {
  solved: boolean
  message: string
  simulation: ConditionalSimulationResult
}

const challengesById = new Map(
  CONDITIONAL_CHALLENGES.map((challenge) => [challenge.id, challenge]),
)

export function getConditionalChallengeById(
  id: ConditionalChallengeId,
): ConditionalChallengeDefinition | undefined {
  return challengesById.get(id)
}

export function evaluateConditionalPrediction(
  prediction: ConditionalBranch,
): ConditionalChallengeEvaluation {
  const simulation = simulateConditional(DEFAULT_CONDITIONAL_CONFIG)
  const solved = prediction === simulation.selectedBranch

  return {
    solved,
    message: solved
      ? `答對了！score >= ${CONDITIONAL_LIMITS.scoreThreshold} 為真，但 attendance >= ${CONDITIONAL_LIMITS.attendanceThreshold} 為假；&& 需要兩邊都為真，所以走 else。`
      : '再沿著兩個比較一步一步判斷：&& 需要左右兩邊都為真，才會進入 if。',
    simulation,
  }
}

export function evaluateMakeBothPass(
  config: ConditionalConfig,
): ConditionalChallengeEvaluation {
  const simulation = simulateConditional(config)
  const keepsRequiredRule = config.logicalOperator === '&&'
  const solved = keepsRequiredRule
    && config.score >= CONDITIONAL_LIMITS.scoreThreshold
    && config.attendance >= CONDITIONAL_LIMITS.attendanceThreshold
    && simulation.conditionResult
    && simulation.output[0] === '通過'

  return {
    solved,
    message: solved
      ? '成功！兩個比較都為真，&& 合併後進入 if，輸出「通過」。'
      : keepsRequiredRule
        ? `請讓 score 至少 ${CONDITIONAL_LIMITS.scoreThreshold}、attendance 至少 ${CONDITIONAL_LIMITS.attendanceThreshold}。`
        : '這一題要保持 &&，因為規則要求兩個條件都成立。',
    simulation,
  }
}

export function evaluateConditionalRepair(
  diagnosis: ConditionalDiagnosis | null,
  repairOperator: ConditionalLogicalOperator,
): ConditionalChallengeEvaluation {
  const initialConfig: ConditionalConfig = {
    ...DEFAULT_CONDITIONAL_CONFIG,
    logicalOperator: '||',
  }
  const repairedConfig: ConditionalConfig = {
    ...initialConfig,
    logicalOperator: repairOperator,
  }
  const simulation = simulateConditional(repairedConfig)
  const solved = diagnosis === 'or-allows-one'
    && repairOperator === '&&'
    && simulation.output[0] === '再練習'

  let message: string
  if (diagnosis !== 'or-allows-one') {
    message = '先找出真正的問題：|| 只要一邊成立就會讓整體條件為真。'
  } else if (repairOperator !== '&&') {
    message = '診斷正確！把運算子改成 &&，才能要求兩個條件都成立。'
  } else {
    message = '完成！你找出 || 的規則太寬，並用 && 修正它。'
  }

  return { solved, message, simulation }
}

export type ConditionalChallengeAttempt =
  | {
      challengeId: 'predict-mixed-condition'
      prediction: ConditionalBranch
    }
  | {
      challengeId: 'make-both-pass'
      config: ConditionalConfig
    }
  | {
      challengeId: 'repair-loose-rule'
      diagnosis: ConditionalDiagnosis | null
      repairOperator: ConditionalLogicalOperator
    }

export function evaluateConditionalChallenge(
  attempt: ConditionalChallengeAttempt,
): ConditionalChallengeEvaluation {
  switch (attempt.challengeId) {
    case 'predict-mixed-condition':
      return evaluateConditionalPrediction(attempt.prediction)
    case 'make-both-pass':
      return evaluateMakeBothPass(attempt.config)
    case 'repair-loose-rule':
      return evaluateConditionalRepair(attempt.diagnosis, attempt.repairOperator)
  }
}

export { CONDITIONAL_LOGICAL_OPERATORS }
