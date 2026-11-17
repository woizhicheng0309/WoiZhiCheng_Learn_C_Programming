import { SCORE_RANGE_CHALLENGE_IDS } from './challengeIds'

export { SCORE_RANGE_CHALLENGE_IDS } from './challengeIds'
export type ScoreRangeChallengeId = typeof SCORE_RANGE_CHALLENGE_IDS[number]
export const SCORE_RANGE_CHALLENGES = [
  {
    id: SCORE_RANGE_CHALLENGE_IDS[0], title: '同分紀錄的兩個邊界',
    question: '排序後的分數依序是 0、60、80、80、80、100。查詢包含兩端的 80～80 分，依序輸入 begin、end、符合筆數。索引從 0 開始，結果以 [begin, end) 表示。',
    expected: [2, 5, 3], hint: '第一筆至少 80 分的位置為 2，第一筆超過 80 分的位置為 5，筆數為 5 - 2。',
  },
  {
    id: SCORE_RANGE_CHALLENGE_IDS[1], title: '同分時保留哪些編號順序？',
    question: '原始紀錄依序是 {11,80}、{12,60}、{13,80}、{14,100}、{15,80}、{16,0}。只在左邊分數大於 key 時右移，完成穩定排序後，三筆 80 分的 id 依序是多少？',
    expected: [11, 13, 15], hint: '只比較 score，遇到相等時停止右移，因此同分紀錄維持原始先後。',
  },
  {
    id: SCORE_RANGE_CHALLENGE_IDS[2], title: '邊界等於筆數時如何輸出？',
    question: 'count 為 6，查詢結果 begin = 6、end = 6。程式以 i = begin 開始，條件為 i < end。會輸出幾筆紀錄？',
    expected: [0], hint: '[6, 6) 是空範圍，迴圈條件一開始就不成立，沒有讀取 rows[6]。',
  },
] as const

export function evaluateScoreRangeChallenge(id: ScoreRangeChallengeId, input: string) {
  const challenge = SCORE_RANGE_CHALLENGES.find(item => item.id === id)!
  const tokens = input.trim().split(/[\s,，]+/)
  const solved = tokens.length === challenge.expected.length && tokens.every((token, index) =>
    /^\d+$/.test(token) && Number(token) === challenge.expected[index],
  )
  return { solved, message: `${solved ? '答對了！' : '再試一次。'}${challenge.hint}` }
}
