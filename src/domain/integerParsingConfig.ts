export interface IntegerParsingConfig { text: string; longBits: 32 | 64; allowTrailingSpace: boolean }
export const DEFAULT_INTEGER_PARSING_CONFIG: Readonly<IntegerParsingConfig> = { text: '42abc', longBits: 32, allowTrailingSpace: false }
export function validateIntegerParsingConfig(config: IntegerParsingConfig = DEFAULT_INTEGER_PARSING_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.text !== 'string' || config.text.length > 40 || !Array.from(config.text).every(character => {
    const code = character.charCodeAt(0)
    return (code >= 9 && code <= 13) || (code >= 32 && code <= 126)
  })) issues.push('輸入限 40 個 ASCII 字元，可包含空白、Tab 與換行，不包含內嵌空字元。')
  if (config.longBits !== 32 && config.longBits !== 64) issues.push('請選擇 32 或 64 位元 long 模型。')
  if (typeof config.allowTrailingSpace !== 'boolean') issues.push('請選擇是否接受尾端空白。')
  return issues
}
