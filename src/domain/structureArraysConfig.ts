export const STRUCTURE_ARRAY_ROSTERS = {
  mixed: { label: '不同分數：80、60、95', scores: [80, 60, 95] },
  boundary: { label: '門檻附近：59、60、61', scores: [59, 60, 61] },
  equal: { label: '相同分數：60、60、60', scores: [60, 60, 60] },
} as const
export interface StructureArrayConfig {
  roster: keyof typeof STRUCTURE_ARRAY_ROSTERS
  index: number
  score: number
  threshold: number
}
export const DEFAULT_STRUCTURE_ARRAY_CONFIG: Readonly<StructureArrayConfig> = {
  roster: 'mixed', index: 1, score: 70, threshold: 80,
}

export function validateStructureArrayConfig(config: StructureArrayConfig = DEFAULT_STRUCTURE_ARRAY_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.roster !== 'string' || !Object.hasOwn(STRUCTURE_ARRAY_ROSTERS, config.roster)) issues.push('請選擇有效的成績資料。')
  if (!Number.isSafeInteger(config.index) || config.index < 0 || config.index > 2) issues.push('索引必須是 0 到 2 的整數。')
  if (!Number.isSafeInteger(config.score) || config.score < 0 || config.score > 100) issues.push('更新分數必須是 0 到 100 的整數。')
  if (!Number.isSafeInteger(config.threshold) || config.threshold < 0 || config.threshold > 100) issues.push('門檻必須是 0 到 100 的整數。')
  return issues
}
