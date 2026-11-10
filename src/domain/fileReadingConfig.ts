export const FILE_READING_DATASETS = {
  short: { label: '兩行，都有換行', text: 'Hi\nC\n' },
  long: { label: '長行，結尾沒有換行', text: 'ABCDEF\nX' },
  blank: { label: '包含空白行，末尾未換行', text: 'A\n\nB' },
  empty: { label: '空檔案', text: '' },
} as const
export const FILE_READING_OUTCOMES = {
  success: { label: '全部成功' },
  'open-failure': { label: '開啟失敗' },
  'read-failure': { label: '第一次讀取失敗' },
  'close-failure': { label: '關閉時回報錯誤' },
} as const
export interface FileReadingConfig {
  dataset: keyof typeof FILE_READING_DATASETS
  outcome: keyof typeof FILE_READING_OUTCOMES
  bufferSize: number
}
export const DEFAULT_FILE_READING_CONFIG: Readonly<FileReadingConfig> = { dataset: 'short', outcome: 'success', bufferSize: 6 }
export function validateFileReadingConfig(config: FileReadingConfig = DEFAULT_FILE_READING_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(FILE_READING_DATASETS, config.dataset)) issues.push('請選擇有效的文字資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(FILE_READING_OUTCOMES, config.outcome)) issues.push('請選擇有效的 I/O 情境。')
  if (!Number.isSafeInteger(config.bufferSize) || config.bufferSize < 2 || config.bufferSize > 8) issues.push('緩衝區大小必須是 2 到 8 的整數。')
  return issues
}
