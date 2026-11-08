import { DEFAULT_STRUCTURE_CONFIG, simulateStructureProgram } from '../domain/structures'
export const STRUCTURE_CHALLENGE_IDS = ['choose-struct-member', 'predict-structure-copy', 'predict-partial-structure'] as const
export type StructureChallengeId = (typeof STRUCTURE_CHALLENGE_IDS)[number]
export const STRUCTURE_CHALLENGES = [
  { id: 'choose-struct-member' as const, title: '選對成員存取方式', question: 'student 是 struct Student 物件，如何讀取它的 score？輸入 1：student.score；輸入 2：student[score]；輸入 3：Student.score。' },
  { id: 'predict-structure-copy' as const, title: '副本修改不影響原物件', question: 'student 初始化為 {7, 80, \'B\'}，用它初始化 backup，再執行 backup.score = 95。student.score 與 backup.score 依序是多少？' },
  { id: 'predict-partial-structure' as const, title: '省略的成員不是未初始化', question: 'struct Student 的成員依序是 int id、int score、char grade。以 {7} 初始化後，score 和 grade 的字元碼依序是多少？' },
]
export function evaluateStructureChallenge(id: StructureChallengeId, answer: string) {
  const run = simulateStructureProgram(id === 'predict-partial-structure' ? { ...DEFAULT_STRUCTURE_CONFIG, initialization: 'partial', field: 'id' } : DEFAULT_STRUCTURE_CONFIG)
  const expected = id === 'choose-struct-member' ? [1] : id === 'predict-structure-copy' ? run.printedValues! : [run.student!.score, run.student!.grade.charCodeAt(0)]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'choose-struct-member': '用物件名稱加上點運算子與成員名稱：student.score。struct Student 是型別，不是 student 這份物件。',
    'predict-structure-copy': '兩份物件各自保存成員值，所以 student.score 仍是 80，backup.score 改為 95。',
    'predict-partial-structure': "這是部分初始化；未明確指定的成員得到零值，所以 score 是 0、grade 是字元碼 0 的 '\\0'。",
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
