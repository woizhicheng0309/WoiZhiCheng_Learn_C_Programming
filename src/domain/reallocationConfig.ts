export const REALLOCATION_DATASETS = {
  mixed: { label: '原始資料：4、7、9', values: [4, 7, 9] },
  zeros: { label: '原始資料：0、0、0', values: [0, 0, 0] },
  descending: { label: '原始資料：9、7、4', values: [9, 7, 4] },
} as const
export const REALLOCATION_OUTCOMES = {
  moved: { label: '成功：位置改變' },
  'in-place': { label: '成功：位置相同' },
  failure: { label: '失敗：保留原區塊' },
} as const
export interface ReallocationConfig {
  dataset: keyof typeof REALLOCATION_DATASETS
  outcome: keyof typeof REALLOCATION_OUTCOMES
  requested: number
  fill: number
}
export const DEFAULT_REALLOCATION_CONFIG: Readonly<ReallocationConfig> = { dataset: 'mixed', outcome: 'moved', requested: 5, fill: 6 }
export function validateReallocationConfig(config: ReallocationConfig = DEFAULT_REALLOCATION_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(REALLOCATION_DATASETS, config.dataset)) issues.push('請選擇有效的原始資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(REALLOCATION_OUTCOMES, config.outcome)) issues.push('請選擇有效的調整結果。')
  if (!Number.isSafeInteger(config.requested) || config.requested < 1 || config.requested > 5) issues.push('目標容量必須是 1 到 5 的整數。')
  if (!Number.isSafeInteger(config.fill) || config.fill < 0 || config.fill > 9) issues.push('新增元素值必須是 0 到 9 的整數。')
  return issues
}
