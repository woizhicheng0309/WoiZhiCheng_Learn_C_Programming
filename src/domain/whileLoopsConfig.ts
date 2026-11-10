import { COMPARATORS, type Comparator } from './types'

export type WhileMode = 'while' | 'do-while'

export interface WhileConfig {
  mode: WhileMode
  start: number
  end: number
  comparator: Comparator
  step: number
}

export const DEFAULT_WHILE_CONFIG: Readonly<WhileConfig> = {
  mode: 'while', start: 0, end: 3, comparator: '<', step: 1,
}

export const WHILE_LIMITS = {
  start: { min: -20, max: 20 },
  end: { min: -20, max: 20 },
  step: { min: -5, max: 5 },
  maxIterations: 100,
} as const

export interface WhileValidationIssue {
  field: keyof WhileConfig
  message: string
}

export function validateWhileConfig(
  config: WhileConfig = DEFAULT_WHILE_CONFIG,
): readonly WhileValidationIssue[] {
  const issues: WhileValidationIssue[] = []
  for (const field of ['start', 'end', 'step'] as const) {
    const value = config[field]
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      issues.push({ field, message: `${field} 必須是有限整數。` })
    } else if (value < WHILE_LIMITS[field].min || value > WHILE_LIMITS[field].max) {
      issues.push({ field, message: `這個練習的 ${field} 必須介於 ${WHILE_LIMITS[field].min} 到 ${WHILE_LIMITS[field].max}。` })
    }
  }
  if (config.mode !== 'while' && config.mode !== 'do-while') {
    issues.push({ field: 'mode', message: '請選擇 while 或 do-while。' })
  }
  if (!COMPARATORS.includes(config.comparator)) {
    issues.push({ field: 'comparator', message: '比較運算子只能選擇 <、<=、> 或 >=。' })
  }
  return issues
}
