import { GRADEBOOK_CHALLENGE_IDS } from './challengeIds'
export { GRADEBOOK_CHALLENGE_IDS } from './challengeIds'

export const GRADEBOOK_CHALLENGES = [
  {
    id: GRADEBOOK_CHALLENGE_IDS[0], title: '陣列滿了還能寫下一格嗎？',
    question: '容量為 4，先後讀到 101,75、205,90、330,0、444,88、509,100，全部通過欄位驗證。依序輸入最後的 used 與 full。',
    expected: [4, 1], hint: '前四個編號依序填滿索引 0 到 3。第五個是新編號，計入 full。',
  },
  {
    id: GRADEBOOK_CHALLENGE_IDS[1], title: '滿表時先檢查哪件事？',
    question: '四格已滿，其中第一格是 101,75。接著讀到 101,99，採保留第一筆規則。依序輸入 duplicates 與 full 各增加多少。',
    expected: [1, 0], hint: '先查重複編號。這筆已找到既有位置，直接走重複分支。',
  },
  {
    id: GRADEBOOK_CHALLENGE_IDS[2], title: '查無編號時可以寫哪一筆？',
    question: 'find_record 回傳 -1。輸入 1 表示寫 rows[-1]，2 表示略過紀錄寫入並正常關檔，3 表示寫最後一格。',
    expected: [2], hint: 'index >= 0 是存取 rows[index] 的前置條件。查無時保留空報告。',
  },
] as const

export type GradebookChallengeId = typeof GRADEBOOK_CHALLENGES[number]['id']

export function evaluateGradebookChallenge(id: GradebookChallengeId, input: string) {
  const challenge = GRADEBOOK_CHALLENGES.find(item => item.id === id)!
  const tokens = input.trim().split(/[\s,，]+/)
  const solved = tokens.length === challenge.expected.length && tokens.every((token, index) =>
    /^\d+$/.test(token) && Number(token) === challenge.expected[index],
  )
  return { solved, message: solved ? `答對了！${challenge.hint}` : `再試一次。${challenge.hint}` }
}
