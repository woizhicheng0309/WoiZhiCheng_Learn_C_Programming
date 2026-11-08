export const CONST_POINTER_KINDS = {
  mutable: { declaration: 'int *p', label: 'int *p：兩者皆可改', canWrite: true, canRebind: true },
  'pointee-const': { declaration: 'const int *p', label: 'const int *p：不可透過 p 改值', canWrite: false, canRebind: true },
  'pointer-const': { declaration: 'int *const p', label: 'int *const p：不可改指向', canWrite: true, canRebind: false },
  'both-const': { declaration: 'const int *const p', label: 'const int *const p：兩者皆不可改', canWrite: false, canRebind: false },
} as const
export const CONST_POINTER_OPERATIONS = {
  'write-through': '透過 *p 寫入 30', rebind: '改指向另一個變數', 'direct-write': '直接將 x 改為 30',
} as const
export type ConstPointerTarget = 'x' | 'y'
export interface ConstPointerConfig { kind: keyof typeof CONST_POINTER_KINDS; operation: keyof typeof CONST_POINTER_OPERATIONS; target: ConstPointerTarget }
export const DEFAULT_CONST_POINTER_CONFIG: Readonly<ConstPointerConfig> = { kind: 'pointee-const', operation: 'rebind', target: 'x' }
export type ConstPointerPhase = 'check-program' | 'enter-main' | 'initialize-x' | 'initialize-y' | 'bind-pointer' | 'write-through' | 'rebind' | 'direct-write' | 'print' | 'return-main' | 'done' | 'blocked'
export interface ConstPointerFrame {
  index: number
  phase: ConstPointerPhase
  activeLine: number
  activePart: string
  explanation: string
  values: Readonly<Record<ConstPointerTarget, number | null>>
  target: ConstPointerTarget | null
  mainInScope: boolean
  activeTarget: ConstPointerTarget | 'p' | null
  printedValues: readonly number[] | null
  output: readonly string[]
}
export function validateConstPointerConfig(config: ConstPointerConfig = DEFAULT_CONST_POINTER_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.kind !== 'string' || !Object.hasOwn(CONST_POINTER_KINDS, config.kind)) issues.push('請選擇有效的指標宣告。')
  if (typeof config.operation !== 'string' || !Object.hasOwn(CONST_POINTER_OPERATIONS, config.operation)) issues.push('請選擇有效的操作。')
  if (config.target !== 'x' && config.target !== 'y') issues.push('初始指向必須是 x 或 y。')
  return issues
}
export function buildConstPointerSource(config: ConstPointerConfig = DEFAULT_CONST_POINTER_CONFIG) {
  const kind = typeof config.kind === 'string' && Object.hasOwn(CONST_POINTER_KINDS, config.kind) ? CONST_POINTER_KINDS[config.kind] : CONST_POINTER_KINDS['pointee-const']
  const target = config.target === 'y' ? 'y' : 'x'
  const statement = config.operation === 'write-through' ? '*p = 30;' : config.operation === 'direct-write' ? 'x = 30;' : `p = &${target === 'x' ? 'y' : 'x'};`
  const code = ['#include <stdio.h>', '', 'int main(void) {', '  int x = 10;', '  int y = 20;',
    `  ${kind.declaration} = &${target};`, `  ${statement}`, '  printf("x=%d, y=%d, *p=%d\\n", x, y, *p);', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateConstPointerProgram(config: ConstPointerConfig = DEFAULT_CONST_POINTER_CONFIG) {
  const stableConfig = { kind: config.kind, operation: config.operation, target: config.target }
  const source = buildConstPointerSource(stableConfig)
  const issues = validateConstPointerConfig(stableConfig)
  const frames: ConstPointerFrame[] = []
  const values: Record<ConstPointerTarget, number | null> = { x: null, y: null }
  let target: ConstPointerTarget | null = null
  let mainInScope = false
  let printedValues: number[] | null = null
  const output: string[] = []
  const add = (phase: ConstPointerPhase, activeLine: number, explanation: string, activeTarget: ConstPointerFrame['activeTarget'] = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      values: { ...values }, target, mainInScope, activeTarget, printedValues: printedValues ? [...printedValues] : null, output: [...output] })
  }
  const result = (status: 'completed' | 'compile-error' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    values: { ...values }, target, printedValues: printedValues ? [...printedValues] : null, output: [...output] })
  add('check-program', 6, '先檢查整個程式的 const 賦值規則，尚未進入 main，也沒有執行任何宣告。')
  if (issues.length) {
    add('blocked', 3, `設定不符合本練習範圍：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  const kind = CONST_POINTER_KINDS[stableConfig.kind]
  const compileError = stableConfig.operation === 'write-through' && !kind.canWrite
    ? '這個 p 指向 const int，不能透過 *p 賦值。'
    : stableConfig.operation === 'rebind' && !kind.canRebind
      ? 'p 本身是 const 指標，初始化後不能重新指定指向。' : null
  if (compileError) {
    add('blocked', 7, `${compileError} 這是編譯階段的限制；整個程式尚未執行，前面的宣告也沒有建立執行期資料。`)
    return result('compile-error', compileError)
  }
  mainInScope = true
  add('enter-main', 3, '這個操作符合目前宣告的 const 規則，現在才進入 main。')
  values.x = 10
  add('initialize-x', 4, '建立一般 int 變數 x = 10；x 本身沒有宣告為 const。', 'x')
  values.y = 20
  add('initialize-y', 5, '建立一般 int 變數 y = 20；兩個原變數都可以直接賦值。', 'y')
  target = stableConfig.target
  add('bind-pointer', 6, `初始化 p，指向 ${target}。const 指標也必須先完成這一次初始化。`, 'p')
  if (stableConfig.operation === 'write-through') {
    values[target] = 30
    add('write-through', 7, `透過 *p 把 ${target} 改成 30；p 的指向維持不變。`, target)
  } else if (stableConfig.operation === 'rebind') {
    target = target === 'x' ? 'y' : 'x'
    add('rebind', 7, `p 改指向 ${target}；x、y 的值都沒有被改寫。`, 'p')
  } else {
    values.x = 30
    add('direct-write', 7, `直接把一般 int 變數 x 改成 30。${target === 'x' ? 'p 仍指向 x，所以之後透過 *p 會讀到新值。' : 'p 仍指向 y，所以 *p 讀到的仍是 y。'}`, 'x')
  }
  printedValues = [values.x!, values.y!, values[target]!]
  output.push(`x=${printedValues[0]}, y=${printedValues[1]}, *p=${printedValues[2]}`)
  add('print', 8, 'printf 讀取 x、y 與 *p，輸出目前的值；const 限制的是哪些操作可以寫入，不會複製出另一個整數。')
  add('return-main', 9, 'main 正常回傳 0。')
  mainInScope = false
  add('done', 10, 'main 結束，x、y 與 p 離開作用域，主控台保留輸出。')
  return result('completed', output[0])
}
