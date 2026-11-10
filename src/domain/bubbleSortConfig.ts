export const BUBBLE_SORT_SAMPLES = {
  mixed: [4, 1, 5, 2, 3], sorted: [1, 2, 3, 4, 5], reverse: [5, 4, 3, 2, 1], duplicates: [3, 1, 3, 2, 1],
} as const
export interface BubbleSortConfig { sample: keyof typeof BUBBLE_SORT_SAMPLES; order: 'ascending' | 'descending'; earlyExit: boolean }
export const DEFAULT_BUBBLE_SORT_CONFIG: Readonly<BubbleSortConfig> = { sample: 'mixed', order: 'ascending', earlyExit: true }
export function validateBubbleSortConfig(config: BubbleSortConfig = DEFAULT_BUBBLE_SORT_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Object.hasOwn(BUBBLE_SORT_SAMPLES, config.sample)) issues.push('請選擇有效的陣列範例。')
  if (config.order !== 'ascending' && config.order !== 'descending') issues.push('請選擇升冪或降冪。')
  if (typeof config.earlyExit !== 'boolean') issues.push('請選擇是否提前結束。')
  return issues
}
