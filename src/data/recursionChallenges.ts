import { simulateRecursionProgram } from '../domain/recursion'
export const RECURSION_CHALLENGE_IDS = ['predict-factorial', 'identify-base-case', 'identify-first-return'] as const
export type RecursionChallengeId = (typeof RECURSION_CHALLENGE_IDS)[number]
export const RECURSION_CHALLENGES = [
  { id: 'predict-factorial' as const, title: '預測 factorial(3)', question: '以本課的 factorial 定義呼叫 factorial(3)，最後回傳多少？' },
  { id: 'identify-base-case' as const, title: '理解 factorial(0)', question: 'if (n <= 1) return 1; 當 n = 0 時回傳多少？' },
  { id: 'identify-first-return' as const, title: '找出最先回傳的一層', question: '從 factorial(4) 開始呼叫時，第一個執行 return 的框架，其 n 是多少？' },
]
export function evaluateRecursionChallenge(id: RecursionChallengeId, answer: string) {
  const simulation = simulateRecursionProgram({ n: id === 'identify-base-case' ? 0 : id === 'predict-factorial' ? 3 : 4 })
  const expected = id === 'identify-first-return'
    ? simulation.frames.find(frame => frame.phase === 'return-base')!.stack.at(-1)!.n
    : simulation.answer
  const value = /^\d+$/.test(answer.trim()) ? Number(answer) : null
  const solved = value !== null && value === expected
  const hints = { 'predict-factorial': '先得到 factorial(2)，再乘上本層的 3：3 × 2 × 1。', 'identify-base-case': '0 <= 1 已成立，直接回傳 1；不會再呼叫 factorial(-1)。', 'identify-first-return': '呼叫先深入 4 → 3 → 2 → 1；n = 1 先滿足終止條件，再逐層回傳。' }
  return { solved, message: `${solved ? '答對了！' : '再追蹤一次：'}${hints[id]}` }
}
