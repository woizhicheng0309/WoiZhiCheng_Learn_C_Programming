export interface SearchConfig { target: number; mode: 'first' | 'last' }
export const DEFAULT_SEARCH_CONFIG: Readonly<SearchConfig> = { target: 7, mode: 'first' }
export function validateSearchConfig(config: SearchConfig = DEFAULT_SEARCH_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Number.isInteger(config.target) || config.target < -5 || config.target > 15) issues.push('target 必須是 -5 到 15 的整數。')
  if (config.mode !== 'first' && config.mode !== 'last') issues.push('請選擇第一筆或最後一筆。')
  return issues
}
