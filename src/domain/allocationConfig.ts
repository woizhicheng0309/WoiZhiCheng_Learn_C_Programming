export const ALLOCATORS = {
  malloc: { label: 'malloc：內容未初始化' },
  calloc: { label: 'calloc：整數元素初始為 0' },
} as const
export interface AllocationConfig {
  allocator: keyof typeof ALLOCATORS
  outcome: 'success' | 'failure'
  count: number
  start: number
}
export const DEFAULT_ALLOCATION_CONFIG: Readonly<AllocationConfig> = { allocator: 'malloc', outcome: 'success', count: 3, start: 5 }

export function validateAllocationConfig(config: AllocationConfig = DEFAULT_ALLOCATION_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.allocator !== 'string' || !Object.hasOwn(ALLOCATORS, config.allocator)) issues.push('請選擇 malloc 或 calloc。')
  if (config.outcome !== 'success' && config.outcome !== 'failure') issues.push('請選擇有效的配置結果情境。')
  if (!Number.isSafeInteger(config.count) || config.count < 1 || config.count > 5) issues.push('元素數量必須是 1 到 5 的整數。')
  if (!Number.isSafeInteger(config.start) || config.start < 0 || config.start > 20) issues.push('起始值必須是 0 到 20 的整數。')
  return issues
}
