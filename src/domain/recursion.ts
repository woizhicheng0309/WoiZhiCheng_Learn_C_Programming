import { type RecursionConfig, DEFAULT_RECURSION_CONFIG, validateRecursionConfig } from './recursionConfig'

export { type RecursionConfig, DEFAULT_RECURSION_CONFIG, validateRecursionConfig } from './recursionConfig'

export const RECURSION_LIMITS = { n: { min: 0, max: 6 } } as const
export type RecursionPhase = 'enter-main' | 'call' | 'enter-function' | 'check-base' | 'return-base' | 'receive' | 'multiply' | 'return-result' | 'main-result' | 'print' | 'return-main' | 'done' | 'blocked'
export interface RecursionActivation {
  id: number
  n: number
  previous: number | null
  result: number | null
  returnValue: number | null
}
export interface RecursionFrame {
  index: number
  phase: RecursionPhase
  activeLine: number
  activePart: string
  explanation: string
  stack: readonly Readonly<RecursionActivation>[]
  answer: number | null
  mainInScope: boolean
  output: readonly number[]
}
export function buildRecursionSource(config: RecursionConfig = DEFAULT_RECURSION_CONFIG) {
  const literal = validateRecursionConfig(config).length ? '0 /* invalid n */' : String(config.n)
  const code = [
    '#include <stdio.h>', '', 'int factorial(int n) {', '  if (n <= 1) {', '    return 1;', '  }',
    '  int previous = factorial(n - 1);', '  int result = n * previous;', '  return result;', '}', '',
    'int main(void) {', `  int answer = factorial(${literal});`, '  printf("%d\\n", answer);', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateRecursionProgram(config: RecursionConfig = DEFAULT_RECURSION_CONFIG) {
  const stableConfig = { n: config.n }
  const source = buildRecursionSource(stableConfig)
  const validationIssues = validateRecursionConfig(stableConfig)
  const frames: RecursionFrame[] = []
  const stack: RecursionActivation[] = []
  const output: number[] = []
  let answer: number | null = null
  let mainInScope = true
  let nextId = 1
  let maxDepth = 0
  const add = (phase: RecursionPhase, activeLine: number, explanation: string) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      stack: stack.map(item => ({ ...item })), answer, mainInScope, output: [...output] })
  }
  add('enter-main', 12, '進入 main，準備呼叫 factorial；answer 尚未收到回傳值。')
  if (validationIssues.length) {
    add('blocked', 13, `輸入超出練習範圍，模擬器在呼叫前安全停止：${validationIssues.join(' ')}`)
    return { config: stableConfig, source, frames, output: [...output], answer, maxDepth, status: 'blocked' as const, message: validationIssues.join(' ') }
  }
  const invoke = (n: number, callerLine: number): number => {
    add('call', callerLine, `呼叫 factorial(${n})；呼叫端暫停，等待回傳值。`)
    const activation: RecursionActivation = { id: nextId++, n, previous: null, result: null, returnValue: null }
    stack.push(activation)
    maxDepth = Math.max(maxDepth, stack.length)
    add('enter-function', 3, `建立第 ${activation.id} 個呼叫框架，其區域參數 n = ${n}。不同呼叫各有自己的 n。`)
    add('check-base', 4, `${n} <= 1 為 ${n <= 1 ? 'true，直接回傳 1，不再遞迴。' : 'false，需要先取得 factorial(n - 1)。'}`)
    if (n <= 1) {
      activation.returnValue = 1
      add('return-base', 5, `終止條件成立：factorial(${n}) 回傳 1。下一步此框架離開堆疊。`)
    } else {
      const previous = invoke(n - 1, 7)
      activation.previous = previous
      add('receive', 7, `回到 factorial(${n})，將下層回傳的 ${previous} 存入 previous。`)
      activation.result = n * previous
      add('multiply', 8, `本層的 n 仍是 ${n}：${n} × ${previous} = ${activation.result}，存入 result。`)
      activation.returnValue = activation.result
      add('return-result', 9, `factorial(${n}) 回傳 ${activation.returnValue}；下一步此框架離開堆疊。`)
    }
    const result = activation.returnValue!
    stack.pop()
    return result
  }
  answer = invoke(stableConfig.n, 13)
  add('main-result', 13, `所有 factorial 框架都已離開，main 的 answer 收到 ${answer}。`)
  output.push(answer)
  add('print', 14, `printf 輸出 answer：${answer}。`)
  add('return-main', 15, 'return 0 表示 main 正常結束。')
  mainInScope = false
  add('done', 16, 'main 結束，answer 離開作用域；已輸出的內容保留在主控台。')
  return { config: stableConfig, source, frames, output: [...output], answer, maxDepth, status: 'completed' as const, message: `factorial(${stableConfig.n}) = ${answer}。` }
}
