export const STRUCT_INITIALIZATIONS = {
  full: { label: '完整初始化', source: "{7, 80, 'B'}" },
  partial: { label: '部分初始化：其餘成員為零值', source: '{7}' },
  designated: { label: '指定成員初始化', source: "{.score = 80, .grade = 'B', .id = 7}" },
} as const
export const STRUCT_FIELDS = {
  id: { type: 'int', label: 'id 設為 42', source: '42' },
  score: { type: 'int', label: 'score 設為 95', source: '95' },
  grade: { type: 'char', label: "grade 設為 'A'（ASCII 65）", source: "'A'" },
} as const
export type StructureObject = 'student' | 'backup'
export type StructureField = keyof typeof STRUCT_FIELDS
export interface StructureRecord { id: number; score: number; grade: string }
export interface StructureConfig { initialization: keyof typeof STRUCT_INITIALIZATIONS; target: StructureObject; field: StructureField }
export const DEFAULT_STRUCTURE_CONFIG: Readonly<StructureConfig> = { initialization: 'full', target: 'backup', field: 'score' }
export type StructurePhase = 'prepare' | 'enter-main' | 'initialize-student' | 'copy-structure' | 'update-member' | 'print-student' | 'print-backup' | 'return-main' | 'done' | 'blocked'
export interface StructureFrame {
  index: number
  phase: StructurePhase
  activeLine: number
  activePart: string
  explanation: string
  student: Readonly<StructureRecord> | null
  backup: Readonly<StructureRecord> | null
  mainInScope: boolean
  activeObject: StructureObject | null
  activeField: StructureField | null
  printedValues: readonly number[] | null
  output: readonly string[]
}
export function structureMemberValue(record: Readonly<StructureRecord>, field: StructureField): number {
  return field === 'grade' ? record.grade.charCodeAt(0) : record[field]
}
export function validateStructureConfig(config: StructureConfig = DEFAULT_STRUCTURE_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.initialization !== 'string' || !Object.hasOwn(STRUCT_INITIALIZATIONS, config.initialization)) issues.push('請選擇有效的初始化方式。')
  if (typeof config.field !== 'string' || !Object.hasOwn(STRUCT_FIELDS, config.field)) issues.push('請選擇有效的成員。')
  if (config.target !== 'student' && config.target !== 'backup') issues.push('請選擇原物件或副本。')
  return issues
}
export function buildStructureSource(config: StructureConfig = DEFAULT_STRUCTURE_CONFIG) {
  const initialization = typeof config.initialization === 'string' && Object.hasOwn(STRUCT_INITIALIZATIONS, config.initialization) ? STRUCT_INITIALIZATIONS[config.initialization] : STRUCT_INITIALIZATIONS.full
  const field = typeof config.field === 'string' && Object.hasOwn(STRUCT_FIELDS, config.field) ? config.field : 'score'
  const target = config.target === 'student' ? 'student' : 'backup'
  const code = ['#include <stdio.h>', '', 'struct Student {', '  int id;', '  int score;', '  char grade;', '};', '',
    'int main(void) {', `  struct Student student = ${initialization.source};`, '  struct Student backup = student;',
    `  ${target}.${field} = ${STRUCT_FIELDS[field].source};`,
    '  printf("student: id=%d, score=%d, grade_code=%d\\n", student.id, student.score, (unsigned char)student.grade);',
    '  printf("backup: id=%d, score=%d, grade_code=%d\\n", backup.id, backup.score, (unsigned char)backup.grade);', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateStructureProgram(config: StructureConfig = DEFAULT_STRUCTURE_CONFIG) {
  const stableConfig = { initialization: config.initialization, target: config.target, field: config.field }
  const source = buildStructureSource(stableConfig)
  const issues = validateStructureConfig(stableConfig)
  const frames: StructureFrame[] = []
  let student: StructureRecord | null = null
  let backup: StructureRecord | null = null
  let mainInScope = false
  let printedValues: number[] | null = null
  const output: string[] = []
  const add = (phase: StructurePhase, activeLine: number, explanation: string, activeObject: StructureObject | null = null, activeField: StructureField | null = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      student: student ? { ...student } : null, backup: backup ? { ...backup } : null,
      mainInScope, activeObject, activeField, printedValues: printedValues ? [...printedValues] : null, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    student: student ? { ...student } : null, backup: backup ? { ...backup } : null,
    printedValues: printedValues ? [...printedValues] : null, output: [...output] })
  add('prepare', 9, 'struct Student 定義成員與型別，尚未建立 student 或 backup 物件。')
  if (issues.length) {
    add('blocked', 9, `設定超出本練習範圍，在建立物件前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  mainInScope = true
  add('enter-main', 9, '進入 main，準備建立 struct Student 型別的物件。')
  student = stableConfig.initialization === 'partial' ? { id: 7, score: 0, grade: '\0' } : { id: 7, score: 80, grade: 'B' }
  add('initialize-student', 10, stableConfig.initialization === 'partial'
    ? "只明確指定 id = 7；這是部分初始化，score 為 0，grade 為 '\\0'，不是未初始化。"
    : stableConfig.initialization === 'designated' ? '依成員名稱初始化，書寫順序可不同；id、score、grade 各自得到對應的值。'
      : "依成員宣告順序初始化：id = 7、score = 80、grade = 'B'。", 'student')
  backup = { ...student }
  add('copy-structure', 11, '以 student 的成員值初始化 backup；這是另一個物件，不是原物件的別名。', 'backup')
  const edited = stableConfig.target === 'student' ? student : backup
  if (stableConfig.field === 'grade') edited.grade = 'A'
  else edited[stableConfig.field] = stableConfig.field === 'id' ? 42 : 95
  add('update-member', 12, `${stableConfig.target}.${stableConfig.field} 只修改這份物件的這個成員，另一份物件保留原值。`, stableConfig.target, stableConfig.field)
  const format = (name: StructureObject, record: StructureRecord) => `${name}: id=${record.id}, score=${record.score}, grade_code=${record.grade.charCodeAt(0)}`
  output.push(format('student', student))
  add('print-student', 13, '透過 student.成員讀取原物件；grade 以字元碼輸出，讓空字元也能清楚顯示。', 'student')
  output.push(format('backup', backup))
  printedValues = [structureMemberValue(student, stableConfig.field), structureMemberValue(backup, stableConfig.field)]
  add('print-backup', 14, '讀取 backup 的成員，對照修改後兩份物件的差異；本單元字元範例採 ASCII。', 'backup')
  add('return-main', 15, 'main 正常回傳 0。')
  mainInScope = false
  add('done', 16, 'main 結束，student 與 backup 離開作用域，主控台保留輸出。')
  return result('completed', `完成成員複製與修改；${stableConfig.field} 的原物件、副本值為 ${printedValues.join('、')}。`)
}
