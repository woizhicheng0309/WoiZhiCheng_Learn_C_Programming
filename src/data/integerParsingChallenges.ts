import { INTEGER_PARSING_CHALLENGE_IDS } from './challengeIds'
import { simulateIntegerParsingProgram } from '../domain/integerParsing'

export { INTEGER_PARSING_CHALLENGE_IDS } from './challengeIds'

export type IntegerParsingChallengeId = (typeof INTEGER_PARSING_CHALLENGE_IDS)[number]
export const INTEGER_PARSING_CHALLENGES = [
  { id: 'distinguish-strtol-zero' as const, title: '零值不等於轉換失敗', question: '以 base = 10 轉換 "0" 與 "abc"，strtol 都可能回傳 0。要分辨有沒有轉換任何數字，選哪個檢查？輸入 1：value == 0；輸入 2：end == text；輸入 3：只看字串長度。' },
  { id: 'predict-strtol-end' as const, title: '轉換前綴與停止位置', question: '以 base = 10 轉換 "42abc"，long 範圍足夠。回傳的 value，以及 end 相對 text 起點的索引，依序是多少？尚未執行其他尾端檢查或移動。' },
  { id: 'check-strtol-range' as const, title: '範圍錯誤也有停止位置', question: '在本課 32 位元二補數 long 模型，以 base = 10 轉換 "2147483648"，呼叫前 errno = 0。轉換後 end 的索引，以及 errno == ERANGE 的布林值（0：否，1：是），依序是多少？' },
]
export function evaluateIntegerParsingChallenge(id: IntegerParsingChallengeId, answer: string) {
  const run = simulateIntegerParsingProgram({ text: id === 'check-strtol-range' ? '2147483648' : '42abc', longBits: 32, allowTrailingSpace: false })
  const expected = id === 'distinguish-strtol-zero' ? [2] : id === 'predict-strtol-end' ? [Number(run.value), run.conversionEnd!] : [run.conversionEnd!, Number(run.errno === 'ERANGE')]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'distinguish-strtol-zero': '沒有轉換時 end 會回到 text 起點；合法的 "0" 則讓 end 移到索引 1。',
    'predict-strtol-end': '先轉換 42，再停在 a，所以 value = 42、end 索引 = 2。後續仍要檢查尾端資料。',
    'check-strtol-range': '數字序列仍消耗 10 個字元，但值超出上界，errno 會是 ERANGE，布林結果為 1。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
