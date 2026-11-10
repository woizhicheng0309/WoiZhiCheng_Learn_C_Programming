export type StringSample = 'word' | 'digit-zero' | 'embedded-nul'
export type StringStop = 'nul' | 'digit-zero'

export interface StringPointerConfig {
  sample: StringSample
  stopAt: StringStop
}

export interface StringPointerSample {
  readonly id: StringSample
  readonly label: string
  /** Escaped C literal content, without the surrounding double quotes. */
  readonly literal: string
  /** Stored chars, including the implicit final NUL; NUL is actual U+0000. */
  readonly characters: readonly string[]
}

export const STRING_POINTER_SAMPLES: readonly StringPointerSample[] = Object.freeze([
  Object.freeze({ id: 'word', label: 'CODE：一般字串', literal: 'CODE', characters: Object.freeze(['C', 'O', 'D', 'E', '\0']) }),
  Object.freeze({ id: 'digit-zero', label: 'C0DE：包含數字字元 0', literal: 'C0DE', characters: Object.freeze(['C', '0', 'D', 'E', '\0']) }),
  Object.freeze({ id: 'embedded-nul', label: 'CO\\0DE：中途遇到空字元', literal: 'CO\\0DE', characters: Object.freeze(['C', 'O', '\0', 'D', 'E', '\0']) }),
])

export const DEFAULT_STRING_POINTER_CONFIG: Readonly<StringPointerConfig> = {
  sample: 'word',
  stopAt: 'nul',
}

export interface StringPointerValidationIssue {
  field: keyof StringPointerConfig
  message: string
}

export function getStringPointerSample(sample: StringSample): StringPointerSample | undefined {
  return STRING_POINTER_SAMPLES.find((candidate) => candidate.id === sample)
}

export function validateStringPointerConfig(
  config: StringPointerConfig = DEFAULT_STRING_POINTER_CONFIG,
): readonly StringPointerValidationIssue[] {
  const issues: StringPointerValidationIssue[] = []
  if (!getStringPointerSample(config.sample)) {
    issues.push({ field: 'sample', message: '請選擇 CODE、C0DE 或 CO\\0DE 字串範例。' })
  }
  if (config.stopAt !== 'nul' && config.stopAt !== 'digit-zero') {
    issues.push({ field: 'stopAt', message: "停止條件只能選擇空字元 '\\0' 或數字字元 '0'。" })
  }
  return issues
}
