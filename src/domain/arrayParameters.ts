import {
  ARRAY_PARAMETER_SAMPLES,
  type ArrayParameterConfig,
  DEFAULT_ARRAY_PARAMETER_CONFIG,
  validateArrayParameterConfig,
} from './arrayParametersConfig'

export {
  ARRAY_PARAMETER_SAMPLES,
  type ArrayParameterConfig,
  DEFAULT_ARRAY_PARAMETER_CONFIG,
  validateArrayParameterConfig,
} from './arrayParametersConfig'

export type ArrayParameterPhase = 'enter-main' | 'initialize-array' | 'initialize-count' | 'call-process' | 'bind-parameters' | 'initialize-sum' | 'initialize-i' | 'condition' | 'modify-element' | 'accumulate' | 'increment-i' | 'end-loop' | 'return-process' | 'assign-answer' | 'print-answer' | 'initialize-k' | 'print-condition' | 'print-element' | 'increment-k' | 'return-main' | 'done' | 'blocked'
export interface ArrayParameterFrame {
  index: number
  phase: ArrayParameterPhase
  activeLine: number
  activePart: string
  explanation: string
  scores: readonly number[] | null
  mainStatus: 'active' | 'suspended' | 'returned'
  calleeStatus: 'not-called' | 'active' | 'returned'
  callerCount: number | null
  parameterCount: number | null
  sum: number | null
  i: number | null
  iInScope: boolean
  k: number | null
  kInScope: boolean
  answer: number | null
  returnValue: number | null
  activeIndex: number | null
  visitedIndices: readonly number[]
  writes: number
  output: readonly string[]
}
export function buildArrayParameterSource(config: ArrayParameterConfig = DEFAULT_ARRAY_PARAMETER_CONFIG) {
  const sample = typeof config.sample === 'string' && Object.hasOwn(ARRAY_PARAMETER_SAMPLES, config.sample) ? ARRAY_PARAMETER_SAMPLES[config.sample] : ARRAY_PARAMETER_SAMPLES.positive
  const count = Number.isInteger(config.count) && config.count >= 0 && config.count <= 5 ? config.count : DEFAULT_ARRAY_PARAMETER_CONFIG.count
  const code = [
    '#include <stdio.h>', '', `int process(${config.mode === 'modify' ? '' : 'const '}int items[], int count) {`,
    '  int sum = 0;', '  for (int i = 0; i < count; i++) {',
    config.mode === 'modify' ? '    items[i] += 2;' : '    // 唯讀：不修改 items[i]。',
    '    sum += items[i];', '  }', '  return sum;', '}', '', 'int main(void) {',
    `  int scores[5] = {${sample.join(', ')}};`, `  int count = ${count};`,
    '  int answer = process(scores, count);', '  printf("answer=%d\\n", answer);',
    '  for (int k = 0; k < 5; k++) {', '    printf("%d ", scores[k]);', '  }', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateArrayParameterProgram(config: ArrayParameterConfig = DEFAULT_ARRAY_PARAMETER_CONFIG) {
  const stableConfig = { sample: config.sample, count: config.count, mode: config.mode }
  const source = buildArrayParameterSource(stableConfig)
  const issues = validateArrayParameterConfig(stableConfig)
  const frames: ArrayParameterFrame[] = []
  let scores: number[] | null = null
  let mainStatus: ArrayParameterFrame['mainStatus'] = 'active'
  let calleeStatus: ArrayParameterFrame['calleeStatus'] = 'not-called'
  let callerCount: number | null = null
  let parameterCount: number | null = null
  let sum: number | null = null
  let i: number | null = null
  let iInScope = false
  let k: number | null = null
  let kInScope = false
  let answer: number | null = null
  let returnValue: number | null = null
  let writes = 0
  const visitedIndices: number[] = []
  const output: string[] = []
  const add = (phase: ArrayParameterPhase, activeLine: number, explanation: string, activeIndex: number | null = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      scores: scores ? [...scores] : null, mainStatus, calleeStatus, callerCount, parameterCount, sum, i, iInScope, k, kInScope,
      answer, returnValue, activeIndex, visitedIndices: [...visitedIndices], writes, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    scores: scores ? [...scores] : null, answer, visitedIndices: [...visitedIndices], writes, output: [...output] })
  add('enter-main', 12, '從 main 開始；上方的 process 定義要等到被呼叫才會執行。')
  if (issues.length) {
    add('blocked', 12, `設定超出本練習範圍，模擬器在宣告陣列前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  scores = [...ARRAY_PARAMETER_SAMPLES[stableConfig.sample]]
  add('initialize-array', 13, '在 main 建立五格 scores；接下來呼叫函式也不會複製出另一份陣列。')
  callerCount = stableConfig.count
  add('initialize-count', 14, `main 的 count = ${callerCount}，本次只處理前 ${callerCount} 個元素。`)
  mainStatus = 'suspended'
  add('call-process', 15, '呼叫 process(scores, count)；main 等待回傳值，answer 尚未完成初始化。')
  calleeStatus = 'active'; parameterCount = callerCount
  add('bind-parameters', 3, 'items 參數接收 scores 起始位址的副本，連到同一個陣列；參數 count 則接收數量的副本。')
  sum = 0
  add('initialize-sum', 4, 'process 建立自己的區域變數 sum = 0，不是 main 的 answer。')
  i = 0; iInScope = true
  add('initialize-i', 5, '函式內的 i 從 0 開始；由明確傳入的 count 決定處理範圍。')
  for (let index = 0; ; index++) {
    add('condition', 5, `${index} < ${parameterCount} 為 ${index < parameterCount ? 'true，這一格屬於本次處理範圍。' : 'false，停止處理；不讀取這個索引。'}`)
    if (index >= parameterCount) break
    if (stableConfig.mode === 'modify') {
      scores[index] += 2; writes++
      add('modify-element', 6, `items[${index}] += 2 直接把 main 的 scores[${index}] 改成 ${scores[index]}；不是修改陣列副本。`, index)
    }
    sum += scores[index]
    visitedIndices.push(index)
    add('accumulate', 7, `讀取 items[${index}] = ${scores[index]}，sum 累加成 ${sum}。`, index)
    i = index + 1
    add('increment-i', 5, `i 從 ${index} 更新為 ${index + 1}。`)
  }
  iInScope = false
  add('end-loop', 8, '迴圈結束，i 離開作用域；傳入的 count 沒有改變。')
  returnValue = sum
  add('return-process', 9, `return 把 sum = ${sum} 的值帶回 main；呼叫端的 answer 還要接收這個回傳值。`)
  calleeStatus = 'returned'; mainStatus = 'active'; answer = returnValue
  add('assign-answer', 15, `main 接收回傳值，answer = ${answer}；process 的參數與區域變數已離開作用域，scores 仍然存在。`)
  output.push(`answer=${answer}`)
  add('print-answer', 16, `printf 輸出 answer=${answer}。`)
  k = 0; kInScope = true
  add('initialize-k', 17, 'main 用新的 k 走訪完整五格，檢查呼叫後的原陣列。')
  for (let index = 0; ; index++) {
    add('print-condition', 17, `${index} < 5 為 ${index < 5 ? 'true，輸出這一格。' : 'false，輸出結束。'}`)
    if (index >= 5) break
    output.push(String(scores[index]))
    add('print-element', 18, `輸出 main 的 scores[${index}] = ${scores[index]}。`, index)
    k = index + 1
    add('increment-k', 17, `k 從 ${index} 更新為 ${index + 1}。`)
  }
  kInScope = false
  add('return-main', 20, 'k 離開作用域，main 正常回傳 0。')
  mainStatus = 'returned'
  add('done', 21, 'main 結束，scores、count 與 answer 離開作用域，主控台保留輸出。')
  return result('completed', `函式處理 ${visitedIndices.length} 格、寫入 ${writes} 格，回傳 ${answer}。`)
}
