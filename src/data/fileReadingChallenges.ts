import { simulateFileReadingProgram } from '../domain/fileReading'

export const FILE_READING_CHALLENGE_IDS = ['choose-fgets-guard', 'predict-fgets-chunks', 'distinguish-file-read-error'] as const
export type FileReadingChallengeId = (typeof FILE_READING_CHALLENGE_IDS)[number]
export const FILE_READING_CHALLENGES = [
  { id: 'choose-fgets-guard' as const, title: '用讀取結果決定是否處理', question: 'fp 已開啟，buffer 是有效字元陣列。哪個條件適合控制每次字串處理？輸入 1：while (!feof(fp))；輸入 2：while (fgets(buffer, sizeof buffer, fp) != NULL)；輸入 3：先輸出 buffer，再檢查 fgets 的回傳值。' },
  { id: 'predict-fgets-chunks' as const, title: '讀取次數不一定等於行數', question: '文字串流為 "ABCDEF\\nX"，buffer 大小為 4，每次 fgets 最多讀 3 個字元且保留讀到的換行。沒有 I/O 錯誤，成功取得字串的次數是多少？只填成功次數，不算最後回傳 NULL 的呼叫。' },
  { id: 'distinguish-file-read-error' as const, title: 'NULL 也可能表示讀取錯誤', question: '新開啟串流的 EOF 與錯誤指標都未設定。第一次 fgets 在讀取任何字元前遇到讀取錯誤並回傳 NULL，沒有遇到 EOF。feof、ferror 的布林結果（0：未設定，1：已設定）依序是多少？' },
]
export function evaluateFileReadingChallenge(id: FileReadingChallengeId, answer: string) {
  const expected = id === 'choose-fgets-guard' ? [2] : id === 'predict-fgets-chunks'
    ? [simulateFileReadingProgram({ dataset: 'long', outcome: 'success', bufferSize: 4 }).successfulReads] : [0, 1]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'choose-fgets-guard': '先看 fgets 是否成功回傳 buffer，再處理這次字串。feof 不是預測下一次讀取是否成功的條件。',
    'predict-fgets-chunks': '依序取得 "ABC"、"DEF"、"\\n"、"X"，成功 4 次；最後的 NULL 不會再執行迴圈內容。',
    'distinguish-file-read-error': '這次設定的是錯誤指標：feof 為 0，ferror 為 1。NULL 本身不足以區分 EOF 與讀取錯誤。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
