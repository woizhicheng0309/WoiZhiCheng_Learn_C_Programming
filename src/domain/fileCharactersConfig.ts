import { FILE_READING_OUTCOMES } from './fileReadingConfig'

export const FILE_CHARACTER_DATASETS = {
  text: { label: 'A、0、換行、B、9', bytes: [65, 48, 10, 66, 57] },
  nul: { label: 'A、0x00、B、9', bytes: [65, 0, 66, 57] },
  high: { label: '0xFF、0、換行、9', bytes: [255, 48, 10, 57] },
  digits: { label: '0、1、9', bytes: [48, 49, 57] },
  empty: { label: '空檔案', bytes: [] },
} as const
export interface FileCharacterConfig {
  dataset: keyof typeof FILE_CHARACTER_DATASETS
  outcome: keyof typeof FILE_READING_OUTCOMES
  stopAtNewline: boolean
}
export const DEFAULT_FILE_CHARACTER_CONFIG: Readonly<FileCharacterConfig> = { dataset: 'text', outcome: 'success', stopAtNewline: false }
export function validateFileCharacterConfig(config: FileCharacterConfig = DEFAULT_FILE_CHARACTER_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(FILE_CHARACTER_DATASETS, config.dataset)) issues.push('請選擇有效的位元組資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(FILE_READING_OUTCOMES, config.outcome)) issues.push('請選擇有效的 I/O 情境。')
  if (typeof config.stopAtNewline !== 'boolean') issues.push('請選擇是否在換行時提早停止。')
  return issues
}
