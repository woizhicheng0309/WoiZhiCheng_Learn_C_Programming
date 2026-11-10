import { DEFAULT_SCORE_FILE_CONFIG, simulateScoreFileProgram } from '../domain/scoreFile'

export const SCORE_FILE_CHALLENGE_IDS = ['validate-whole-score-record', 'predict-score-file-totals', 'handle-no-valid-scores'] as const
export type ScoreFileChallengeId = (typeof SCORE_FILE_CHALLENGE_IDS)[number]
export const SCORE_FILE_CHALLENGES = [
  { id: 'validate-whole-score-record' as const, title: '過長前綴不能變成一筆分數', question: 'line[12] 最多保存 11 個資料字元。一行有 13 個字元，保留的前綴能轉成合法分數 0，too_long 已設為 1。應怎麼處理？輸入 1：接受前綴；輸入 2：讀到該行結尾後整筆拒絕；輸入 3：把剩餘字元當下一筆。' },
  { id: 'predict-score-file-totals' as const, title: '只把完整合法紀錄加入總和', question: '資料依序為 80、abc、100、-5、70x、0，每筆各佔一行。I/O 成功，無效紀錄跳過，合法分數範圍包含 0 與 100。accepted、rejected、sum 依序是多少？' },
  { id: 'handle-no-valid-scores' as const, title: '沒有分數與平均零分不同', question: '檔案只有兩個空白行，沒有合法分數。平均值應顯示什麼？輸入 1：0.00；輸入 2：N/A，且不進行除法；輸入 3：用拒絕筆數作分母。' },
]
export function evaluateScoreFileChallenge(id: ScoreFileChallengeId, answer: string) {
  const run = simulateScoreFileProgram(DEFAULT_SCORE_FILE_CONFIG)
  const expected = id === 'predict-score-file-totals' ? [run.accepted, run.rejected, run.sum] : [2]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'validate-whole-score-record': 'too_long 一旦成立，本筆就維持無效；剩餘字元讀到換行後才開始新的一筆。',
    'predict-score-file-totals': '80、100、0 通過；abc、-5、70x 拒絕。因此接受 3、拒絕 3、總和 180。',
    'handle-no-valid-scores': 'accepted 為 0 時顯示 N/A，避免除以零；兩筆合法的 0 分才會有平均 0.00。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
