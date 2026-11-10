export type TraversalMode = 'index' | 'pointer'

export interface TraversalConfig {
  count: number
  mode: TraversalMode
}

export const TRAVERSAL_LIMITS = { min: 0, max: 6 } as const
export const DEFAULT_TRAVERSAL_CONFIG: Readonly<TraversalConfig> = {
  count: 5,
  mode: 'pointer',
}

export interface TraversalValidationIssue {
  field: keyof TraversalConfig
  message: string
}

export function validateTraversalConfig(
  config: TraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): readonly TraversalValidationIssue[] {
  const issues: TraversalValidationIssue[] = []
  if (!Number.isFinite(config.count) || !Number.isInteger(config.count)) {
    issues.push({ field: 'count', message: '走訪次數必須是有限整數。' })
  } else if (config.count < TRAVERSAL_LIMITS.min || config.count > TRAVERSAL_LIMITS.max) {
    issues.push({ field: 'count', message: `這個練習的走訪次數必須介於 ${TRAVERSAL_LIMITS.min} 到 ${TRAVERSAL_LIMITS.max}。` })
  }
  if (config.mode !== 'index' && config.mode !== 'pointer') {
    issues.push({ field: 'mode', message: '請選擇索引或指標走訪。' })
  }
  return issues
}
