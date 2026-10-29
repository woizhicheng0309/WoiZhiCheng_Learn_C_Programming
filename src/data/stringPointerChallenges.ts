import { simulateStringPointerProgram } from '../domain/stringPointers'

export const STRING_POINTER_CHALLENGE_IDS = [
  'predict-digit-zero-length',
  'choose-string-terminator',
  'identify-embedded-nul',
] as const

export type StringPointerChallengeId = (typeof STRING_POINTER_CHALLENGE_IDS)[number]

export interface StringPointerChallengeDefinition {
  id: StringPointerChallengeId
  title: string
  description: string
}

export interface StringPointerChallengeEvaluation {
  solved: boolean
  message: string
}

export const STRING_POINTER_CHALLENGES: readonly StringPointerChallengeDefinition[] = [
  {
    id: 'predict-digit-zero-length',
    title: '預測包含 0 的字串長度',
    description: '用正確的空字元停止條件走訪 "C0DE"，length 最後會是多少？',
  },
  {
    id: 'choose-string-terminator',
    title: '選出真正的字串終止符',
    description: "字串走訪應該在遇到數字字元 '0' 時停止，還是在遇到空字元 '\\0' 時停止？",
  },
  {
    id: 'identify-embedded-nul',
    title: '辨識中途的空字元',
    description: 'char text[] = "CO\\0DE"; 用正確的空字元停止條件走訪時，會輸出 CO 還是 CODE？',
  },
]

export function evaluateDigitZeroLength(
  answer: number | null,
): StringPointerChallengeEvaluation {
  const simulation = simulateStringPointerProgram({ sample: 'digit-zero', stopAt: 'nul' })
  const solved = answer !== null && simulation.status === 'completed' && answer === simulation.length
  return {
    solved,
    message: solved
      ? "答對了！C、0、D、E 都是字串內容，所以長度是 4；數字字元 '0' 不是終止字元 '\\0'。"
      : "看看每一格：數字字元 '0' 也是內容，只有遇到空字元 '\\0' 才停止，終止字元本身不計入長度。",
  }
}

export function evaluateStringTerminator(
  answer: 'nul' | 'digit-zero' | null,
): StringPointerChallengeEvaluation {
  const solved = answer === 'nul'
  return {
    solved,
    message: solved
      ? "答對了！C 字串用空字元 '\\0' 結束；'0' 是數字字元。在這個 ASCII 範例中，兩者的碼值分別是 0 與 48。"
      : "請分清楚：'0' 是可見的數字字元，'\\0' 是碼值為 0 的空字元。把停止條件寫成 '0' 可能提早停止，也可能走出陣列。",
  }
}

export function evaluateEmbeddedNul(
  answer: 'CO' | 'CODE' | null,
): StringPointerChallengeEvaluation {
  const simulation = simulateStringPointerProgram({ sample: 'embedded-nul', stopAt: 'nul' })
  const solved = answer !== null && simulation.status === 'completed' && answer === simulation.outputText
  return {
    solved,
    message: solved
      ? "答對了！遇到 text[2] 的第一個 '\\0' 就停止，所以只輸出 CO，長度是 2；後面的 D、E 仍在陣列中，卻不屬於這段 C 字串的內容。"
      : "從第一格往後走：C、O 之後就是 '\\0'，while 在這裡判斷為 false，不會跳過空字元繼續輸出 D、E。",
  }
}
