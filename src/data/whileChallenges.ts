import { DEFAULT_WHILE_CONFIG, simulateWhileProgram } from '../domain/whileLoops'

export const WHILE_CHALLENGE_IDS = [
  'predict-while-zero',
  'predict-do-once',
  'identify-loop-update',
] as const

export type WhileChallengeId = (typeof WHILE_CHALLENGE_IDS)[number]

export interface WhileChallengeDefinition {
  id: WhileChallengeId
  title: string
  description: string
}

export interface WhileChallengeEvaluation {
  solved: boolean
  message: string
}

export const WHILE_CHALLENGES: readonly WhileChallengeDefinition[] = [
  {
    id: 'predict-while-zero',
    title: '預測 while 的零次執行',
    description: 'i 從 5 開始，條件是 i < 3，每次 i += 1。while 的本體會執行幾次？',
  },
  {
    id: 'predict-do-once',
    title: '預測 do-while 的第一次',
    description: '同樣 i 從 5 開始、條件 i < 3、每次 i += 1。do-while 的本體會執行幾次？',
  },
  {
    id: 'identify-loop-update',
    title: '找出讓迴圈前進的更新',
    description: 'i = 0 且條件是 i < 3 時，哪個本體能在印出 i 後，讓迴圈接近結束？',
  },
]

export function evaluateWhileZero(answer: number | null): WhileChallengeEvaluation {
  const simulation = simulateWhileProgram({ ...DEFAULT_WHILE_CONFIG, start: 5 })
  const solved = answer !== null && simulation.status === 'completed' && answer === simulation.iterations
  return {
    solved,
    message: solved
      ? '答對了！while 先判斷 5 < 3，結果為 false，所以本體執行 0 次，也不會更新 i。'
      : 'while 會先檢查條件。5 < 3 一開始就是 false，不會先印一次再決定。',
  }
}

export function evaluateDoOnce(answer: number | null): WhileChallengeEvaluation {
  const simulation = simulateWhileProgram({ ...DEFAULT_WHILE_CONFIG, mode: 'do-while', start: 5 })
  const solved = answer !== null && simulation.status === 'completed' && answer === simulation.iterations
  return {
    solved,
    message: solved
      ? '答對了！do-while 先輸出 5，再把 i 更新為 6，最後判斷 6 < 3 為 false，因此本體執行 1 次。'
      : 'do-while 的條件在本體之後；先執行本體與更新，再檢查新的 i 是否符合條件。',
  }
}

export function evaluateWhileUpdate(
  answer: 'increment' | 'unchanged' | null,
): WhileChallengeEvaluation {
  const solved = answer === 'increment'
  return {
    solved,
    message: solved
      ? '答對了！printf 只輸出，不會改變 i；加入 i++ 後，i 依序變成 1、2、3，條件最後才會是 false。'
      : '只有 printf 時，i 仍然是 0，條件 i < 3 不會因此改變。需要更新 i，才能讓這個迴圈前進。',
  }
}
