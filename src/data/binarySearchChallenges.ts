import { simulateBinarySearchProgram, DEFAULT_BINARY_SEARCH_CONFIG } from '../domain/binarySearch'
export const BINARY_SEARCH_CHALLENGE_IDS = ['predict-first-mid', 'update-left-bound', 'identify-empty-interval'] as const
export type BinarySearchChallengeId = (typeof BINARY_SEARCH_CHALLENGE_IDS)[number]
export const BINARY_SEARCH_CHALLENGES = [
  { id: 'predict-first-mid' as const, title: '找出第一個中點', question: '搜尋七格，left = 0、right = 6，mid = left + (right - left) / 2。第一個 mid 是多少？' },
  { id: 'update-left-bound' as const, title: '更新左邊界', question: 'target = 15，mid = 3，values[3] = 9。確認不相等且 9 < 15 後，新的 left 是多少？' },
  { id: 'identify-empty-interval' as const, title: '辨識空區間', question: '搜尋不存在的 10，found 一直為 -1，最後 left = 4、right = 3。while 結束後 found 是多少？' },
]
export function evaluateBinarySearchChallenge(id: BinarySearchChallengeId, answer: string) {
  const run = simulateBinarySearchProgram({ ...DEFAULT_BINARY_SEARCH_CONFIG, target: id === 'identify-empty-interval' ? 10 : 15 })
  const expected = id === 'predict-first-mid' ? run.frames.find(frame => frame.phase === 'initialize-mid')!.mid
    : id === 'update-left-bound' ? run.frames.find(frame => frame.phase === 'move-left')!.left : run.found
  const solved = /^-?\d+$/.test(answer.trim()) && Number(answer) === expected
  const hints = { 'predict-first-mid': 'mid = 0 + (6 - 0) / 2 = 3；這是索引，不是 values[3] 的值 9。', 'update-left-bound': 'left = mid + 1 = 4。已確認中點不相等，要排除中點，讓區間確實縮小。', 'identify-empty-interval': 'left > right 代表閉區間已空，停止讀取；找不到時保留 found = -1。' }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
