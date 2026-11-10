import { LOOP_LIMITS, type LoopConfig, type LoopValidationIssue } from './types'

export function validateLoopConfig(
  config: LoopConfig,
): readonly LoopValidationIssue[] {
  if (
    !Number.isFinite(config.start) ||
    !Number.isFinite(config.end) ||
    !Number.isFinite(config.step)
  ) {
    return [{ code: 'invalid-number', message: '所有參數都必須是有限數字。' }]
  }

  const issues: LoopValidationIssue[] = []

  if (config.start < LOOP_LIMITS.start.min || config.start > LOOP_LIMITS.start.max) {
    issues.push({
      code: 'start-out-of-range',
      message: `起始值必須介於 ${LOOP_LIMITS.start.min} 到 ${LOOP_LIMITS.start.max}。`,
    })
  }

  if (config.end < LOOP_LIMITS.end.min || config.end > LOOP_LIMITS.end.max) {
    issues.push({
      code: 'end-out-of-range',
      message: `終止值必須介於 ${LOOP_LIMITS.end.min} 到 ${LOOP_LIMITS.end.max}。`,
    })
  }

  if (config.step < LOOP_LIMITS.step.min || config.step > LOOP_LIMITS.step.max) {
    issues.push({
      code: 'step-out-of-range',
      message: `步進值必須介於 ${LOOP_LIMITS.step.min} 到 ${LOOP_LIMITS.step.max}。`,
    })
  }

  return issues
}
