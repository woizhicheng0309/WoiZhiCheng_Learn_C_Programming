import { simulateMatrixProgram, DEFAULT_MATRIX_CONFIG } from '../domain/matrices'
export const MATRIX_CHALLENGE_IDS = ['predict-matrix-cell', 'predict-column-traversal', 'identify-matrix-offset'] as const
export type MatrixChallengeId = (typeof MATRIX_CHALLENGE_IDS)[number]
export const MATRIX_CHALLENGES = [
  { id: 'predict-matrix-cell' as const, title: '找出 grid[1][2]', question: 'grid 為 {{1, 2, 3}, {4, 5, 6}}。grid[1][2] 的值是多少？' },
  { id: 'predict-column-traversal' as const, title: '預測逐欄輸出', question: '外層 col 從 0 到 2，內層 row 從 0 到 1，printf grid[row][col] 的六個數字依序是什麼？' },
  { id: 'identify-matrix-offset' as const, title: '計算元素偏移', question: '每列 3 格的 grid[2][3] 中，grid[1][1] 距離第一格幾個元素？從 0 起算，不是計算位元組。' },
]
export function evaluateMatrixChallenge(id: MatrixChallengeId, answer: string) {
  const expected = id === 'predict-column-traversal'
    ? simulateMatrixProgram({ ...DEFAULT_MATRIX_CONFIG, mode: 'column-first' }).output
    : [id === 'predict-matrix-cell' ? simulateMatrixProgram().selected! : 1 * 3 + 1]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = { 'predict-matrix-cell': '列、欄都從 0 起算，先選第二列，再選第三格，所以值是 6。', 'predict-column-traversal': '逐欄讀取依序是 1、4、2、5、3、6；這不會改變 C 的逐列存放順序。', 'identify-matrix-offset': '元素偏移 = 列索引 × 每列欄數 + 欄索引，所以 1 × 3 + 1 = 4。' }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
