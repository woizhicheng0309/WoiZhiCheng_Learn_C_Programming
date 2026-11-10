export const CONST_POINTER_KINDS = {
  mutable: { declaration: 'int *p', label: 'int *p：兩者皆可改', canWrite: true, canRebind: true },
  'pointee-const': { declaration: 'const int *p', label: 'const int *p：不可透過 p 改值', canWrite: false, canRebind: true },
  'pointer-const': { declaration: 'int *const p', label: 'int *const p：不可改指向', canWrite: true, canRebind: false },
  'both-const': { declaration: 'const int *const p', label: 'const int *const p：兩者皆不可改', canWrite: false, canRebind: false },
} as const
export const CONST_POINTER_OPERATIONS = {
  'write-through': '透過 *p 寫入 30', rebind: '改指向另一個變數', 'direct-write': '直接將 x 改為 30',
} as const
export type ConstPointerTarget = 'x' | 'y'
export interface ConstPointerConfig { kind: keyof typeof CONST_POINTER_KINDS; operation: keyof typeof CONST_POINTER_OPERATIONS; target: ConstPointerTarget }
export const DEFAULT_CONST_POINTER_CONFIG: Readonly<ConstPointerConfig> = { kind: 'pointee-const', operation: 'rebind', target: 'x' }
export function validateConstPointerConfig(config: ConstPointerConfig = DEFAULT_CONST_POINTER_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.kind !== 'string' || !Object.hasOwn(CONST_POINTER_KINDS, config.kind)) issues.push('請選擇有效的指標宣告。')
  if (typeof config.operation !== 'string' || !Object.hasOwn(CONST_POINTER_OPERATIONS, config.operation)) issues.push('請選擇有效的操作。')
  if (config.target !== 'x' && config.target !== 'y') issues.push('初始指向必須是 x 或 y。')
  return issues
}
