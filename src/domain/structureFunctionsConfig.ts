export const STRUCTURE_TYPE_NAMES = {
  alias: { label: '使用別名 Student', name: 'Student' },
  tag: { label: '使用標籤 struct Student', name: 'struct Student' },
} as const

export const STRUCTURE_WRITE_ORDERS = {
  'write-first': '先透過 target 寫入，再改指向',
  'rebind-first': '先改 target 的指向，再透過它寫入',
} as const

export interface StructureFunctionConfig {
  typeName: keyof typeof STRUCTURE_TYPE_NAMES
  writeOrder: keyof typeof STRUCTURE_WRITE_ORDERS
  previewScore: number
  writeScore: number
}

export const DEFAULT_STRUCTURE_FUNCTION_CONFIG: Readonly<StructureFunctionConfig> = {
  typeName: 'alias', writeOrder: 'write-first', previewScore: 88, writeScore: 96,
}

export function validateStructureFunctionConfig(config: StructureFunctionConfig): string[] {
  const issues: string[] = []
  if (config.typeName !== 'alias' && config.typeName !== 'tag') issues.push('請選擇 Student 或 struct Student。')
  if (config.writeOrder !== 'write-first' && config.writeOrder !== 'rebind-first') issues.push('請選擇函式內的寫入順序。')
  for (const score of [config.previewScore, config.writeScore]) {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      issues.push('分數須為 0 到 100 的整數。')
      break
    }
  }
  return issues
}
