import { DEFAULT_SWAP_CONFIG, simulateSwapProgram } from '../domain/swap'

export const SWAP_CHALLENGE_IDS = [
  'predict-value-swap',
  'choose-pointer-call',
  'preserve-swap-temp',
] as const

export type SwapChallengeId = (typeof SWAP_CHALLENGE_IDS)[number]

export interface SwapChallengeDefinition {
  id: SwapChallengeId
  title: string
  description: string
}

export interface SwapChallengeEvaluation {
  solved: boolean
  message: string
}

export const SWAP_CHALLENGES: readonly SwapChallengeDefinition[] = [
  {
    id: 'predict-value-swap',
    title: '預測整數副本交換後的輸出',
    description: 'main 的 x 是 5、y 是 9。呼叫 swap(x, y) 交換參數 a、b 後，main 會輸出哪兩個值？',
  },
  {
    id: 'choose-pointer-call',
    title: '選擇能改寫呼叫端的引數',
    description: '函式宣告是 void swap(int *a, int *b)。要交換 main 的 x、y，應傳入整數值還是它們的位址？',
  },
  {
    id: 'preserve-swap-temp',
    title: '為什麼交換需要 temp？',
    description: 'x 是 5、y 是 9，a 指向 x、b 指向 y。若省略 temp，只執行 *a = *b; 再執行 *b = *a;，結果會如何？',
  },
]

export function evaluateValueSwap(
  x: number | null,
  y: number | null,
): SwapChallengeEvaluation {
  const simulation = simulateSwapProgram(DEFAULT_SWAP_CONFIG)
  const main = simulation.frames.at(-1)!.memory.main
  const solved = x !== null && y !== null
    && simulation.status === 'completed'
    && x === main.x && y === main.y
  return {
    solved,
    message: solved
      ? '答對了！main 仍輸出 5 9。a、b 收到整數副本，交換副本不會改變 x、y。'
      : '沿著框架再看一次：swap 修改的是區域參數 a、b；main 的 x、y 沒有被寫入。',
  }
}

export function evaluatePointerCall(
  answer: 'addresses' | 'values' | null,
): SwapChallengeEvaluation {
  const simulation = simulateSwapProgram({ ...DEFAULT_SWAP_CONFIG, mode: 'pointer' })
  const solved = answer === 'addresses' && simulation.status === 'completed'
  return {
    solved,
    message: solved
      ? '答對了！swap(&x, &y) 把位址值複製給 a、b，再用 *a、*b 改寫 x、y。C 仍是以值傳遞，這次複製的是位址。'
      : 'int * 參數要收到 int 物件的位址。請用 &x、&y 取得位址，讓解參照能找到 main 的變數。',
  }
}

export function evaluateSwapTemp(
  answer: 'both-nine' | 'swapped' | null,
): SwapChallengeEvaluation {
  // This question deliberately describes the broken two-assignment program,
  // not the correct simulator above, which preserves the original value in temp.
  const solved = answer === 'both-nine'
  return {
    solved,
    message: solved
      ? '答對了！第一步已把 x 改成 9；第二步再讀 *a 只會讀到 9，所以 x、y 最後都是 9。temp 才能保留原來的 5。'
      : '執行 *a = *b 後，x 的 5 已被 9 覆寫；接著 *b = *a 讀到的是新的 9，不會自動記住原來的 5。',
  }
}
