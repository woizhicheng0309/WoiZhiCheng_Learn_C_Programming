export const STRING_COPY_SAMPLES = {
  word: { label: 'CODE：一般字串', literal: 'CODE', characters: ['C', 'O', 'D', 'E', '\0'] },
  'digit-zero': { label: 'C0DE：數字字元 0', literal: 'C0DE', characters: ['C', '0', 'D', 'E', '\0'] },
  'embedded-nul': { label: 'CO\\0DE：內嵌空字元', literal: 'CO\\0DE', characters: ['C', 'O', '\0', 'D', 'E', '\0'] },
  empty: { label: '空字串', literal: '', characters: ['\0'] },
} as const
export const STRING_COPY_CAPACITIES = [1, 3, 5, 8] as const
export interface StringCopyConfig { sample: keyof typeof STRING_COPY_SAMPLES; capacity: (typeof STRING_COPY_CAPACITIES)[number] }
export const DEFAULT_STRING_COPY_CONFIG: Readonly<StringCopyConfig> = { sample: 'word', capacity: 5 }
export function validateStringCopyConfig(config: StringCopyConfig = DEFAULT_STRING_COPY_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Object.hasOwn(STRING_COPY_SAMPLES, config.sample)) issues.push('請選擇有效的字串範例。')
  if (!STRING_COPY_CAPACITIES.includes(config.capacity)) issues.push('目的陣列容量必須是 1、3、5 或 8。')
  return issues
}
