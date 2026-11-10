export const MEMORY_OWNERSHIP_STRATEGIES = {
  transfer: '轉交給 destination',
  retain: '由 source 保留',
} as const

export const MEMORY_OWNERSHIP_OUTCOMES = {
  success: '配置成功',
  failure: '配置失敗',
} as const

export interface MemoryOwnershipConfig {
  strategy: keyof typeof MEMORY_OWNERSHIP_STRATEGIES
  outcome: keyof typeof MEMORY_OWNERSHIP_OUTCOMES
  value: number
}

export const DEFAULT_MEMORY_OWNERSHIP_CONFIG: Readonly<MemoryOwnershipConfig> = {
  strategy: 'transfer', outcome: 'success', value: 42,
}

export function validateMemoryOwnershipConfig(config: MemoryOwnershipConfig): string[] {
  const issues: string[] = []
  if (config.strategy !== 'transfer' && config.strategy !== 'retain') issues.push('請選擇保留或轉交所有權。')
  if (config.outcome !== 'success' && config.outcome !== 'failure') issues.push('請選擇配置結果。')
  if (!Number.isInteger(config.value) || config.value < 0 || config.value > 100) issues.push('資料值須為 0 到 100 的整數。')
  return issues
}
