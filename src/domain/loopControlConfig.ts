export type LoopControlMode = 'break' | 'continue'

export interface LoopControlConfig {
  mode: LoopControlMode
  end: number
  trigger: number
}

export const DEFAULT_LOOP_CONTROL_CONFIG: Readonly<LoopControlConfig> = {
  mode: 'continue',
  end: 5,
  trigger: 3,
}

export const LOOP_CONTROL_LIMITS = {
  end: { min: 1, max: 8 },
  trigger: { min: 1, max: 8 },
} as const

export interface LoopControlValidationIssue {
  field: keyof LoopControlConfig
  message: string
}

export function validInteger(value: number, field: 'end' | 'trigger'): boolean {
  return Number.isFinite(value) && Number.isInteger(value)
    && value >= LOOP_CONTROL_LIMITS[field].min
    && value <= LOOP_CONTROL_LIMITS[field].max
}

export function validateLoopControlConfig(
  config: LoopControlConfig = DEFAULT_LOOP_CONTROL_CONFIG,
): readonly LoopControlValidationIssue[] {
  const issues: LoopControlValidationIssue[] = []
  if (config.mode !== 'break' && config.mode !== 'continue') {
    issues.push({ field: 'mode', message: '請選擇 break 或 continue。' })
  }
  for (const field of ['end', 'trigger'] as const) {
    if (!validInteger(config[field], field)) {
      issues.push({
        field,
        message: `${field} 必須是 ${LOOP_CONTROL_LIMITS[field].min} 到 ${LOOP_CONTROL_LIMITS[field].max} 的整數。`,
      })
    }
  }
  return issues
}
