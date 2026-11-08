import { simulateStructurePointerProgram } from '../domain/structurePointers'

export const STRUCTURE_POINTER_CHALLENGE_IDS = ['choose-structure-arrow', 'predict-structure-pointer-alias', 'check-structure-null-guard'] as const
export type StructurePointerChallengeId = (typeof STRUCTURE_POINTER_CHALLENGE_IDS)[number]
export const STRUCTURE_POINTER_CHALLENGES = [
  { id: 'choose-structure-arrow' as const, title: '選出箭頭的等價寫法', question: 'p 是指向有效 struct Student 物件的指標。p->score 等同哪個寫法？輸入 1：(*p).score；輸入 2：p.score；輸入 3：*p.score。' },
  { id: 'predict-structure-pointer-alias' as const, title: '複製位址，再改指向', question: 'first.score = 80、second.score = 60。依序執行 p = &first；q = p；q->score = 95；p = &second；p->score = 70。最後 first.score、second.score 依序是多少？' },
  { id: 'check-structure-null-guard' as const, title: '空指標分支與另一個指標', question: 'p、q 都已宣告。只看這段：p = &first; q = p; p = NULL; if (p != NULL) { p->score = 70; }。q 指向哪裡（0：NULL，1：&first，2：&second），以及 if 內修改是否執行（0：否，1：是）？依序填入兩個整數。' },
]
export function evaluateStructurePointerChallenge(id: StructurePointerChallengeId, answer: string) {
  const expected = id === 'choose-structure-arrow' ? [1]
    : id === 'predict-structure-pointer-alias' ? simulateStructurePointerProgram().printedValues! : [1, 0]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'choose-structure-arrow': '先用 *p 取得結構，再用 .score 存取成員，因此要寫成 (*p).score。括號不能省略。',
    'predict-structure-pointer-alias': 'q 仍指向 first，寫入 95；p 改指向 second 後寫入 70。改指向沒有複製結構，也沒有改掉 q。',
    'check-structure-null-guard': 'p 改為 NULL 不影響 q 保存的 &first；p != NULL 不成立，所以分支內的成員存取不會執行。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
