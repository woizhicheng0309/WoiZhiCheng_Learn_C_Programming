import {
  DEFAULT_TRAVERSAL_CONFIG,
  TRAVERSAL_VALUES,
  simulateTraversalProgram,
} from '../domain/traversal'

export const TRAVERSAL_CHALLENGE_IDS = [
  'predict-pointer-offset',
  'choose-pointer-step',
  'identify-one-past',
] as const

export type TraversalChallengeId = (typeof TRAVERSAL_CHALLENGE_IDS)[number]

export interface TraversalChallengeDefinition {
  id: TraversalChallengeId
  title: string
  description: string
}

export interface TraversalChallengeEvaluation {
  solved: boolean
  message: string
}

export const TRAVERSAL_CHALLENGES: readonly TraversalChallengeDefinition[] = [
  {
    id: 'predict-pointer-offset',
    title: '預測指標偏移讀到的值',
    description: 'scores 是 {4, 7, 2, 9, 5}，且 p = scores。*(p + 2) 會讀到多少？',
  },
  {
    id: 'choose-pointer-step',
    title: '判斷 p++ 前進的距離',
    description: 'p 的型別是 int *。執行 p++ 時，它會前進一個 byte，還是一個 int 元素？',
  },
  {
    id: 'identify-one-past',
    title: '區分尾端下一格與合法元素',
    description: 'scores 有 5 個元素。scores + 5 可以形成指標嗎？可以透過它讀取元素嗎？',
  },
]

export function evaluateTraversalOffset(
  answer: number | null,
): TraversalChallengeEvaluation {
  const simulation = simulateTraversalProgram({ count: 3, mode: 'pointer' })
  const solved = answer !== null && simulation.status === 'completed'
    && answer === simulation.output[2]
  return {
    solved,
    message: solved
      ? '答對了！p 指向 scores[0]，p + 2 前進兩個元素，*(p + 2) 就是 scores[2] 的值 2。'
      : '偏移量以元素為單位：p + 0 對應 4、p + 1 對應 7，p + 2 才到第三個元素。',
  }
}

export function evaluateTraversalStep(
  answer: 'one-element' | 'one-byte' | null,
): TraversalChallengeEvaluation {
  const solved = answer === 'one-element'
  return {
    solved,
    message: solved
      ? '答對了！int * 的 p++ 前進一個 int 元素，即 sizeof(*p) bytes。int 的實際大小依執行環境而異，不能固定假定為 4 bytes。'
      : '指標運算會依指向的元素型別縮放。int * 前進 1，代表前進一個 int 元素，不是固定的一個 byte。',
  }
}

export function evaluateOnePast(
  answer: 'form-only' | 'dereference' | null,
): TraversalChallengeEvaluation {
  const simulation = simulateTraversalProgram(DEFAULT_TRAVERSAL_CONFIG)
  const exit = simulation.frames.find((frame) => frame.phase === 'condition' && frame.conditionResult === false)
  const solved = answer === 'form-only'
    && simulation.status === 'completed'
    && exit?.memory.pointerIndex === TRAVERSAL_VALUES.length
  return {
    solved,
    message: solved
      ? '答對了！scores + 5 是合法的尾端下一格指標，可以形成，卻不能解參照；合法元素只有 scores[0] 到 scores[4]。'
      : '把「可以形成位址」和「可以讀取元素」分開：scores + 5 位於尾端下一格，不能當成第六個可讀元素。',
  }
}
