export const GRADEBOOK_QUERY_IDS = [101, 205, 330, 444, 509, 9999] as const
export const GRADEBOOK_DATASETS = {
  mixed: { label: '混合錯誤、重複與滿表', text: '101,75\n205,90\noops\n330,0\n444,88\n101,99\n509,100' },
  sparse: { label: '未填滿，包含長度邊界', text: '205,100\n\n000000330,0000\n0000000331,0090\n444,88' },
  empty: { label: '空檔案', text: '' },
} as const
export const GRADEBOOK_OUTCOMES = {
  success: 'I/O 正常', 'input-open-failure': '輸入檔開啟失敗', 'input-read-failure': '第一次讀取失敗',
  'report-open-failure': '報告檔開啟失敗', 'report-write-failure': '找到紀錄時寫入失敗', 'report-close-failure': '報告檔關閉回報錯誤',
} as const
export interface GradebookConfig {
  dataset: keyof typeof GRADEBOOK_DATASETS
  outcome: keyof typeof GRADEBOOK_OUTCOMES
  queryId: number
  updateDuplicate: boolean
}
export const DEFAULT_GRADEBOOK_CONFIG: Readonly<GradebookConfig> = {
  dataset: 'mixed', outcome: 'success', queryId: 205, updateDuplicate: false,
}
export function validateGradebookConfig(config: GradebookConfig): string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(GRADEBOOK_DATASETS, config.dataset)) issues.push('請選擇輸入資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(GRADEBOOK_OUTCOMES, config.outcome)) issues.push('請選擇 I/O 情境。')
  if (!GRADEBOOK_QUERY_IDS.some(id => id === config.queryId)) issues.push('請從清單選擇查詢編號。')
  if (typeof config.updateDuplicate !== 'boolean') issues.push('請選擇重複資料的處理方式。')
  return issues
}
