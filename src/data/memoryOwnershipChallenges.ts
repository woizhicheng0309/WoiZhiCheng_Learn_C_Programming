import { MEMORY_OWNERSHIP_CHALLENGE_IDS } from './challengeIds'
export { MEMORY_OWNERSHIP_CHALLENGE_IDS } from './challengeIds'

export const MEMORY_OWNERSHIP_CHALLENGES = [
  {
    id: MEMORY_OWNERSHIP_CHALLENGE_IDS[0],
    title: '交接完成後誰負責釋放？',
    question: 'move_buffer 已把位址存進 destination.data，並把 source.data 設為 NULL。依本程式的約定，誰負責釋放區塊？輸入 1 表示 source，2 表示 destination，3 表示借用者 view。',
    expected: [2],
    hint: '交接完成後，destination 負責釋放，view 保留借看資料的角色。',
  },
  {
    id: MEMORY_OWNERSHIP_CHALLENGE_IDS[1],
    title: '持有欄位清空後，view 是什麼狀態？',
    question: 'release_buffer 已釋放區塊並清空持有者的 data。main 還沒執行 view = NULL。輸入 1 表示 view 仍可解參照，2 表示 view 已自動變為 NULL，3 表示 view 的原指標值已失效。',
    expected: [3],
    hint: '區塊的生命週期已結束。直接指定 view = NULL 才會清空這個獨立的變數。',
  },
  {
    id: MEMORY_OWNERSHIP_CHALLENGE_IDS[2],
    title: '配置失敗走哪條路徑？',
    question: 'malloc 回傳 NULL。依序填寫這支程式的結束狀態，以及實際呼叫 free 的次數。',
    expected: [1, 0],
    hint: '失敗分支輸出訊息後回傳 1，沒有進入借用、轉交與釋放流程。',
  },
] as const

export type MemoryOwnershipChallengeId = typeof MEMORY_OWNERSHIP_CHALLENGES[number]['id']

export function evaluateMemoryOwnershipChallenge(id: MemoryOwnershipChallengeId, input: string) {
  const challenge = MEMORY_OWNERSHIP_CHALLENGES.find(item => item.id === id)!
  const tokens = input.trim().split(/[\s,，]+/)
  const solved = tokens.length === challenge.expected.length && tokens.every((token, index) =>
    /^\d+$/.test(token) && Number(token) === challenge.expected[index],
  )
  return { solved, message: solved ? `答對了！${challenge.hint}` : `再試一次。${challenge.hint}` }
}
