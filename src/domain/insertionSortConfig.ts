export const INSERTION_SAMPLES = {
  mixed: [4, 3, 1, 5, 2], sorted: [1, 2, 3, 4, 5], reverse: [5, 4, 3, 2, 1], duplicates: [3, 1, 3, 2, 1],
} as const
export interface InsertionSortConfig { sample: keyof typeof INSERTION_SAMPLES; order: 'ascending' | 'descending' }
export const DEFAULT_INSERTION_SORT_CONFIG: Readonly<InsertionSortConfig> = { sample: 'mixed', order: 'ascending' }
export function validateInsertionSortConfig(config: InsertionSortConfig = DEFAULT_INSERTION_SORT_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Object.hasOwn(INSERTION_SAMPLES, config.sample)) issues.push('請選擇有效的陣列範例。')
  if (config.order !== 'ascending' && config.order !== 'descending') issues.push('請選擇升冪或降冪。')
  return issues
}
