export const SCORE_FILE_DATASETS = {
  mixed: { label: '合法值與三種無效資料', text: '80\nabc\n100\n-5\n70x\n0\n' },
  clean: { label: '全部合法，最後一行沒有換行', text: '60\n80\n100' },
  spaces: { label: '空白、空行與超過分數上界', text: ' 50 \n\n+75\t\n101\n' },
  zero: { label: '兩筆合法零分', text: '0\n0\n' },
  empty: { label: '空檔案', text: '' },
  blank: { label: '只有空白行', text: '\n\n' },
  long: { label: '過長的一行，後面還有合法資料', text: '0000000000080\n90\n' },
  boundary: { label: '剛好 11 字元的一行', text: '00000000080\n90\n' },
  overflow: { label: '超出 32 位元 long 範圍', text: '2147483648\n-2147483649\n42\n' },
} as const
export const SCORE_FILE_OUTCOMES = {
  success: { label: '全部成功' },
  'open-failure': { label: '開啟失敗' },
  'read-failure': { label: '讀取最多四個字元後失敗' },
  'close-failure': { label: '關閉時回報錯誤' },
} as const
export interface ScoreFileConfig { dataset: keyof typeof SCORE_FILE_DATASETS; outcome: keyof typeof SCORE_FILE_OUTCOMES; stopOnInvalid: boolean }
export const DEFAULT_SCORE_FILE_CONFIG: Readonly<ScoreFileConfig> = { dataset: 'mixed', outcome: 'success', stopOnInvalid: false }
export function validateScoreFileConfig(config: ScoreFileConfig = DEFAULT_SCORE_FILE_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(SCORE_FILE_DATASETS, config.dataset)) issues.push('請選擇有效的分數資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(SCORE_FILE_OUTCOMES, config.outcome)) issues.push('請選擇有效的 I/O 情境。')
  if (typeof config.stopOnInvalid !== 'boolean') issues.push('請選擇遇到無效紀錄時的處理方式。')
  return issues
}
