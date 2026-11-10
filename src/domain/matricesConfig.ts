export const MATRIX_ROWS = 2
export const MATRIX_COLUMNS = 3
export interface MatrixConfig {
  mode: 'row-first' | 'column-first'
  targetRow: number
  targetColumn: number
}
export const DEFAULT_MATRIX_CONFIG: Readonly<MatrixConfig> = { mode: 'row-first', targetRow: 1, targetColumn: 2 }
export function validateMatrixConfig(config: MatrixConfig = DEFAULT_MATRIX_CONFIG): readonly string[] {
  const issues: string[] = []
  if (config.mode !== 'row-first' && config.mode !== 'column-first') issues.push('請選擇逐列或逐欄走訪。')
  if (!Number.isInteger(config.targetRow) || config.targetRow < 0 || config.targetRow >= MATRIX_ROWS) issues.push('列索引必須是 0 到 1 的整數。')
  if (!Number.isInteger(config.targetColumn) || config.targetColumn < 0 || config.targetColumn >= MATRIX_COLUMNS) issues.push('欄索引必須是 0 到 2 的整數。')
  return issues
}
