import {
  DEFAULT_FUNCTION_CONFIG,
  simulateFunctionProgram,
  type FunctionConfig,
  type FunctionSimulationResult,
} from '../domain/functions'

export const FUNCTION_CHALLENGE_IDS = [
  'predict-return-value',
  'make-return-ten',
  'identify-local-scope',
] as const

export type FunctionChallengeId = (typeof FUNCTION_CHALLENGE_IDS)[number]

export type FunctionChallengeKind = 'prediction' | 'configuration' | 'scope'

export interface FunctionChallengeDefinition {
  id: FunctionChallengeId
  order: number
  kind: FunctionChallengeKind
  title: string
  description: string
  initialConfig: Readonly<FunctionConfig>
  editableFields: readonly (keyof FunctionConfig)[]
}

export const FUNCTION_TARGET_RETURN_VALUE = 10

export const FUNCTION_CHALLENGES: readonly FunctionChallengeDefinition[] = [
  {
    id: 'predict-return-value',
    order: 1,
    kind: 'prediction',
    title: '預測 add 的回傳值',
    description: 'x 是 4、y 是 3 時，預測 add(x, y) 會回傳多少。',
    initialConfig: DEFAULT_FUNCTION_CONFIG,
    editableFields: [],
  },
  {
    id: 'make-return-ten',
    order: 2,
    kind: 'configuration',
    title: '設定引數得到 10',
    description: '調整 main 裡的 x、y，讓 add(x, y) 的實際回傳值成為 10。',
    initialConfig: { ...DEFAULT_FUNCTION_CONFIG },
    editableFields: ['x', 'y'],
  },
  {
    id: 'identify-local-scope',
    order: 3,
    kind: 'scope',
    title: '誰還在 main 的作用域？',
    description: 'add 已經 return 之後，main 的 printf 可以直接讀取哪個變數？',
    initialConfig: { ...DEFAULT_FUNCTION_CONFIG },
    editableFields: [],
  },
]

export const FUNCTION_SCOPE_OPTIONS = [
  { id: 'answer', label: 'answer（main 的區域變數）' },
  { id: 'result', label: 'result（add 的區域變數）' },
  { id: 'a', label: '參數 a' },
  { id: 'b', label: '參數 b' },
] as const

export type FunctionScopeAnswer = (typeof FUNCTION_SCOPE_OPTIONS)[number]['id']

export interface FunctionChallengeEvaluation {
  solved: boolean
  message: string
  simulation: FunctionSimulationResult
}

const challengesById = new Map(
  FUNCTION_CHALLENGES.map((challenge) => [challenge.id, challenge]),
)

export function getFunctionChallengeById(
  id: FunctionChallengeId,
): FunctionChallengeDefinition | undefined {
  return challengesById.get(id)
}

export function evaluateFunctionPrediction(
  prediction: number | null,
): FunctionChallengeEvaluation {
  const challenge = getFunctionChallengeById('predict-return-value')!
  const simulation = simulateFunctionProgram(challenge.initialConfig)
  const solved = prediction !== null
    && simulation.status === 'completed'
    && Object.is(prediction, simulation.returnValue)

  return {
    solved,
    message: solved
      ? '答對了！x 的值複製給 a、y 的值複製給 b，add 回傳 4 + 3，也就是 7。'
      : '再沿著呼叫流程想一次：a 收到 x、b 收到 y，return result 會把 a + b 傳回 main。',
    simulation,
  }
}

export function evaluateMakeReturnTen(
  config: FunctionConfig,
): FunctionChallengeEvaluation {
  const simulation = simulateFunctionProgram(config)
  const solved = simulation.status === 'completed'
    && simulation.output.length === 1
    && Object.is(simulation.returnValue, FUNCTION_TARGET_RETURN_VALUE)
    && Object.is(simulation.answerValue, FUNCTION_TARGET_RETURN_VALUE)
    && Object.is(simulation.output[0], FUNCTION_TARGET_RETURN_VALUE)

  return {
    solved,
    message: solved
      ? `成功！add(${config.x}, ${config.y}) 回傳 10，main 的 answer 與實際輸出也都是 10。`
      : simulation.status === 'blocked'
        ? `這組引數無法執行：${simulation.message}`
        : '目前 add 的實際回傳值還不是 10，請再調整 x 或 y。',
    simulation,
  }
}

export function evaluateFunctionScope(
  answer: FunctionScopeAnswer | null,
): FunctionChallengeEvaluation {
  const challenge = getFunctionChallengeById('identify-local-scope')!
  const simulation = simulateFunctionProgram(challenge.initialConfig)
  const solved = answer === 'answer'

  return {
    solved,
    message: solved
      ? '答對了！answer 宣告在 main 裡；a、b、result 都屬於 add，add 返回後就已離開作用域。'
      : 'add 返回後，它的參數 a、b 與區域變數 result 都不能由 main 直接讀取；請找出宣告在 main 裡的名稱。',
    simulation,
  }
}

export type FunctionChallengeAttempt =
  | {
      challengeId: 'predict-return-value'
      prediction: number | null
    }
  | {
      challengeId: 'make-return-ten'
      config: FunctionConfig
    }
  | {
      challengeId: 'identify-local-scope'
      answer: FunctionScopeAnswer | null
    }

export function evaluateFunctionChallenge(
  attempt: FunctionChallengeAttempt,
): FunctionChallengeEvaluation {
  switch (attempt.challengeId) {
    case 'predict-return-value':
      return evaluateFunctionPrediction(attempt.prediction)
    case 'make-return-ten':
      return evaluateMakeReturnTen(attempt.config)
    case 'identify-local-scope':
      return evaluateFunctionScope(attempt.answer)
  }
}

export const evaluateReturnPrediction = evaluateFunctionPrediction
export const evaluateLocalScope = evaluateFunctionScope
