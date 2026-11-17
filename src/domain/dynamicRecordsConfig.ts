export const DYNAMIC_RECORD_SAMPLES = {
  mixed: { label: '交錯分數', rows: [{ id: 101, score: 75 }, { id: 205, score: 90 }, { id: 330, score: 0 }, { id: 444, score: 88 }, { id: 509, score: 100 }, { id: 610, score: 60 }] },
  equal: { label: '相同分數，不同編號', rows: [{ id: 11, score: 80 }, { id: 12, score: 80 }, { id: 13, score: 80 }, { id: 14, score: 80 }, { id: 15, score: 80 }, { id: 16, score: 80 }] },
} as const
export const DYNAMIC_RECORD_GROWTH = { double: '容量加倍（起始 2 格）', exact: '逐筆擴充（選做）' } as const
export interface DynamicRecordsConfig {
  sample: keyof typeof DYNAMIC_RECORD_SAMPLES
  count: number
  growth: keyof typeof DYNAMIC_RECORD_GROWTH
  failAt: number
}
export const DEFAULT_DYNAMIC_RECORDS_CONFIG: Readonly<DynamicRecordsConfig> = { sample: 'mixed', count: 6, growth: 'double', failAt: 0 }
export function validateDynamicRecordsConfig(config: DynamicRecordsConfig): string[] {
  const issues: string[] = []
  if (typeof config.sample !== 'string' || !Object.hasOwn(DYNAMIC_RECORD_SAMPLES, config.sample)) issues.push('請選擇紀錄資料。')
  if (typeof config.growth !== 'string' || !Object.hasOwn(DYNAMIC_RECORD_GROWTH, config.growth)) issues.push('請選擇擴充策略。')
  if (!Number.isInteger(config.count) || config.count < 0 || config.count > 6) issues.push('紀錄筆數須為 0 到 6 的整數。')
  if (!Number.isInteger(config.failAt) || config.failAt < 0 || config.failAt > 3) issues.push('失敗次數須為 0 到 3 的整數，0 表示不注入失敗。')
  return issues
}
