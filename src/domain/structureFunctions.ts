import {
  STRUCTURE_TYPE_NAMES,
  type StructureFunctionConfig,
  DEFAULT_STRUCTURE_FUNCTION_CONFIG,
  validateStructureFunctionConfig,
} from './structureFunctionsConfig'

export {
  STRUCTURE_TYPE_NAMES,
  STRUCTURE_WRITE_ORDERS,
  type StructureFunctionConfig,
  DEFAULT_STRUCTURE_FUNCTION_CONFIG,
  validateStructureFunctionConfig,
} from './structureFunctionsConfig'

export const ORIGINAL_STRUCTURE_SCORE = 70

export function buildStructureFunctionSource(config: StructureFunctionConfig = DEFAULT_STRUCTURE_FUNCTION_CONFIG) {
  const safe = validateStructureFunctionConfig(config).length ? DEFAULT_STRUCTURE_FUNCTION_CONFIG : config
  const typeName = STRUCTURE_TYPE_NAMES[safe.typeName].name
  const write = ['write-target', '  target->score = score;'] as const
  const rebind = ['rebind-target', '  target = alternate;'] as const
  const updateSteps = safe.writeOrder === 'write-first' ? [write, rebind] : [rebind, write]
  const statements = [
    ['include', '#include <stdio.h>'],
    ['blank-1', ''],
    ['type', 'typedef struct Student {'],
    ['id', '  int id;'],
    ['score', '  int score;'],
    ['alias', '} Student;'],
    ['blank-2', ''],
    ['enter-revise', `static ${typeName} revise(${typeName} copy, int score) {`],
    ['write-copy', '  copy.score = score;'],
    ['return-copy', '  return copy;'],
    ['leave-revise', '}'],
    ['blank-3', ''],
    ['enter-update', `static int update(${typeName} *target, ${typeName} *alternate, int score) {`],
    ...updateSteps,
    ['return-observed', '  return target->score;'],
    ['leave-update', '}'],
    ['blank-4', ''],
    ['enter-main', 'int main(void) {'],
    ['initialize-original', `  ${typeName} original = {7, ${ORIGINAL_STRUCTURE_SCORE}};`],
    ['receive-copy', `  ${typeName} preview = revise(original, ${safe.previewScore});`],
    ['bind-selected', `  ${typeName} *selected = &original;`],
    ['receive-observed', `  int observed = update(selected, &preview, ${safe.writeScore});`],
    ['print', '  printf("original=%d, preview=%d, selected=%d, observed=%d\\n",'],
    ['print-values', '         original.score, preview.score, selected->score, observed);'],
    ['return-main', '  return 0;'],
    ['leave-main', '}'],
  ] as const
  type Location = typeof statements[number][0]
  const locations = Object.fromEntries(statements.map(([key], index) => [key, index + 1])) as Record<Location, number>
  const lines = statements.map(([, code], index) => ({ lineNumber: index + 1, code }))
  return { lines, locations, sourceText: lines.map(line => line.code).join('\n') }
}

type SourceLocation = keyof ReturnType<typeof buildStructureFunctionSource>['locations']
export type StructureFunctionPhase = 'prepare' | 'blocked' | 'done' | 'enter-main' | 'initialize-original'
  | 'call-revise' | 'enter-revise' | 'write-copy' | 'return-copy' | 'receive-copy' | 'bind-selected'
  | 'call-update' | 'enter-update' | 'write-target' | 'rebind-target' | 'return-observed' | 'receive-observed'
  | 'print' | 'return-main'
export interface StudentValue { id: number; score: number }
type CallerObject = 'original' | 'preview'
type FunctionName = 'main' | 'revise' | 'update'

export interface StructureFunctionFrame {
  index: number
  phase: StructureFunctionPhase
  activeLine: number
  activePart: string
  explanation: string
  activeFunction: FunctionName | null
  original: Readonly<StudentValue> | null
  preview: Readonly<StudentValue> | null
  copy: Readonly<StudentValue> | null
  selected: CallerObject | null
  target: CallerObject | null
  alternate: CallerObject | null
  scoreParameter: number | null
  returnedStudent: Readonly<StudentValue> | null
  returnedScore: number | null
  observed: number | null
  writtenObject: CallerObject | 'copy' | null
  printedValues: readonly [number, number] | null
  stdout: string
}

export function simulateStructureFunctionProgram(config: StructureFunctionConfig = DEFAULT_STRUCTURE_FUNCTION_CONFIG) {
  const source = buildStructureFunctionSource(config)
  const issues = validateStructureFunctionConfig(config)
  const frames: StructureFunctionFrame[] = []
  const state: Omit<StructureFunctionFrame, 'index' | 'phase' | 'activeLine' | 'activePart' | 'explanation'> = {
    activeFunction: null, original: null, preview: null, copy: null, selected: null, target: null, alternate: null,
    scoreParameter: null, returnedStudent: null, returnedScore: null, observed: null, writtenObject: null,
    printedValues: null, stdout: '',
  }
  const add = (phase: StructureFunctionPhase, location: SourceLocation, explanation: string) => {
    const activeLine = source.locations[location]
    frames.push({ ...state, index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation })
  }
  add('prepare', 'alias', '編譯時宣告 Student 為 struct Student 的別名。執行從 main 開始。')
  if (issues.length) {
    add('blocked', 'alias', issues.join(' '))
    return { source, frames, status: 'blocked' as const, message: issues.join(' '), stdout: '', exitCode: null }
  }

  state.activeFunction = 'main'
  add('enter-main', 'enter-main', '進入 main，準備建立原始紀錄。')
  state.original = { id: 7, score: ORIGINAL_STRUCTURE_SCORE }
  add('initialize-original', 'initialize-original', '初始化 original 的 id 與 score。')

  add('call-revise', 'receive-copy', '用 original 的結構值與預覽分數呼叫 revise。preview 等待初始化結果。')
  state.activeFunction = 'revise'
  state.copy = { ...state.original }
  state.scoreParameter = config.previewScore
  add('enter-revise', 'enter-revise', 'revise 的 copy 參數取得自己的結構值，兩份紀錄的成員目前相同。')
  state.copy = { ...state.copy, score: config.previewScore }
  state.writtenObject = 'copy'
  add('write-copy', 'write-copy', '修改 copy.score，呼叫端的 original 保持原分數。')
  state.writtenObject = null
  state.returnedStudent = { ...state.copy }
  add('return-copy', 'return-copy', '求出回傳的結構值，包含 id 與修改後的 score。')
  state.activeFunction = 'main'
  state.copy = null
  state.scoreParameter = null
  state.preview = { ...state.returnedStudent }
  state.returnedStudent = null
  add('receive-copy', 'receive-copy', '用回傳值初始化獨立的 preview。revise 的參數生命週期已結束。')

  state.selected = 'original'
  add('bind-selected', 'bind-selected', 'selected 保存 original 的位址。')
  add('call-update', 'receive-observed', '把 selected 保存的位址與 preview 的位址傳入 update。')
  state.activeFunction = 'update'
  state.target = state.selected
  state.alternate = 'preview'
  state.scoreParameter = config.writeScore
  add('enter-update', 'enter-update', 'target 與 selected 各自保存 &original，alternate 保存 &preview。')
  const writeScore = () => {
    const object = state.target!
    state[object] = { ...state[object]!, score: config.writeScore }
    state.writtenObject = object
    add('write-target', 'write-target', `透過 target 寫入 ${object}.score。`)
    state.writtenObject = null
  }
  const rebind = () => {
    state.target = state.alternate
    add('rebind-target', 'rebind-target', 'target 改存 &preview。呼叫端的 selected 仍保存 &original。')
  }
  if (config.writeOrder === 'write-first') {
    writeScore()
    rebind()
  } else {
    rebind()
    writeScore()
  }
  state.returnedScore = state.preview.score
  add('return-observed', 'return-observed', '依 target 現在的指向讀取 preview.score，回傳該整數值。')
  state.activeFunction = 'main'
  state.target = null
  state.alternate = null
  state.scoreParameter = null
  state.observed = state.returnedScore
  state.returnedScore = null
  add('receive-observed', 'receive-observed', 'observed 接住整數回傳值，update 的區域參數離開呼叫框。')

  state.printedValues = [state.original.score, state.preview.score]
  state.stdout = `original=${state.original.score}, preview=${state.preview.score}, selected=${state.original.score}, observed=${state.observed}\n`
  add('print', 'print', '輸出兩份紀錄的分數、selected 所讀到的原始紀錄分數，以及 observed。')
  add('return-main', 'return-main', 'main 回傳 0。')
  state.activeFunction = null
  state.original = null
  state.preview = null
  state.selected = null
  state.observed = null
  add('done', 'leave-main', 'main 的區域物件離開作用域，主控台保留輸出。')
  return { source, frames, status: 'completed' as const, message: '', stdout: state.stdout, exitCode: 0 }
}
