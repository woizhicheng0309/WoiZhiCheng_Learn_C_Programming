import { STRUCTURE_FUNCTION_CHALLENGE_IDS } from './challengeIds'
export { STRUCTURE_FUNCTION_CHALLENGE_IDS } from './challengeIds'

export const STRUCTURE_FUNCTION_CHALLENGES = [
  {
    id: STRUCTURE_FUNCTION_CHALLENGE_IDS[0],
    title: '回傳結構值後再初始化預覽',
    question: 'original.score 為 70。revise 接收結構參數 copy，將 copy.score 改為 88 後回傳 copy。main 用回傳值初始化 preview，尚未呼叫 update。請依序填寫 original.score、preview.score。',
    expected: [70, 88],
    hint: 'copy 是函式自己的結構參數。修改後的值由 return 交回，用來初始化 preview，original.score 仍為 70。',
  },
  {
    id: STRUCTURE_FUNCTION_CHALLENGE_IDS[1],
    title: '先改指向，再決定改到哪筆',
    question: 'original.score 為 70，preview.score 為 88。selected 指向 original。update 收到 selected 的位址值後，先讓自己的 target 指向 preview，再寫入 96。回到 main 時，請依序填寫 original.score、preview.score、selected->score。',
    expected: [70, 96, 70],
    hint: '寫入當下 target 指向 preview，因此改到 preview.score。selected 仍保存 &original，讀到的分數是 70。',
  },
  {
    id: STRUCTURE_FUNCTION_CHALLENGE_IDS[2],
    title: '辨認 typedef 的作用',
    question: '宣告 typedef struct Student { int id; int score; } Student; 後，Student 和 struct Student 有何關係？輸入 1 表示兩種不同結構，2 表示同一型別的兩種寫法，3 表示 Student 是結構指標。',
    expected: [2],
    hint: 'Student 是該結構型別的別名。宣告指標時仍需加上 *，例如 Student *selected。',
  },
] as const

export type StructureFunctionChallengeId = typeof STRUCTURE_FUNCTION_CHALLENGES[number]['id']

export function evaluateStructureFunctionChallenge(id: StructureFunctionChallengeId, input: string) {
  const challenge = STRUCTURE_FUNCTION_CHALLENGES.find(item => item.id === id)!
  const tokens = input.trim().split(/[\s,，]+/)
  const solved = tokens.length === challenge.expected.length && tokens.every((token, index) =>
    /^\d+$/.test(token) && Number(token) === challenge.expected[index],
  )
  return { solved, message: solved ? `答對了！${challenge.hint}` : `再試一次。${challenge.hint}` }
}
