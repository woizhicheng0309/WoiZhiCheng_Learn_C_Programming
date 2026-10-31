import { simulateLoopControlProgram } from '../domain/loopControl'

export const LOOP_CONTROL_CHALLENGE_IDS = [
  'predict-break-output',
  'predict-continue-sum',
  'identify-continue-update',
] as const

export type LoopControlChallengeId = (typeof LOOP_CONTROL_CHALLENGE_IDS)[number]

export interface LoopControlChallengeDefinition {
  id: LoopControlChallengeId
  title: string
  description: string
}

export interface LoopControlChallengeEvaluation {
  solved: boolean
  message: string
}

export const LOOP_CONTROL_CHALLENGES: readonly LoopControlChallengeDefinition[] = [
  {
    id: 'predict-break-output',
    title: '預測 break 前的輸出',
    description: 'for 從 i = 1 跑到 5，遇到 i == 3 先執行 break，再往下才是累加與輸出。哪些 i 會被印出？',
  },
  {
    id: 'predict-continue-sum',
    title: '預測 continue 後的總和',
    description: '同樣從 1 跑到 5，i == 3 時先 continue，其他迭代才累加與輸出。最後 sum 是多少？',
  },
  {
    id: 'identify-continue-update',
    title: '找出 continue 的下一步',
    description: '在 for (int i = 1; i <= 5; i++) 裡執行 continue 後，下一步會到哪裡？',
  },
]

export function evaluateBreakOutput(answer: string): LoopControlChallengeEvaluation {
  const expected = simulateLoopControlProgram({ mode: 'break', end: 5, trigger: 3 }).output
  const tokens = answer.trim().split(/[\s,，]+/)
  const values = tokens.map((token) => /^-?\d+$/.test(token) ? Number(token) : Number.NaN)
  const solved = values.length === expected.length
    && values.every((value, index) => value === expected[index])
  return {
    solved,
    message: solved
      ? '答對了！只印出 1、2。i == 3 時 break 直接離開迴圈，3 不會被累加或輸出，也不會執行 i++。'
      : '先看 if 的位置：i == 3 時會先 break，因此印出 1、2 後就離開整個迴圈。請以空白或逗號分隔輸出數列。',
  }
}

export function evaluateContinueSum(answer: number | null): LoopControlChallengeEvaluation {
  const expected = simulateLoopControlProgram({ mode: 'continue', end: 5, trigger: 3 }).sum
  const solved = answer !== null && answer === expected
  return {
    solved,
    message: solved
      ? '答對了！只跳過 i == 3 的累加，1 + 2 + 4 + 5 = 12。continue 後仍會執行 for 的 i++，再判斷下一次條件。'
      : 'continue 跳過本次剩餘的累加與輸出；i++ 仍會執行，因此 4、5 也會加入總和。',
  }
}

export function evaluateContinueUpdate(
  answer: 'increment' | 'condition' | 'exit' | null,
): LoopControlChallengeEvaluation {
  const solved = answer === 'increment'
  return {
    solved,
    message: solved
      ? '答對了！for 裡的 continue 會先到更新式 i++，接著才重新判斷 i <= 5。break 才是直接離開迴圈。'
      : '請沿著 for 的執行順序想：continue 先跳到更新式 i++，不是直接離開，也不是跳過更新就判斷條件。',
  }
}
