import { REALLOCATION_CHALLENGE_IDS } from './challengeIds'
import { simulateReallocationProgram } from '../domain/reallocation'

export { REALLOCATION_CHALLENGE_IDS } from './challengeIds'

export type ReallocationChallengeId = (typeof REALLOCATION_CHALLENGE_IDS)[number]
export const REALLOCATION_CHALLENGES = [
  { id: 'choose-realloc-temporary' as const, title: '先用暫存指標接結果', question: 'p 指向有效的配置，要求的新大小大於 0。為了在 realloc 失敗時保留原指標，選哪個流程？輸入 1：直接 p = realloc(p, size)；輸入 2：tmp = realloc(p, size)，tmp 非 NULL 才指定 p = tmp；輸入 3：先 free(p) 再 realloc(p, size)。' },
  { id: 'predict-realloc-growth' as const, title: '保留前綴，初始化新增部分', question: '原三個 int 是 4、7、9，realloc 成功擴充為 5 個。新增兩格各先寫入 6，再走訪全部元素。最後 count、sum 依序是多少？' },
  { id: 'predict-realloc-shrink' as const, title: '縮小後只讀取保留範圍', question: '原三個 int 是 4、7、9，realloc 成功縮小為 2 個。只走訪新容量內的元素，最後 count、sum 依序是多少？' },
]
export function evaluateReallocationChallenge(id: ReallocationChallengeId, answer: string) {
  const expected = id === 'choose-realloc-temporary' ? [2] : id === 'predict-realloc-growth'
    ? simulateReallocationProgram().printedValues!
    : simulateReallocationProgram({ dataset: 'mixed', outcome: 'in-place', requested: 2, fill: 6 }).printedValues!
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'choose-realloc-temporary': '用 tmp 接收結果，失敗時原 p 與區塊不變。直接覆寫 p 可能遺失唯一的原區塊位址。',
    'predict-realloc-growth': '前綴 4、7、9 保留，新增元素寫入 6、6；count = 5，sum = 32。',
    'predict-realloc-shrink': '新容量只有 2，保留 4、7，不再存取原第三格；count = 2，sum = 11。',
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
