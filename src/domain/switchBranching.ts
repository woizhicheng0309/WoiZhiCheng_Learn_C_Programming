import { type SwitchConfig, DEFAULT_SWITCH_CONFIG, validateSwitchConfig } from './switchBranchingConfig'

export { type SwitchConfig, DEFAULT_SWITCH_CONFIG, validateSwitchConfig } from './switchBranchingConfig'

export const SWITCH_LIMITS = { choice: { min: 0, max: 4 } } as const
export type SwitchCase = 'case-1' | 'case-2' | 'default'
export type SwitchPhase = 'enter-main' | 'initialize' | 'evaluate-switch' | 'select-case' | 'print-case' | 'break' | 'fall-through' | 'after-switch' | 'return-main' | 'done' | 'blocked'
export interface SwitchFrame {
  index: number
  phase: SwitchPhase
  activeLine: number
  activePart: string
  explanation: string
  memory: { choice: number | null; inScope: boolean }
  selectedCase: SwitchCase | null
  activeCase: SwitchCase | null
  output: readonly string[]
  afterSwitch: boolean
}

export function buildSwitchSource(config: SwitchConfig = DEFAULT_SWITCH_CONFIG) {
  const choice = Number.isInteger(config.choice) && config.choice >= 0 && config.choice <= 4 ? String(config.choice) : '0 /* invalid choice */'
  const stop = config.mode === 'with-break' ? '      break;' : '      /* no break */'
  const code = [
    '#include <stdio.h>', '', 'int main(void) {', `  int choice = ${choice};`,
    '  switch (choice) {', '    case 1:', '      printf("Tea\\n");', stop,
    '    case 2:', '      printf("Coffee\\n");', stop, '    default:',
    '      printf("Water\\n");', '  }', '  printf("Done\\n");', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}

export function simulateSwitchProgram(config: SwitchConfig = DEFAULT_SWITCH_CONFIG) {
  const stableConfig = { choice: config.choice, mode: config.mode }
  const source = buildSwitchSource(stableConfig)
  const validationIssues = validateSwitchConfig(stableConfig)
  const frames: SwitchFrame[] = []
  const output: string[] = []
  let choice: number | null = null
  let inScope = true
  let selectedCase: SwitchCase | null = null
  let activeCase: SwitchCase | null = null
  let afterSwitch = false
  const add = (phase: SwitchPhase, activeLine: number, explanation: string) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      memory: { choice, inScope }, selectedCase, activeCase, output: [...output], afterSwitch })
  }
  add('enter-main', 3, '進入 main，準備依 choice 選擇 switch 的入口。')
  if (validationIssues.length) {
    add('blocked', 4, `模擬器在初始化前安全停止：${validationIssues.join(' ')}`)
    return { config: stableConfig, source, frames, status: 'blocked' as const, message: validationIssues.join(' '), output: [...output], validationIssues }
  }
  choice = stableConfig.choice
  add('initialize', 4, `宣告 choice 並設為 ${choice}。`)
  add('evaluate-switch', 5, `switch 只求值一次，得到 ${choice}，再決定從哪個標籤進入。`)
  const cases: SwitchCase[] = ['case-1', 'case-2', 'default']
  const start = choice === 1 ? 0 : choice === 2 ? 1 : 2
  selectedCase = cases[start]
  activeCase = selectedCase
  add('select-case', [6, 9, 12][start], start === 2 ? '沒有 case 符合 choice，從 default 進入。' : `匹配 ${selectedCase === 'case-1' ? 'case 1' : 'case 2'}，從這裡開始執行。`)
  for (let index = start; index < cases.length; index += 1) {
    activeCase = cases[index]
    if (index > start) add('fall-through', [6, 9, 12][index], '前面沒有 break，接續執行下一個標籤後的敘述；不會重新比較 case 值。')
    const value = ['Tea', 'Coffee', 'Water'][index]
    output.push(value)
    add('print-case', [7, 10, 13][index], `printf 輸出 ${value}。`)
    if (stableConfig.mode === 'with-break' && index < 2) {
      add('break', [8, 11][index], 'break 離開最近的 switch，接著執行 switch 後的敘述。')
      break
    }
  }
  activeCase = null
  afterSwitch = true
  output.push('Done')
  add('after-switch', 15, '已離開 switch，printf 輸出 Done；choice 仍在 main 的作用域內。')
  add('return-main', 16, 'return 0 表示 main 正常結束。')
  inScope = false
  add('done', 17, 'main 結束，choice 離開作用域。')
  return { config: stableConfig, source, frames, status: 'completed' as const, message: `輸出依序為 ${output.join('、')}。`, output: [...output], validationIssues }
}
