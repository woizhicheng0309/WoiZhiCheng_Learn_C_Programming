export const ARRAY_PARAMETER_SAMPLES = {
  positive: [4, 7, 2, 9, 5], mixed: [-4, 2, -1, 3, -2], zeros: [0, 0, 0, 0, 0],
} as const
export interface ArrayParameterConfig { sample: keyof typeof ARRAY_PARAMETER_SAMPLES; count: number; mode: 'read-only' | 'modify' }
export const DEFAULT_ARRAY_PARAMETER_CONFIG: Readonly<ArrayParameterConfig> = { sample: 'positive', count: 3, mode: 'read-only' }
export function validateArrayParameterConfig(config: ArrayParameterConfig = DEFAULT_ARRAY_PARAMETER_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.sample !== 'string' || !Object.hasOwn(ARRAY_PARAMETER_SAMPLES, config.sample)) issues.push('請選擇有效的陣列範例。')
  if (!Number.isInteger(config.count) || config.count < 0 || config.count > 5) issues.push('元素數量必須是 0 到 5 的整數。')
  if (config.mode !== 'read-only' && config.mode !== 'modify') issues.push('請選擇唯讀加總或原地修改。')
  return issues
}
