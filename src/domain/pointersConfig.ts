export type PointerTarget = 'x' | 'y' | 'null'

export interface PointerConfig {
  x: number
  y: number
  newValue: number
  target: PointerTarget
}

export const POINTER_LIMITS = { min: -20, max: 100 } as const

export const DEFAULT_POINTER_CONFIG: Readonly<PointerConfig> = {
  x: 5,
  y: 9,
  newValue: 12,
  target: 'x',
}

export interface PointerValidationIssue {
  field: keyof PointerConfig
  message: string
}

export function validatePointerConfig(
  config: PointerConfig = DEFAULT_POINTER_CONFIG,
): readonly PointerValidationIssue[] {
  const issues: PointerValidationIssue[] = []
  for (const field of ['x', 'y', 'newValue'] as const) {
    const value = config[field]
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      issues.push({ field, message: `${field} 必須是有限整數。` })
    } else if (value < POINTER_LIMITS.min || value > POINTER_LIMITS.max) {
      issues.push({
        field,
        message: `這個練習的 ${field} 必須介於 ${POINTER_LIMITS.min} 到 ${POINTER_LIMITS.max}。`,
      })
    }
  }
  if (config.target !== 'x' && config.target !== 'y' && config.target !== 'null') {
    issues.push({ field: 'target', message: '指標只能指向 x、y，或設為 NULL。' })
  }
  return issues
}
