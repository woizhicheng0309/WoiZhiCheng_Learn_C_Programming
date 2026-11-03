import { DEFAULT_INSERTION_SORT_CONFIG, simulateInsertionSortProgram } from '../domain/insertionSort'
export const INSERTION_SORT_CHALLENGE_IDS = ['predict-insertion-pass', 'identify-short-circuit', 'count-insertion-shifts'] as const
export type InsertionSortChallengeId = (typeof INSERTION_SORT_CHALLENGE_IDS)[number]
export const INSERTION_SORT_CHALLENGES = [
  { id: 'predict-insertion-pass' as const, title: '預測第一輪插入後', question: '將 {4, 3, 1, 5, 2} 升冪排序。i = 1 的第一輪結束後，五格依序是什麼？' },
  { id: 'identify-short-circuit' as const, title: '負索引與短路判斷', question: '當 j = -1，執行 j >= 0 && values[j] > key 時，右側 values[j] > key 會執行幾次？' },
  { id: 'count-insertion-shifts' as const, title: '已排序的右移次數', question: '將已升冪排序的 {1, 2, 3, 4, 5} 再做本課的升冪插入排序，values[j + 1] = values[j] 會執行幾次？不計 key 的寫回。' },
]
export function evaluateInsertionSortChallenge(id: InsertionSortChallengeId, answer: string) {
  const run = simulateInsertionSortProgram({ ...DEFAULT_INSERTION_SORT_CONFIG, sample: id === 'count-insertion-shifts' ? 'sorted' : 'mixed' })
  const expected = id === 'predict-insertion-pass' ? run.firstPassValues! : [id === 'identify-short-circuit' ? 0 : run.shifts]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = { 'predict-insertion-pass': '先保存 key = 3，把 4 右移，再將 3 寫到索引 0，得到 3、4、1、5、2；有序前綴只有前兩格。', 'identify-short-circuit': '左側 j >= 0 為 false，&& 不執行右側，因此是 0 次，也不會讀取 values[-1]。', 'count-insertion-shifts': '本課嚴格比較是否需要右移，已排序時不右移，所以是 0 次；但仍會做 4 次元素比較。' }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
