import { SELECTION_SORT_CHALLENGE_IDS } from './challengeIds'
import { DEFAULT_SELECTION_SORT_CONFIG, simulateSelectionSortProgram } from '../domain/selectionSort'

export { SELECTION_SORT_CHALLENGE_IDS } from './challengeIds'

export type SelectionSortChallengeId = (typeof SELECTION_SORT_CHALLENGE_IDS)[number]
export const SELECTION_SORT_CHALLENGES = [
  { id: 'identify-first-best' as const, title: '第一輪候選的位置', question: '以升冪排序 {4, 1, 5, 2, 3}，第一輪比較完、交換前的 best 索引是多少？' },
  { id: 'predict-first-pass' as const, title: '預測第一輪交換後', question: '同樣以升冪排序 {4, 1, 5, 2, 3}。第一輪結束後，五個元素依序是什麼？' },
  { id: 'count-sorted-comparisons' as const, title: '已排序還要比較嗎？', question: '本課的選擇排序處理已排序的五格 {1, 2, 3, 4, 5}，仍會執行幾次 values[j] < values[best] 比較？不計迴圈條件。' },
]
export function evaluateSelectionSortChallenge(id: SelectionSortChallengeId, answer: string) {
  const run = simulateSelectionSortProgram({ ...DEFAULT_SELECTION_SORT_CONFIG, sample: id === 'count-sorted-comparisons' ? 'sorted' : 'mixed' })
  const expected = id === 'identify-first-best' ? [run.frames.find(frame => frame.phase === 'check-swap')!.variables.best.value!]
    : id === 'predict-first-pass' ? run.firstPassValues! : [run.comparisons]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = { 'identify-first-best': '最小值 1 在索引 1，best 記的是索引。', 'predict-first-pass': '交換索引 0 與 1，得到 1、4、5、2、3；第一輪只放好第一格，尚未完成整個排序。', 'count-sorted-comparisons': '本課每輪分別比較 4、3、2、1 次，合計 10 次；已排序時可以不交換，但比較仍會執行。' }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
