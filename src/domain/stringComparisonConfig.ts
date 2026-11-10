export const STRING_COMPARISON_SAMPLES = {
  different: { label: 'CAT 與 CAR：後段不同', left: 'CAT', right: 'CAR' },
  prefix: { label: 'CAR 與 CART：前綴', left: 'CAR', right: 'CART' },
  equal: { label: 'CODE 與 CODE：相等', left: 'CODE', right: 'CODE' },
  empty: { label: '空字串與 C', left: '', right: 'C' },
  'embedded-nul': { label: 'CO\\0Z 與 CO\\0A：結尾後的資料', left: 'CO\\0Z', right: 'CO\\0A' },
  'first-character': { label: 'Z 與 AAAA：長度不是依據', left: 'Z', right: 'AAAA' },
  case: { label: 'apple 與 Banana：ASCII 大小寫', left: 'apple', right: 'Banana' },
} as const
export interface StringComparisonConfig { sample: keyof typeof STRING_COMPARISON_SAMPLES; reversed: boolean }
export const DEFAULT_STRING_COMPARISON_CONFIG: Readonly<StringComparisonConfig> = { sample: 'different', reversed: false }
export function validateStringComparisonConfig(config: StringComparisonConfig = DEFAULT_STRING_COMPARISON_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.sample !== 'string' || !Object.hasOwn(STRING_COMPARISON_SAMPLES, config.sample)) issues.push('請選擇有效的字串比較範例。')
  if (typeof config.reversed !== 'boolean') issues.push('請選擇是否交換左右字串。')
  return issues
}
