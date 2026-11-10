import {
  STRING_COPY_SAMPLES,
  STRING_COPY_CAPACITIES,
  type StringCopyConfig,
  DEFAULT_STRING_COPY_CONFIG,
  validateStringCopyConfig,
} from './stringCopyConfig'

export {
  STRING_COPY_SAMPLES,
  STRING_COPY_CAPACITIES,
  type StringCopyConfig,
  DEFAULT_STRING_COPY_CONFIG,
  validateStringCopyConfig,
} from './stringCopyConfig'

export type StringCopyPhase = 'enter-main' | 'initialize-source' | 'declare-destination' | 'measure-length' | 'print-sizes' | 'check-capacity' | 'initialize-i' | 'copy-condition' | 'copy-character' | 'increment-i' | 'finish-copy' | 'print-string' | 'reject-copy' | 'end-if' | 'return-main' | 'done' | 'blocked'
export interface StringCopyFrame {
  index: number
  phase: StringCopyPhase
  activeLine: number
  activePart: string
  explanation: string
  source: readonly string[] | null
  destination: readonly (string | null)[] | null
  length: number | null
  i: number | null
  iInScope: boolean
  mainInScope: boolean
  activeIndex: number | null
  copiedCount: number
  copied: boolean
  fits: boolean | null
  output: readonly string[]
}
export function buildStringCopySource(config: StringCopyConfig = DEFAULT_STRING_COPY_CONFIG) {
  const sample = Object.hasOwn(STRING_COPY_SAMPLES, config.sample) ? STRING_COPY_SAMPLES[config.sample] : STRING_COPY_SAMPLES.word
  const capacity = STRING_COPY_CAPACITIES.includes(config.capacity) ? config.capacity : DEFAULT_STRING_COPY_CONFIG.capacity
  const code = [
    '#include <stdio.h>', '#include <string.h>', '', 'int main(void) {',
    `  char source[] = "${sample.literal}";`, `  char destination[${capacity}];`,
    '  size_t length = strlen(source);', '  printf("length=%zu, capacity=%zu\\n", length, sizeof destination);',
    '  if (length < sizeof destination) {', '    for (size_t i = 0; i <= length; i++) {',
    '      destination[i] = source[i];', '    }', '    printf("%s\\n", destination);',
    '  } else {', '    printf("buffer too small\\n");', '  }', '  return 0;', '}',
  ]
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}
export function simulateStringCopyProgram(config: StringCopyConfig = DEFAULT_STRING_COPY_CONFIG) {
  const stableConfig = { sample: config.sample, capacity: config.capacity }
  const sourceCode = buildStringCopySource(stableConfig)
  const issues = validateStringCopyConfig(stableConfig)
  const frames: StringCopyFrame[] = []
  let source: string[] | null = null
  let destination: (string | null)[] | null = null
  let length: number | null = null
  let i: number | null = null
  let iInScope = false
  let mainInScope = true
  let copiedCount = 0
  let copied = false
  let fits: boolean | null = null
  const output: string[] = []
  const add = (phase: StringCopyPhase, activeLine: number, explanation: string, activeIndex: number | null = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      source: source ? [...source] : null, destination: destination ? [...destination] : null,
      length, i, iInScope, mainInScope, activeIndex, copiedCount, copied, fits, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source: sourceCode, frames, status, message,
    length, sourceSize: source?.length ?? null, destination: destination ? [...destination] : null, copiedCount, copied, fits, output: [...output] })
  add('enter-main', 4, '進入 main，先分清字串內容長度與陣列可容納的格數。')
  if (issues.length) {
    add('blocked', 4, `輸入不符合本練習範圍，在宣告陣列前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  source = [...STRING_COPY_SAMPLES[stableConfig.sample].characters]
  add('initialize-source', 5, `source 有 ${source.length} 個 char 格；字串常值會自動附加結尾空字元。`)
  destination = Array.from({ length: stableConfig.capacity }, () => null)
  add('declare-destination', 6, `destination 保留 ${stableConfig.capacity} 格，尚未初始化；不能把這些格子當成空字元。`)
  length = source.indexOf('\0')
  add('measure-length', 7, `strlen 停在第一個空字元，得到 ${length}；不計空字元，也不計它後面的資料。`)
  output.push(`length=${length}, capacity=${stableConfig.capacity}`)
  add('print-sizes', 8, `sizeof destination 是這個 char 陣列的 ${stableConfig.capacity} 位元組容量；size_t 用 %zu 輸出。`)
  fits = length < stableConfig.capacity
  add('check-capacity', 9, `${length} < ${stableConfig.capacity} 為 ${fits ? 'true，內容加上結尾空字元放得下。' : 'false；內容之外還需一格結尾空字元，所以拒絕複製。'}`)
  if (fits) {
    i = 0; iInScope = true
    add('initialize-i', 10, '從索引 0 開始，條件用 <= length，才能一起複製結尾空字元。')
    for (let index = 0; ; index++) {
      add('copy-condition', 10, `${index} <= ${length} 為 ${index <= length ? 'true，複製這一格。' : 'false，複製結束；不再讀取或寫入這個索引。'}`)
      if (index > length) break
      destination[index] = source[index]
      copiedCount++
      if (source[index] === '\0') copied = true
      add('copy-character', 11, source[index] === '\0' ? `複製索引 ${index} 的 '\\0'；destination 現在才是有結尾的 C 字串。` : `複製 source[${index}] 的 '${source[index]}' 到 destination[${index}]。`, index)
      i = index + 1
      add('increment-i', 10, `i 從 ${index} 更新為 ${index + 1}。`)
    }
    iInScope = false
    add('finish-copy', 12, `共複製 ${copiedCount} 格，包含結尾空字元；目的陣列剩餘格子仍未初始化。`)
    const text = source.slice(0, length).join('')
    output.push(text)
    add('print-string', 13, `printf 的 %s 停在第一個 '\\0'；${text ? `輸出 ${text}。` : '空字串只輸出換行，不會輸出可見字元。'}`)
  } else {
    output.push('buffer too small')
    add('reject-copy', 15, '容量不足，顯示 buffer too small；不寫入 destination，也不把未初始化的陣列交給 %s。')
  }
  add('end-if', 16, '離開容量判斷區塊。source、destination 與 length 仍在 main 的作用域中。')
  add('return-main', 17, 'return 0，程式正常結束；容量不足是已處理的分支，不是越界存取。')
  mainInScope = false
  add('done', 18, 'main 結束，陣列與區域變數離開作用域，主控台保留輸出。')
  return result('completed', copied ? `安全複製 ${copiedCount} 格，含結尾空字元。` : '容量不足，已安全拒絕複製。')
}
