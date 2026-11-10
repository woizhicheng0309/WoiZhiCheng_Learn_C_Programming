export const RECORD_FILE_DATASETS = {
  mixed: { label: '混合格式錯誤與合法分數', text: '10,80\n11;95\n0,75\n12,101\n13,60\n14,88,1\n15,100' },
  boundary: { label: '長度邊界與過長行', text: '000000001,0060\n0000000002,0099\n9999,0\n3,100' },
  empty: { label: '空檔案', text: '' },
  malformed: { label: '空欄、分數尾端與合法零分', text: '\n1,\n2,6x\n3, 0\n4,60 \n5,60' },
} as const

export const RECORD_FILE_OUTCOMES = {
  success: 'I/O 正常',
  'input-open-failure': '輸入檔開啟失敗',
  'output-open-failure': '輸出檔開啟失敗',
  'read-failure': '第一次讀取失敗',
  'write-failure': '第一次符合門檻的寫入失敗',
  'close-failure': '輸出檔關閉回報錯誤',
} as const

export interface RecordFileConfig {
  dataset: keyof typeof RECORD_FILE_DATASETS
  outcome: keyof typeof RECORD_FILE_OUTCOMES
  minimumScore: number
}

export const DEFAULT_RECORD_FILE_CONFIG: Readonly<RecordFileConfig> = { dataset: 'mixed', outcome: 'success', minimumScore: 70 }

export function validateRecordFileConfig(config: RecordFileConfig): string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(RECORD_FILE_DATASETS, config.dataset)) issues.push('請選擇有效的輸入資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(RECORD_FILE_OUTCOMES, config.outcome)) issues.push('請選擇有效的 I/O 情境。')
  if (!Number.isInteger(config.minimumScore) || config.minimumScore < 0 || config.minimumScore > 100) issues.push('門檻須為 0 到 100 的整數。')
  return issues
}
