import { STRUCTURE_ARRAY_CHALLENGE_IDS } from './challengeIds'
import { DEFAULT_STRUCTURE_ARRAY_CONFIG, simulateStructureArrayProgram } from '../domain/structureArrays'

export { STRUCTURE_ARRAY_CHALLENGE_IDS } from './challengeIds'

export type StructureArrayChallengeId = (typeof STRUCTURE_ARRAY_CHALLENGE_IDS)[number]
export const STRUCTURE_ARRAY_CHALLENGES = [
  { id: 'choose-structure-array-member' as const, title: '先選元素，再選成員', question: 'students 是 struct Student 陣列。要讀取第二筆資料的 score，選哪個寫法？輸入 1：students[1].score；輸入 2：students.score[1]；輸入 3：score.students[1]。' },
  { id: 'predict-structure-array-totals' as const, title: '修改後再統計', question: '三筆資料的分數依序為 80、60、95，先執行 students[1].score = 70，再走訪全部三筆。total 累加分數，passed 計算 score >= 80 的人數。輸出的 total、passed 依序是多少？' },
  { id: 'check-structure-array-bound' as const, title: '停止時不讀取下一格', question: 'students 有 3 個元素，用 for (int i = 0; i < 3; i++) 走訪。最後一個合法索引，以及讓迴圈條件第一次不成立的 i，依序是多少？' },
]
export function evaluateStructureArrayChallenge(id: StructureArrayChallengeId, answer: string) {
  const expected = id === 'choose-structure-array-member' ? [1]
    : id === 'predict-structure-array-totals' ? simulateStructureArrayProgram(DEFAULT_STRUCTURE_ARRAY_CONFIG).printedValues! : [2, 3]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'choose-structure-array-member': '索引從 0 開始，第二筆是 students[1]，再用 .score 取得這筆的成員。',
    'predict-structure-array-totals': '更新後是 80、70、95，總分 245；80 與 95 都滿足 >= 80，所以有 2 人達標。',
    'check-structure-array-bound': '合法索引是 0、1、2。i 變成 3 時，3 < 3 不成立，不會讀取 students[3]。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
