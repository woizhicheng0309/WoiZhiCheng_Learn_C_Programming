import {
  DEFAULT_POINTER_CONFIG,
  simulatePointerProgram,
} from '../domain/pointers'

export const POINTER_CHALLENGE_IDS = [
  'predict-pointer-read',
  'write-through-pointer',
  'identify-null-pointer',
] as const

export type PointerChallengeId = (typeof POINTER_CHALLENGE_IDS)[number]

export interface PointerChallengeDefinition {
  id: PointerChallengeId
  title: string
  description: string
}

export interface PointerChallengeEvaluation {
  solved: boolean
  message: string
}

export const POINTER_CHALLENGES: readonly PointerChallengeDefinition[] = [
  {
    id: 'predict-pointer-read',
    title: '預測 *p 的讀取結果',
    description: 'x 是 5、y 是 9，且 p = &x 時，selected = *p 會讀到多少？',
  },
  {
    id: 'write-through-pointer',
    title: '透過指標把 y 改成 12',
    description: 'p = &y 時，調整 *p 寫入的值，讓 y 成為 12，並保留 x 的原值。',
  },
  {
    id: 'identify-null-pointer',
    title: '判斷 NULL 能否解參照',
    description: 'int *p = NULL; 已完成初始化，接著讀取 *p 是安全的嗎？',
  },
]

export function evaluatePointerPrediction(
  prediction: number | null,
): PointerChallengeEvaluation {
  const simulation = simulatePointerProgram(DEFAULT_POINTER_CONFIG)
  const solved = prediction !== null
    && simulation.status === 'completed'
    && prediction === simulation.selectedValue
  return {
    solved,
    message: solved
      ? '答對了！p 保存 x 的位址，*p 讀取的是 x 的值 5，不是位址本身。'
      : '看看 p 指向誰：p = &x，所以 *p 會讀取 x 記憶格中的整數值。',
  }
}

export function evaluatePointerWrite(
  newValue: number | null,
): PointerChallengeEvaluation {
  if (newValue === null) {
    return { solved: false, message: '請先輸入要透過 *p 寫入的整數。' }
  }
  const simulation = simulatePointerProgram({
    ...DEFAULT_POINTER_CONFIG,
    target: 'y',
    newValue,
  })
  const write = simulation.frames.find((frame) => frame.phase === 'write-pointer')
  const solved = simulation.status === 'completed'
    && write?.memory.y === 12
    && write.memory.x === DEFAULT_POINTER_CONFIG.x
  return {
    solved,
    message: solved
      ? '完成！p 指向 y，*p = 12 直接把 y 改成 12；x 仍然是 5，p 的指向也沒有改變。'
      : simulation.status === 'blocked'
        ? simulation.message
        : `目前透過 *p 把 y 改成 ${newValue}；請讓 y 成為 12。`,
  }
}

export function evaluateNullPointer(
  answer: 'safe' | 'unsafe' | null,
): PointerChallengeEvaluation {
  const simulation = simulatePointerProgram({ ...DEFAULT_POINTER_CONFIG, target: 'null' })
  const solved = answer === 'unsafe' && simulation.status === 'blocked'
  return {
    solved,
    message: solved
      ? '答對了！NULL 表示沒有指向可存取的物件。初始化 p 不代表可以讀取 *p；解參照 NULL 是未定義行為。'
      : 'p 雖然已初始化為 NULL，卻沒有指向有效的 int 物件；不能假定 *p 會讀到 0。',
  }
}
