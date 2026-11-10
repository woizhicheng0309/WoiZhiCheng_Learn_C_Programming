import { RECORD_FILE_CHALLENGE_IDS } from './challengeIds'
export { RECORD_FILE_CHALLENGE_IDS } from './challengeIds'

export const RECORD_FILE_CHALLENGES = [
  {
    id: RECORD_FILE_CHALLENGE_IDS[0],
    title: '分數讀得到，整筆就合格嗎？',
    question: '輸入行為 14,88,1。請輸入 1 表示合法，2 表示因 id 範圍拒絕，3 表示因尾端仍有資料而拒絕。',
    expected: [3],
    hint: '前兩欄各自有合法數值。解析 score 後，end 停在第二個逗號，因此整筆不合格。',
  },
  {
    id: RECORD_FILE_CHALLENGE_IDS[1],
    title: '合法筆數和寫入筆數各是多少？',
    question: '輸入依序為 10,80、11;95、13,60、15,100，每筆各佔一行。門檻為 70，I/O 正常。依序輸入 valid、rejected、written。',
    expected: [3, 1, 2],
    hint: '60 分符合欄位規則，所以計入 valid。只有 80 與 100 達到門檻。',
  },
  {
    id: RECORD_FILE_CHALLENGE_IDS[2],
    title: '寫入成功後還要檢查哪一步？',
    question: 'fprintf 都回報成功，但輸出檔的 fclose 回傳 EOF。輸入 1 表示仍回傳 0，2 表示回報 I/O 失敗並回傳 3，3 表示再使用同一串流重試 fclose。',
    expected: [2],
    hint: '關閉時可能才發現緩衝輸出錯誤。呼叫 fclose 後，原串流已解除關聯。',
  },
] as const

export type RecordFileChallengeId = typeof RECORD_FILE_CHALLENGES[number]['id']

export function evaluateRecordFileChallenge(id: RecordFileChallengeId, input: string) {
  const challenge = RECORD_FILE_CHALLENGES.find(item => item.id === id)!
  const tokens = input.trim().split(/[\s,，]+/)
  const solved = tokens.length === challenge.expected.length && tokens.every((token, index) =>
    /^\d+$/.test(token) && Number(token) === challenge.expected[index],
  )
  return { solved, message: solved ? `答對了！${challenge.hint}` : `再試一次。${challenge.hint}` }
}
