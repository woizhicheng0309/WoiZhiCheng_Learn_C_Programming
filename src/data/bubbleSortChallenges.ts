import { BUBBLE_SORT_CHALLENGE_IDS } from './challengeIds'
import { DEFAULT_BUBBLE_SORT_CONFIG, simulateBubbleSortProgram } from '../domain/bubbleSort'

export { BUBBLE_SORT_CHALLENGE_IDS } from './challengeIds'

export type BubbleSortChallengeId = (typeof BUBBLE_SORT_CHALLENGE_IDS)[number]
export const BUBBLE_SORT_CHALLENGES = [
  { id: 'predict-bubble-pass' as const, title: '預測第一輪相鄰交換', question: '以升冪排序 {4, 1, 5, 2, 3}，由左往右完成第一輪相鄰比較後，五個元素依序是什麼？' },
  { id: 'count-early-comparisons' as const, title: '提前結束省了多少？', question: '開啟提前結束，以升冪處理已排序的五格 {1, 2, 3, 4, 5}，總共執行幾次相鄰元素比較？不計迴圈條件與 !swapped。' },
  { id: 'identify-whole-pass' as const, title: '一次沒交換就能停嗎？', question: '哪一種情況足以提前結束？輸入 1：某一對沒有交換；輸入 2：完整一輪沒有任何交換。' },
]
export function evaluateBubbleSortChallenge(id: BubbleSortChallengeId, answer: string) {
  const run = simulateBubbleSortProgram({ ...DEFAULT_BUBBLE_SORT_CONFIG, sample: id === 'count-early-comparisons' ? 'sorted' : 'mixed' })
  const expected = id === 'predict-bubble-pass' ? run.firstPassValues! : id === 'count-early-comparisons' ? [run.comparisons] : [2]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'predict-bubble-pass': '依序比較 (0,1)、(1,2)、(2,3)、(3,4)，得到 1、4、2、3、5；此時只有最右格確定。',
    'count-early-comparisons': '仍須完成第一輪 4 次比較，確認沒有交換後才能停止；關閉提前結束則共比較 10 次。',
    'identify-whole-pass': '必須是完整一輪沒有交換。某一對已有序，不能代表其他位置也都有序；swapped 每輪先歸零，交換過就保持 1。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
