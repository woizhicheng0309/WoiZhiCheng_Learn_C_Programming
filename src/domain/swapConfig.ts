export type SwapMode = 'value' | 'pointer'

export interface SwapConfig {
  x: number
  y: number
  mode: SwapMode
}

export const SWAP_LIMITS = { min: -20, max: 100 } as const
export const DEFAULT_SWAP_CONFIG: Readonly<SwapConfig> = {
  x: 5,
  y: 9,
  mode: 'value',
}

export interface SwapValidationIssue {
  field: keyof SwapConfig
  message: string
}

export function validateSwapConfig(
  config: SwapConfig = DEFAULT_SWAP_CONFIG,
): readonly SwapValidationIssue[] {
  const issues: SwapValidationIssue[] = []
  for (const field of ['x', 'y'] as const) {
    const value = config[field]
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      issues.push({ field, message: `${field} 必須是有限整數。` })
    } else if (value < SWAP_LIMITS.min || value > SWAP_LIMITS.max) {
      issues.push({
        field,
        message: `這個練習的 ${field} 必須介於 ${SWAP_LIMITS.min} 到 ${SWAP_LIMITS.max}。`,
      })
    }
  }
  if (config.mode !== 'value' && config.mode !== 'pointer') {
    issues.push({ field: 'mode', message: '請選擇複製整數值或複製位址的交換方式。' })
  }
  return issues
}
