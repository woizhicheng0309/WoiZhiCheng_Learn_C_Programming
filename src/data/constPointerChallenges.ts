import { CONST_POINTER_CHALLENGE_IDS } from './challengeIds'
import { simulateConstPointerProgram } from '../domain/constPointers'

export { CONST_POINTER_CHALLENGE_IDS } from './challengeIds'

export type ConstPointerChallengeId = (typeof CONST_POINTER_CHALLENGE_IDS)[number]
export const CONST_POINTER_CHALLENGES = [
  { id: 'choose-pointee-const' as const, title: '可改指向，但不可透過它改值', question: '哪一個宣告允許改指向、但不允許 *p = 30？輸入 1：const int *p；輸入 2：int *const p；輸入 3：const int *const p。' },
  { id: 'predict-fixed-pointer-write' as const, title: '固定指標仍可改值', question: 'int x = 10, y = 20; int *const p = &x; *p = 30; 執行後 x、y、*p 依序是多少？' },
  { id: 'predict-direct-alias-write' as const, title: '原變數沒有變成 const', question: 'int x = 10; const int *p = &x; x = 30; 最後透過 *p 讀到多少？x 是一般 int，這裡沒有透過 p 寫入。' },
]
export function evaluateConstPointerChallenge(id: ConstPointerChallengeId, answer: string) {
  const run = simulateConstPointerProgram({ kind: id === 'predict-fixed-pointer-write' ? 'pointer-const' : 'pointee-const', operation: id === 'predict-fixed-pointer-write' ? 'write-through' : 'direct-write', target: 'x' })
  const expected = id === 'choose-pointee-const' ? [1] : id === 'predict-fixed-pointer-write' ? run.printedValues! : [run.printedValues![2]]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'choose-pointee-const': 'const int *p 限制透過 p 改值，p 自己仍可以重新指定指向。int *const p 則是固定 p 本身。',
    'predict-fixed-pointer-write': 'p 不能改指向，但可以透過 *p 改到 x，所以 x、y、*p 為 30、20、30。',
    'predict-direct-alias-write': 'const int *p 只限制透過 p 寫入，沒有把原本的一般 int 變數 x 變成 const；直接改 x 後，*p 也會讀到 30。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
