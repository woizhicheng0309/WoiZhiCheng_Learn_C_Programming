export const CONDITIONAL_LOGICAL_OPERATORS = ['&&', '||'] as const

export type ConditionalLogicalOperator =
  (typeof CONDITIONAL_LOGICAL_OPERATORS)[number]

export interface ConditionalConfig {
  score: number
  attendance: number
  logicalOperator: ConditionalLogicalOperator
}

export const CONDITIONAL_LIMITS = {
  score: { min: 0, max: 100 },
  attendance: { min: 0, max: 100 },
  scoreThreshold: 60,
  attendanceThreshold: 70,
} as const

export const DEFAULT_CONDITIONAL_CONFIG: Readonly<ConditionalConfig> = {
  score: 72,
  attendance: 65,
  logicalOperator: '&&',
}
