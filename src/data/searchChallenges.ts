import { SEARCH_CHALLENGE_IDS } from './challengeIds'
import { DEFAULT_SEARCH_CONFIG, simulateSearchProgram } from '../domain/search'

export { SEARCH_CHALLENGE_IDS } from './challengeIds'

export type SearchChallengeId = (typeof SEARCH_CHALLENGE_IDS)[number]
export const SEARCH_CHALLENGES = [
  { id: 'predict-first-match' as const, title: '第一筆相符的索引', question: '在 {4, 7, 2, 7, 5} 搜尋 7，找到就 break。最後 found 是多少？' },
  { id: 'predict-last-match' as const, title: '最後一筆相符的索引', question: '同樣搜尋 7，但相符後繼續走訪並更新 found。最後 found 是多少？' },
  { id: 'identify-not-found' as const, title: '找不到時的結果', question: 'found 先設為 -1，搜尋陣列中沒有的 9，走完五格之後 found 是多少？' },
]
export function evaluateSearchChallenge(id: SearchChallengeId, answer: string) {
  const config = { ...DEFAULT_SEARCH_CONFIG, ...(id === 'predict-last-match' ? { mode: 'last' as const } : {}), ...(id === 'identify-not-found' ? { target: 9 } : {}) }
  const expected = simulateSearchProgram(config).found
  const solved = /^-?\d+$/.test(answer.trim()) && Number(answer) === expected
  const hints = { 'predict-first-match': '第一個 7 在索引 1；break 讓比較在這裡停止。不是回傳元素值 7。', 'predict-last-match': '索引 1 與 3 都相符；持續搜尋會把 found 從 1 更新為 3。', 'identify-not-found': '沒有相符時，found 保持 -1。這是狀態標記，不是可用來存取陣列的索引。' }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
