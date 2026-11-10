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
export interface StructureConfig { initialization: keyof typeof STRUCT_INITIALIZATIONS; target: StructureObject; field: StructureField }
export const DEFAULT_STRUCTURE_CONFIG: Readonly<StructureConfig> = { initialization: 'full', target: 'backup', field: 'score' }
export function validateStructureConfig(config: StructureConfig = DEFAULT_STRUCTURE_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.initialization !== 'string' || !Object.hasOwn(STRUCT_INITIALIZATIONS, config.initialization)) issues.push('請選擇有效的初始化方式。')
  if (typeof config.field !== 'string' || !Object.hasOwn(STRUCT_FIELDS, config.field)) issues.push('請選擇有效的成員。')
  if (config.target !== 'student' && config.target !== 'backup') issues.push('請選擇原物件或副本。')
  return issues
}
