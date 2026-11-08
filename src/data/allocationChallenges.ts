import { simulateAllocationProgram } from '../domain/allocation'

export const ALLOCATION_CHALLENGE_IDS = ['choose-malloc-initialization', 'predict-allocated-sum', 'check-free-lifetime'] as const
export type AllocationChallengeId = (typeof ALLOCATION_CHALLENGE_IDS)[number]
export const ALLOCATION_CHALLENGES = [
  { id: 'choose-malloc-initialization' as const, title: '配置成功還需要初始化', question: 'malloc 成功取得 3 個 int 的空間後，尚未寫入元素。哪個敘述正確？輸入 1：三格必定都是 0；輸入 2：內容未初始化，應先寫入再讀取；輸入 3：配置成功代表元素已有程式指定的值。' },
  { id: 'predict-allocated-sum' as const, title: '逐格寫入再加總', question: '配置成功，count = 3、sum = 0。對 i = 0、1、2 依序執行 p[i] = 5 + i，再執行 sum += p[i]。最後 printf 輸出的 sum 是多少？' },
  { id: 'check-free-lifetime' as const, title: '釋放後的下一步', question: '成功配置、使用後已執行 free(p)，沒有其他指標別名。接下來哪個操作適當？輸入 1：讀取 p[0]；輸入 2：再次 free(p)；輸入 3：直接指定 p = NULL，且不再存取已釋放區塊。' },
]
export function evaluateAllocationChallenge(id: AllocationChallengeId, answer: string) {
  const expected = id === 'choose-malloc-initialization' ? 2 : id === 'predict-allocated-sum' ? simulateAllocationProgram().sum! : 3
  const token = answer.trim()
  const solved = /^\d+$/.test(token) && Number(token) === expected
  const hints = {
    'choose-malloc-initialization': 'malloc 不會替這些 int 初始化成已知數值；本課每格都先寫入，再讀取。calloc 則會清零位元，本課的 int 初始為 0。',
    'predict-allocated-sum': '依序寫入 5、6、7，再相加，sum = 18。',
    'check-free-lifetime': 'free 後區塊生命週期已結束，不讀取舊指標值或元素，也不重複釋放。直接指定 p = NULL 可以改寫這個指標變數。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
