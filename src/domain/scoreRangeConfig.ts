export const SCORE_RANGE_SAMPLES = {
  mixed: {
    label: '三筆同分，原始順序交錯',
    rows: [{ id: 11, score: 80 }, { id: 12, score: 60 }, { id: 13, score: 80 }, { id: 14, score: 100 }, { id: 15, score: 80 }, { id: 16, score: 0 }],
  },
  equal: {
    label: '六筆都是 75 分',
    rows: [{ id: 21, score: 75 }, { id: 22, score: 75 }, { id: 23, score: 75 }, { id: 24, score: 75 }, { id: 25, score: 75 }, { id: 26, score: 75 }],
  },
  ordered: {
    label: '已排序，包含兩筆 100 分',
    rows: [{ id: 31, score: 0 }, { id: 32, score: 25 }, { id: 33, score: 50 }, { id: 34, score: 75 }, { id: 35, score: 100 }, { id: 36, score: 100 }],
  },
} as const

export interface ScoreRangeConfig {
  sample: keyof typeof SCORE_RANGE_SAMPLES
  count: number
  low: number
  high: number
}
export const DEFAULT_SCORE_RANGE_CONFIG: Readonly<ScoreRangeConfig> = { sample: 'mixed', count: 6, low: 60, high: 80 }

export function validateScoreRangeConfig(config: ScoreRangeConfig): string[] {
  const issues: string[] = []
  if (typeof config.sample !== 'string' || !Object.hasOwn(SCORE_RANGE_SAMPLES, config.sample)) issues.push('請選擇成績資料。')
  if (!Number.isInteger(config.count) || config.count < 0 || config.count > 6) issues.push('資料筆數須為 0 到 6 的整數。')
  if (![config.low, config.high].every(value => Number.isInteger(value) && value >= 0 && value <= 100) || config.low > config.high) {
    issues.push('分數上下界須為 0 到 100 的整數，且下界不超過上界。')
  }
  return issues
}
