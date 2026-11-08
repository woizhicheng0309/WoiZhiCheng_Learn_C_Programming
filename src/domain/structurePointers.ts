export const STRUCTURE_POINTER_SYNTAXES = {
  arrow: { label: '箭頭運算子：p->score' },
  dereference: { label: '解參照後取成員：(*p).score' },
} as const
export type StructurePointerObject = 'first' | 'second'
export type StructurePointerTarget = StructurePointerObject | 'null'
export interface StructurePointerConfig {
  syntax: keyof typeof STRUCTURE_POINTER_SYNTAXES
  initialTarget: StructurePointerObject
  target: StructurePointerTarget
  aliasScore: number
  pointedScore: number
}
export interface PointerStudent { id: number; score: number }
export const DEFAULT_STRUCTURE_POINTER_CONFIG: Readonly<StructurePointerConfig> = {
  syntax: 'arrow', initialTarget: 'first', target: 'second', aliasScore: 95, pointedScore: 70,
}
export type StructurePointerPhase = 'prepare' | 'enter-main' | 'initialize-first' | 'initialize-second'
  | 'bind-p' | 'copy-pointer' | 'write-via-q' | 'rebind-p' | 'check-pointer' | 'write-via-p'
  | 'print' | 'return-main' | 'done' | 'blocked'
export interface StructurePointerFrame {
  index: number
  phase: StructurePointerPhase
  activeLine: number
  activePart: string
  explanation: string
  first: Readonly<PointerStudent> | null
  second: Readonly<PointerStudent> | null
  /** JavaScript null means the pointer has not been declared; 'null' means C NULL. */
  p: StructurePointerTarget | null
  q: StructurePointerObject | null
  mainInScope: boolean
  activePointer: 'p' | 'q' | null
  activeObject: StructurePointerObject | null
  condition: boolean | null
  printedValues: readonly number[] | null
  output: readonly string[]
}

export function validateStructurePointerConfig(config: StructurePointerConfig = DEFAULT_STRUCTURE_POINTER_CONFIG): readonly string[] {
  const issues: string[] = []
  if (typeof config.syntax !== 'string' || !Object.hasOwn(STRUCTURE_POINTER_SYNTAXES, config.syntax)) issues.push('請選擇有效的成員存取寫法。')
  if (config.initialTarget !== 'first' && config.initialTarget !== 'second') issues.push('初始指向必須是 first 或 second。')
  if (config.target !== 'first' && config.target !== 'second' && config.target !== 'null') issues.push('新指向必須是 first、second 或 NULL。')
  if (!Number.isSafeInteger(config.aliasScore) || config.aliasScore < 0 || config.aliasScore > 100) issues.push('透過 q 寫入的分數必須是 0 到 100 的整數。')
  if (!Number.isSafeInteger(config.pointedScore) || config.pointedScore < 0 || config.pointedScore > 100) issues.push('透過 p 寫入的分數必須是 0 到 100 的整數。')
  return issues
}
export function structurePointerMember(pointer: 'p' | 'q', syntax: StructurePointerConfig['syntax']) {
  return syntax === 'dereference' ? `(*${pointer}).score` : `${pointer}->score`
}
export function buildStructurePointerSource(config: StructurePointerConfig = DEFAULT_STRUCTURE_POINTER_CONFIG) {
  const safe = validateStructurePointerConfig(config).length ? DEFAULT_STRUCTURE_POINTER_CONFIG : config
  const target = safe.target === 'null' ? 'NULL' : `&${safe.target}`
  const code = ['#include <stdio.h>', '', 'struct Student {', '  int id;', '  int score;', '};', '',
    'int main(void) {', '  struct Student first = {7, 80};', '  struct Student second = {12, 60};',
    `  struct Student *p = &${safe.initialTarget};`, '  struct Student *q = p;',
    `  ${structurePointerMember('q', safe.syntax)} = ${safe.aliasScore};`, `  p = ${target};`,
    '  if (p != NULL) {', `    ${structurePointerMember('p', safe.syntax)} = ${safe.pointedScore};`, '  }',
    '  printf("first=%d, second=%d\\n", first.score, second.score);', '  return 0;', '}']
  return { lines: code.map((code, index) => ({ lineNumber: index + 1, code })), sourceText: code.join('\n') }
}

export function simulateStructurePointerProgram(config: StructurePointerConfig = DEFAULT_STRUCTURE_POINTER_CONFIG) {
  const stableConfig = { syntax: config.syntax, initialTarget: config.initialTarget, target: config.target, aliasScore: config.aliasScore, pointedScore: config.pointedScore }
  const source = buildStructurePointerSource(stableConfig)
  const issues = validateStructurePointerConfig(stableConfig)
  const frames: StructurePointerFrame[] = []
  const objects: Record<StructurePointerObject, PointerStudent | null> = { first: null, second: null }
  let p: StructurePointerTarget | null = null
  let q: StructurePointerObject | null = null
  let mainInScope = false
  let printedValues: number[] | null = null
  const output: string[] = []
  const snapshot = () => ({ first: objects.first ? { ...objects.first } : null, second: objects.second ? { ...objects.second } : null })
  const add = (phase: StructurePointerPhase, activeLine: number, explanation: string,
    activePointer: StructurePointerFrame['activePointer'] = null, activeObject: StructurePointerObject | null = null,
    condition: boolean | null = null) => {
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation,
      ...snapshot(), p, q, mainInScope, activePointer, activeObject, condition,
      printedValues: printedValues ? [...printedValues] : null, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({
    config: stableConfig, source, frames, status, message, ...snapshot(), p, q,
    printedValues: printedValues ? [...printedValues] : null, output: [...output],
  })
  add('prepare', 8, 'struct Student 定義成員；兩份結構物件與兩個指標尚未建立。')
  if (issues.length) {
    add('blocked', 8, `設定超出本練習範圍，在建立物件前停止：${issues.join(' ')}`)
    return result('blocked', issues.join(' '))
  }
  mainInScope = true
  add('enter-main', 8, '進入 main，依序建立兩份獨立的結構物件。')
  objects.first = { id: 7, score: 80 }
  add('initialize-first', 9, 'first 保存 id = 7、score = 80。', null, 'first')
  objects.second = { id: 12, score: 60 }
  add('initialize-second', 10, 'second 保存 id = 12、score = 60，與 first 是不同的物件。', null, 'second')
  p = stableConfig.initialTarget
  add('bind-p', 11, `p 保存 &${p}，指向已存在的 ${p} 物件。`, 'p', p)
  q = p
  add('copy-pointer', 12, `q 複製 p 保存的位址，兩個指標都指向 ${q}；沒有複製結構物件。`, 'q', q)
  objects[q]!.score = stableConfig.aliasScore
  add('write-via-q', 13, `${structurePointerMember('q', stableConfig.syntax)} 修改 ${q}.score 為 ${stableConfig.aliasScore}；p 與 q 此時仍指向同一物件。`, 'q', q)
  p = stableConfig.target
  add('rebind-p', 14, `p ${p === 'null' ? '改為 NULL，不指向任何物件' : `改為 &${p}`}；q 仍保存 &${q}，兩份物件的成員不因改指向而改變。`, 'p', p === 'null' ? null : p)
  const nonNull = p !== 'null'
  add('check-pointer', 15, nonNull ? 'p != NULL 成立，本例的 p 指向仍在作用域中的物件，可以進入分支。'
    : 'p != NULL 不成立，略過成員存取；不能透過空指標讀寫成員。', 'p', null, nonNull)
  if (p !== 'null') {
    objects[p]!.score = stableConfig.pointedScore
    add('write-via-p', 16, `${structurePointerMember('p', stableConfig.syntax)} 修改目前的 ${p}.score 為 ${stableConfig.pointedScore}，q 的指向不變。`, 'p', p)
  }
  printedValues = [objects.first.score, objects.second.score]
  output.push(`first=${objects.first.score}, second=${objects.second.score}`)
  add('print', 18, '直接讀取兩份物件的 score 輸出；指標改指向本身不會搬移或複製物件。')
  add('return-main', 19, 'main 正常回傳 0。')
  mainInScope = false
  add('done', 20, 'main 結束，兩份物件與指標都離開作用域，主控台保留輸出。')
  return result('completed', `first.score、second.score 依序為 ${printedValues.join('、')}。`)
}
