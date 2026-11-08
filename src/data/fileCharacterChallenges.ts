import { simulateFileCharacterProgram } from '../domain/fileCharacters'

export const FILE_CHARACTER_CHALLENGE_IDS = ['choose-fgetc-int', 'predict-fgetc-zero-byte', 'check-fgetc-early-stop'] as const
export type FileCharacterChallengeId = (typeof FILE_CHARACTER_CHALLENGE_IDS)[number]
export const FILE_CHARACTER_CHALLENGES = [
  { id: 'choose-fgetc-int' as const, title: '先保留完整回傳值', question: '本課每位元組有 8 位元，int 可表示 0 到 255。要保存 fgetc(fp) 的完整回傳值，先比較 EOF 再當成資料處理，ch 應宣告為哪個型別？輸入 1：char；輸入 2：int；輸入 3：unsigned char。' },
  { id: 'predict-fgetc-zero-byte' as const, title: '資料零值也要處理', question: '虛擬二進位檔的資料依序為 65、0、255、57，不提早停止且沒有 I/O 錯誤。逐筆處理直到 EOF，count 計算資料量，digits 計算 ASCII 數字字元數。count、digits 依序是多少？' },
  { id: 'check-fgetc-early-stop' as const, title: 'break 不會自動讀到 EOF', question: '資料為 A0\\nB9。啟用遇換行提早停止，在 count++ 之前 break。剛離開迴圈、尚未關閉串流時，count 與 feof 的布林結果（0：未設定，1：已設定）依序是多少？' },
]
export function evaluateFileCharacterChallenge(id: FileCharacterChallengeId, answer: string) {
  const expected = id === 'choose-fgetc-int' ? [2] : id === 'predict-fgetc-zero-byte' ? [4, 1]
    : [simulateFileCharacterProgram({ dataset: 'text', outcome: 'success', stopAtNewline: true }).printedValues![0], 0]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'choose-fgetc-int': 'fgetc 回傳 int。先存入 char 可能縮小可表示範圍，讓 EOF 判斷失去原本的資訊。',
    'predict-fgetc-zero-byte': '0 與 255 都是資料，不是 EOF；57 是 ASCII 的 9，所以處理 4 個位元組，其中 1 個數字字元。',
    'check-fgetc-early-stop': 'A、0 已計入 count，換行已讀取但在計數前 break。沒有讀到 EOF，結果是 2、0。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
