import {
  STRUCTURE_ARRAY_ROSTERS,
  type StructureArrayConfig,
  DEFAULT_STRUCTURE_ARRAY_CONFIG,
  validateStructureArrayConfig,
} from './structureArraysConfig'

export {
  STRUCTURE_ARRAY_ROSTERS,
  type StructureArrayConfig,
  DEFAULT_STRUCTURE_ARRAY_CONFIG,
  validateStructureArrayConfig,
} from './structureArraysConfig'

export interface StudentRow { id: number; score: number }
export type StructureArrayPhase = 'prepare' | 'enter-main' | 'initialize-array' | 'update-member'
  | 'initialize-totals' | 'for-init' | 'for-condition' | 'add-score' | 'if-condition'
  | 'count-pass' | 'for-update' | 'print' | 'return-main' | 'done' | 'blocked'
export interface StructureArrayFrame {
  index: number
  phase: StructureArrayPhase
  activeLine: number
  activePart: string
  explanation: string
  students: readonly Readonly<StudentRow>[] | null
  mainInScope: boolean
  i: number | null
  iInScope: boolean
  activeRow: number | null
  total: number | null
  passed: number | null
  condition: { expression: string; value: boolean } | null
  printedValues: readonly number[] | null
  output: readonly string[]
}

export function buildStructureArraySource(config: StructureArrayConfig = DEFAULT_STRUCTURE_ARRAY_CONFIG) {
  const safe = validateStructureArrayConfig(config).length ? DEFAULT_STRUCTURE_ARRAY_CONFIG : config
  const scores = STRUCTURE_ARRAY_ROSTERS[safe.roster].scores
  const initializer = scores.map((score, index) => `{${[7, 12, 21][index]}, ${score}}`).join(', ')
  const code = ['#include <stdio.h>', '', 'struct Student {', '  int id;', '  int score;', '};', '',
    'int main(void) {', `  struct Student students[3] = {${initializer}};`,
    `  students[${safe.index}].score = ${safe.score};`, '  int total = 0, passed = 0;',
    '  for (int i = 0; i < 3; i++) {', '    total += students[i].score;',
    `    if (students[i].score >= ${safe.threshold}) {`, '      passed++;', '    }', '  }',
    '  printf("total=%d, passed=%d\\n", total, passed);', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}

export function simulateStructureArrayProgram(config: StructureArrayConfig = DEFAULT_STRUCTURE_ARRAY_CONFIG) {
  const stableConfig = { roster: config.roster, index: config.index, score: config.score, threshold: config.threshold }
  const source = buildStructureArraySource(stableConfig)
  const issues = validateStructureArrayConfig(stableConfig)
  const frames: StructureArrayFrame[] = []
  let students: StudentRow[] | null = null
  let mainInScope = false
  let iInScope = false
  let i: number | null = null
  let total: number | null = null
  let passed: number | null = null
  let printedValues: number[] | null = null
  const output: string[] = []
  const snapshot = () => students?.map(student => ({ ...student })) ?? null
  const add = (phase: StructureArrayPhase, activeLine: number, explanation: string, activeRow: number | null = null,
    condition: StructureArrayFrame['condition'] = null, activePart = `line-${activeLine}`) => {
    frames.push({ index: frames.length, phase, activeLine, activePart, explanation, students: snapshot(),
      mainInScope, i, iInScope, activeRow, total, passed, condition: condition ? { ...condition } : null,
      printedValues: printedValues ? [...printedValues] : null, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({
    config: stableConfig, source, frames, status, message, students: snapshot(), total, passed,
    printedValues: printedValues ? [...printedValues] : null, output: [...output],
  })
  add('prepare', 8, 'struct Student 描述一筆資料的成員，students 陣列尚未建立。')
  if (issues.length) {
    add('blocked', 8, `設定超出本練習範圍，在建立陣列前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  mainInScope = true
  add('enter-main', 8, '進入 main，準備建立三個 struct Student 元素。')
  students = STRUCTURE_ARRAY_ROSTERS[stableConfig.roster].scores.map((score, index) => ({ id: [7, 12, 21][index], score }))
  add('initialize-array', 9, '每一組內層大括號初始化一個結構元素；合法索引是 0、1、2，和 id 成員的值不同。')
  students[stableConfig.index].score = stableConfig.score
  add('update-member', 10, `先用 [${stableConfig.index}] 選到第 ${stableConfig.index + 1} 筆，再用 .score 更新分數；id 與其他元素保持原值。`, stableConfig.index)
  total = 0; passed = 0
  add('initialize-totals', 11, 'total 與 passed 分別從 0 開始，保存總分與達標人數。')
  i = 0; iInScope = true
  add('for-init', 12, '建立迴圈變數 i = 0，接著檢查條件。', null, null, 'for-init')
  while (true) {
    const valid = i < 3
    add('for-condition', 12, valid ? `${i} < 3 成立，可以讀取 students[${i}]。`
      : '3 < 3 不成立，離開迴圈；不讀取不存在的 students[3]。',
    valid ? i : null, { expression: `${i} < 3`, value: valid }, 'for-condition')
    if (!valid) { iInScope = false; break }
    const student = students[i]
    total += student.score
    add('add-score', 13, `把 students[${i}].score 的 ${student.score} 加入 total，目前總分為 ${total}。`, i)
    const meets = student.score >= stableConfig.threshold
    add('if-condition', 14, `${student.score} >= ${stableConfig.threshold} ${meets ? '成立，這筆要計入達標人數' : '不成立，跳過 passed++'}。`, i,
      { expression: `${student.score} >= ${stableConfig.threshold}`, value: meets })
    if (meets) {
      passed++
      add('count-pass', 15, `passed 增加 1，目前有 ${passed} 人達標。`, i)
    }
    i++
    add('for-update', 12, `執行 i++，i 變成 ${i}；先回去檢查條件，不直接讀取元素。`, null, null, 'for-update')
  }
  printedValues = [total, passed]
  output.push(`total=${total}, passed=${passed}`)
  add('print', 18, '迴圈結束，i 已離開作用域；輸出更新後三筆資料的總分與達標人數。')
  add('return-main', 19, 'main 正常回傳 0。')
  mainInScope = false
  add('done', 20, 'main 結束，陣列與累計變數離開作用域；主控台保留輸出。')
  return result('completed', `總分 ${total}，達標人數 ${passed}。`)
}
