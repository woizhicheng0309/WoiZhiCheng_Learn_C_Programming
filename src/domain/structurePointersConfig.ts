export const STRUCTURE_POINTER_SYNTAXES = {
  arrow: { label: '箭頭運算子：p->score' },
  dereference: { label: '解參照後取成員：(*p).score' },
} as const
export type StructurePointerObject = 'first' | 'second'
export type StructurePointerTarget = StructurePointerObject | 'null'
export interface StructurePointerConfig {
  syntax: keyof typeof STRUCTURE_POINTER_SYNTAXES
  initialTarget: StructurePointerObject
  target: StructurePointerTarget
  aliasScore: number
  pointedScore: number
}
export const DEFAULT_STRUCTURE_POINTER_CONFIG: Readonly<StructurePointerConfig> = {
  syntax: 'arrow', initialTarget: 'first', target: 'second', aliasScore: 95, pointedScore: 70,
}

export function validateStructurePointerConfig(config: StructurePointerConfig = DEFAULT_STRUCTURE_POINTER_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.syntax !== 'string' || !Object.hasOwn(STRUCTURE_POINTER_SYNTAXES, config.syntax)) issues.push('請選擇有效的成員存取寫法。')
  if (config.initialTarget !== 'first' && config.initialTarget !== 'second') issues.push('初始指向必須是 first 或 second。')
  if (config.target !== 'first' && config.target !== 'second' && config.target !== 'null') issues.push('新指向必須是 first、second 或 NULL。')
  if (!Number.isSafeInteger(config.aliasScore) || config.aliasScore < 0 || config.aliasScore > 100) issues.push('透過 q 寫入的分數必須是 0 到 100 的整數。')
  if (!Number.isSafeInteger(config.pointedScore) || config.pointedScore < 0 || config.pointedScore > 100) issues.push('透過 p 寫入的分數必須是 0 到 100 的整數。')
  return issues
}
