import { DYNAMIC_RECORDS_CHALLENGE_IDS } from './challengeIds'
export { DYNAMIC_RECORDS_CHALLENGE_IDS } from './challengeIds'
export type DynamicRecordsChallengeId = typeof DYNAMIC_RECORDS_CHALLENGE_IDS[number]
export const DYNAMIC_RECORDS_CHALLENGES = [
  { id: DYNAMIC_RECORDS_CHALLENGE_IDS[0], title: '六筆資料需要幾次擴充？',
    question: '空清單起始為 0 格，第一次配置 2 格，之後容量加倍。六筆資料全部加入成功，依序輸入 used、capacity、配置嘗試次數。',
    expected: [6, 8, 3], hint: '容量依序是 2、4、8，已使用 6 格，剩下兩格尚未初始化。' },
  { id: DYNAMIC_RECORDS_CHALLENGE_IDS[1], title: '擴充失敗保留哪些資料？',
    question: '已加入兩筆，used = 2、capacity = 2。加入第三筆時 temp 接到 NULL，程式停止加入。依序輸入保留的 used、capacity，以及這筆新增成功與否（1 成功、0 失敗）。',
    expected: [2, 2, 0], hint: '先以 temp 接回結果；失敗不改寫 data、capacity，也不寫入或增加 used。' },
  { id: DYNAMIC_RECORDS_CHALLENGE_IDS[2], title: '輸出與釋放的範圍',
    question: '六筆成功存入八格容量後，以 i < used 輸出。依序輸入可輸出的紀錄筆數、尚未初始化的空格數，以及最後需要 free 的區塊數。',
    expected: [6, 2, 1], hint: '讀取僅限六筆有效紀錄。成功 realloc 已處理舊區塊，最後只釋放目前仍持有的區塊一次。' },
] as const
export function evaluateDynamicRecordsChallenge(id: DynamicRecordsChallengeId, input: string) {
  const challenge = DYNAMIC_RECORDS_CHALLENGES.find(item => item.id === id)!
  const tokens = input.trim().split(/[\s,，]+/)
  const solved = tokens.length === challenge.expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === challenge.expected[index])
  return { solved, message: `${solved ? '答對了！' : '再試一次。'}${challenge.hint}` }
}
