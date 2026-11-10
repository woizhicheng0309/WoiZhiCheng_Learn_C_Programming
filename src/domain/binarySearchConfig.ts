export interface BinarySearchConfig { target: number; count: number }
export const DEFAULT_BINARY_SEARCH_CONFIG: Readonly<BinarySearchConfig> = { target: 15, count: 7 }
export const BINARY_SEARCH_LIMITS = { target: { min: -5, max: 25 }, count: { min: 0, max: 7 } } as const
export function validateBinarySearchConfig(config: BinarySearchConfig = DEFAULT_BINARY_SEARCH_CONFIG): readonly string[] {
  const issues: string[] = []
  for (const field of ['target', 'count'] as const) {
    const limit = BINARY_SEARCH_LIMITS[field]
    if (!Number.isInteger(config[field]) || config[field] < limit.min || config[field] > limit.max) issues.push(`${field} 必須是 ${limit.min} 到 ${limit.max} 的整數。`)
  }
  return issues
}
