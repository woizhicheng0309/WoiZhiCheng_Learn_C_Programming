export const ARRAY_LENGTH = 5

export interface ArrayConfig {
  index: number
  newValue: number
}

export const ARRAY_LIMITS = {
  index: { min: 0, max: ARRAY_LENGTH - 1 },
  newValue: { min: -20, max: 100 },
} as const

export const DEFAULT_ARRAY_CONFIG: Readonly<ArrayConfig> = {
  index: 2,
  newValue: 10,
}

export type ArrayBlockReason =
  | 'invalid-index-number'
  | 'index-integer-required'
  | 'index-out-of-bounds'
  | 'invalid-new-value-number'
  | 'new-value-integer-required'
  | 'new-value-out-of-range'

export interface ArrayValidationIssue {
  code: ArrayBlockReason
  field: keyof ArrayConfig
  message: string
}

export function validateArrayConfig(
  config: ArrayConfig = DEFAULT_ARRAY_CONFIG,
): readonly ArrayValidationIssue[] {
  const issues: ArrayValidationIssue[] = []

  if (!Number.isFinite(config.index)) {
    issues.push({
      code: 'invalid-index-number',
      field: 'index',
      message: '索引必須是有限整數。',
    })
  } else {
    if (!Number.isInteger(config.index)) {
      issues.push({
        code: 'index-integer-required',
        field: 'index',
        message: '陣列索引必須是整數。',
      })
    }

    if (
      config.index < ARRAY_LIMITS.index.min
      || config.index > ARRAY_LIMITS.index.max
    ) {
      issues.push({
        code: 'index-out-of-bounds',
        field: 'index',
        message: `scores 有 ${ARRAY_LENGTH} 格，合法索引只有 ${ARRAY_LIMITS.index.min} 到 ${ARRAY_LIMITS.index.max}。`,
      })
    }
  }

  if (!Number.isFinite(config.newValue)) {
    issues.push({
      code: 'invalid-new-value-number',
      field: 'newValue',
      message: '新分數必須是有限整數。',
    })
  } else {
    if (!Number.isInteger(config.newValue)) {
      issues.push({
        code: 'new-value-integer-required',
        field: 'newValue',
        message: 'int 陣列只能寫入整數。',
      })
    }

    if (
      config.newValue < ARRAY_LIMITS.newValue.min
      || config.newValue > ARRAY_LIMITS.newValue.max
    ) {
      issues.push({
        code: 'new-value-out-of-range',
        field: 'newValue',
        message: `這個練習的新值必須介於 ${ARRAY_LIMITS.newValue.min} 到 ${ARRAY_LIMITS.newValue.max}。`,
      })
    }
  }

  return issues
}
