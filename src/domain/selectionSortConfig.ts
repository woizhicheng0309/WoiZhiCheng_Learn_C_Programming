export const SORT_SAMPLES = {
  mixed: [4, 1, 5, 2, 3], sorted: [1, 2, 3, 4, 5], reverse: [5, 4, 3, 2, 1], duplicates: [3, 1, 3, 2, 1],
} as const
export interface SelectionSortConfig { sample: keyof typeof SORT_SAMPLES; order: 'ascending' | 'descending' }
export const DEFAULT_SELECTION_SORT_CONFIG: Readonly<SelectionSortConfig> = { sample: 'mixed', order: 'ascending' }
export function validateSelectionSortConfig(config: SelectionSortConfig = DEFAULT_SELECTION_SORT_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Object.hasOwn(SORT_SAMPLES, config.sample)) issues.push('請選擇有效的陣列範例。')
  if (config.order !== 'ascending' && config.order !== 'descending') issues.push('請選擇升冪或降冪。')
  return issues
}
