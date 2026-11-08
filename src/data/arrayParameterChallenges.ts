import { DEFAULT_ARRAY_PARAMETER_CONFIG, simulateArrayParameterProgram } from '../domain/arrayParameters'
export const ARRAY_PARAMETER_CHALLENGE_IDS = ['predict-array-return', 'predict-shared-array', 'choose-explicit-count'] as const
export type ArrayParameterChallengeId = (typeof ARRAY_PARAMETER_CHALLENGE_IDS)[number]
export const ARRAY_PARAMETER_CHALLENGES = [
  { id: 'predict-array-return' as const, title: '只加總指定範圍', question: 'scores = {4, 7, 2, 9, 5}，以唯讀模式傳入 count = 3，process 會回傳多少？' },
  { id: 'predict-shared-array' as const, title: '呼叫端陣列也改變', question: '同一個陣列改用原地修改模式，count = 3，處理的每格加 2。呼叫結束後，main 的五格 scores 依序是多少？' },
  { id: 'choose-explicit-count' as const, title: '元素數量從哪裡來？', question: '對函式參數 int items[]，應如何得知本次要處理的元素數量？輸入 1：用 sizeof items / sizeof items[0]；輸入 2：由呼叫端另外傳入 count。' },
]
export function evaluateArrayParameterChallenge(id: ArrayParameterChallengeId, answer: string) {
  const run = simulateArrayParameterProgram({ ...DEFAULT_ARRAY_PARAMETER_CONFIG, mode: id === 'predict-shared-array' ? 'modify' : 'read-only' })
  const expected = id === 'predict-array-return' ? [run.answer!] : id === 'predict-shared-array' ? run.scores! : [2]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^-?\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'predict-array-return': '只讀取索引 0、1、2，4 + 7 + 2 = 13；沒有把後面兩格算進去。',
    'predict-shared-array': 'items 連到 main 的同一個陣列；前三格改成 6、9、4，未處理的 9、5 維持原值。',
    'choose-explicit-count': 'int items[] 在函式參數中會調整為 int *items，sizeof items 是指標大小；要另外傳入 count，且不能超過實際可存取範圍。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
