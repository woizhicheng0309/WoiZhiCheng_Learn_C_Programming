export interface SwitchConfig {
  choice: number
  mode: 'with-break' | 'fall-through'
}

export const DEFAULT_SWITCH_CONFIG: Readonly<SwitchConfig> = { choice: 2, mode: 'with-break' }

export function validateSwitchConfig(config: SwitchConfig = DEFAULT_SWITCH_CONFIG): readonly string[] {
  const issues: string[] = []
  if (!Number.isInteger(config.choice) || config.choice < 0 || config.choice > 4) issues.push('choice 必須是 0 到 4 的整數。')
  if (config.mode !== 'with-break' && config.mode !== 'fall-through') issues.push('請選擇保留 break 或省略 break。')
  return issues
}
