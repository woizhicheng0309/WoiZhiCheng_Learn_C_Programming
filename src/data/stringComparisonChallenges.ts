import { STRING_COMPARISON_CHALLENGE_IDS } from './challengeIds'
import { DEFAULT_STRING_COMPARISON_CONFIG, simulateStringComparisonProgram } from '../domain/stringComparison'

export { STRING_COMPARISON_CHALLENGE_IDS } from './challengeIds'

export type StringComparisonChallengeId = (typeof STRING_COMPARISON_CHALLENGE_IDS)[number]
export const STRING_COMPARISON_CHALLENGES = [
  { id: 'find-first-difference' as const, title: '找到第一個不同位置', question: '左字串 "CAT" 與右字串 "CAR"，第一個不同字元的索引是多少？索引從 0 開始。' },
  { id: 'compare-prefix-sign' as const, title: '前綴如何比較？', question: '左字串 "CAR"、右字串 "CART"，strcmp 的結果屬於哪一類？輸入 -1 表示負值、0 表示零、1 表示正值；這裡只回答符號。' },
  { id: 'choose-strcmp-sign-check' as const, title: '正值不一定等於 1', question: '要判斷 strcmp(left, right) 表示左字串較大，哪個條件可靠？輸入 1：結果 == 1；輸入 2：結果 > 0。' },
]
export function evaluateStringComparisonChallenge(id: StringComparisonChallengeId, answer: string) {
  const run = simulateStringComparisonProgram({ ...DEFAULT_STRING_COMPARISON_CONFIG, sample: id === 'compare-prefix-sign' ? 'prefix' : 'different' })
  const expected = id === 'find-first-difference' ? run.decisiveIndex! : id === 'compare-prefix-sign' ? run.manual! : 2
  const solved = /^-?\d+$/.test(answer.trim()) && Number(answer) === expected
  const hints = {
    'find-first-difference': '索引 0 的 C 與索引 1 的 A 相等，索引 2 的 T、R 不同，所以在索引 2 決定結果。',
    'compare-prefix-sign': "前面 C、A、R 相等，接著比較 '\\0' 與 T；空字元的值較小，結果為負值。",
    'choose-strcmp-sign-check': 'strcmp 只保證負值、零、正值三種關係；非零的具體數值不固定，因此要用 > 0。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
