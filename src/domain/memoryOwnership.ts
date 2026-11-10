import {
  type MemoryOwnershipConfig,
  DEFAULT_MEMORY_OWNERSHIP_CONFIG,
  validateMemoryOwnershipConfig,
} from './memoryOwnershipConfig'

export {
  MEMORY_OWNERSHIP_STRATEGIES,
  MEMORY_OWNERSHIP_OUTCOMES,
  type MemoryOwnershipConfig,
  DEFAULT_MEMORY_OWNERSHIP_CONFIG,
  validateMemoryOwnershipConfig,
} from './memoryOwnershipConfig'

export function buildMemoryOwnershipSource(config: MemoryOwnershipConfig = DEFAULT_MEMORY_OWNERSHIP_CONFIG) {
  const safe = validateMemoryOwnershipConfig(config).length ? DEFAULT_MEMORY_OWNERSHIP_CONFIG : config
  const statements = [
    ['include-stdio', '#include <stdio.h>'],
    ['include-stdlib', '#include <stdlib.h>'],
    ['blank-type', ''],
    ['type', 'typedef struct { int *data; } Buffer;'],
    ['blank-move', ''],
    ['move', 'static void move_buffer(Buffer *to, Buffer *from) {'],
    ['copy', '  to->data = from->data;'],
    ['clear-source', '  from->data = NULL;'],
    ['leave-move', '}'],
    ['blank-release', ''],
    ['release', 'static void release_buffer(Buffer *buffer) {'],
    ['free', '  free(buffer->data);'],
    ['clear-owner', '  buffer->data = NULL;'],
    ['leave-release', '}'],
    ['blank-main', ''],
    ['main', 'int main(void) {'],
    ['allocate', '  Buffer source = {malloc(sizeof(int))};'],
    ['destination', '  Buffer destination = {NULL};'],
    ['check-allocation', '  if (source.data == NULL) {'],
    ['print-failure', '    puts("allocation failed");'],
    ['return-failure', '    return 1;'],
    ['end-failure', '  }'],
    ['initialize', `  *source.data = ${safe.value};`],
    ['borrow', '  int *view = source.data;'],
    ['choose-source', '  Buffer *cleanup = &source;'],
    ['check-transfer', `  if (${safe.strategy === 'transfer' ? 1 : 0}) {`],
    ['call-move', '    move_buffer(&destination, &source);'],
    ['choose-destination', '    cleanup = &destination;'],
    ['end-transfer', '  }'],
    ['observe', '  int observed = *view;'],
    ['call-release', '  release_buffer(cleanup);'],
    ['clear-view', '  view = NULL;'],
    ['print', '  printf("value=%d, released_by=%s\\n", observed,'],
    ['print-owner', '         cleanup == &source ? "source" : "destination");'],
    ['return-main', '  return 0;'],
    ['leave-main', '}'],
  ] as const
  type Location = typeof statements[number][0]
  const locations = Object.fromEntries(statements.map(([key], index) => [key, index + 1])) as Record<Location, number>
  const lines = statements.map(([, code], index) => ({ lineNumber: index + 1, code }))
  return { lines, locations, sourceText: lines.map(line => line.code).join('\n') }
}

type SourceLocation = keyof ReturnType<typeof buildMemoryOwnershipSource>['locations']
export type MemoryOwnershipPhase = 'prepare' | 'blocked' | 'enter-main' | 'allocate' | 'initialize-destination'
  | 'check-allocation' | 'print-failure' | 'return-failure' | 'initialize-value' | 'borrow' | 'select-source'
  | 'check-transfer' | 'call-transfer' | 'enter-transfer' | 'copy-pointer' | 'clear-source' | 'leave-transfer'
  | 'select-destination' | 'observe' | 'call-release' | 'enter-release' | 'free' | 'clear-owner' | 'leave-release'
  | 'clear-view' | 'print' | 'return-main' | 'done'
type BufferName = 'source' | 'destination'
export type HeapPointerState = 'unset' | 'null' | 'live' | 'invalid'
export type MemoryOwnershipResult = BufferName | 'failure'

export interface MemoryOwnershipFrame {
  index: number
  phase: MemoryOwnershipPhase
  activeLine: number
  activePart: string
  explanation: string
  activeFunction: 'main' | 'move_buffer' | 'release_buffer' | null
  source: HeapPointerState
  destination: HeapPointerState
  view: HeapPointerState
  heap: 'not-allocated' | 'live' | 'released'
  heapValue: number | null
  responsibility: BufferName | null
  cleanup: BufferName | null
  releaseParameter: BufferName | null
  observed: number | null
  freeCount: number
  printedOutcome: MemoryOwnershipResult | null
  stdout: string
}

export function simulateMemoryOwnershipProgram(config: MemoryOwnershipConfig = DEFAULT_MEMORY_OWNERSHIP_CONFIG) {
  const source = buildMemoryOwnershipSource(config)
  const issues = validateMemoryOwnershipConfig(config)
  const frames: MemoryOwnershipFrame[] = []
  const state: Omit<MemoryOwnershipFrame, 'index' | 'phase' | 'activeLine' | 'activePart' | 'explanation'> = {
    activeFunction: null, source: 'unset', destination: 'unset', view: 'unset', heap: 'not-allocated', heapValue: null,
    responsibility: null, cleanup: null, releaseParameter: null, observed: null, freeCount: 0, printedOutcome: null, stdout: '',
  }
  const add = (phase: MemoryOwnershipPhase, location: SourceLocation, explanation: string) => {
    const activeLine = source.locations[location]
    frames.push({ ...state, index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation })
  }
  const finish = (exitCode: number) => {
    state.activeFunction = null
    state.source = 'unset'
    state.destination = 'unset'
    state.view = 'unset'
    state.cleanup = null
    state.observed = null
    add('done', 'leave-main', 'main 已結束，保留輸出與配置區塊的生命週期紀錄。')
    return { source, frames, status: 'completed' as const, exitCode, stdout: state.stdout, freeCount: state.freeCount }
  }

  add('prepare', 'type', 'Buffer 用 data 保存配置區塊的位址。程式約定由目前持有者負責釋放。')
  if (issues.length) {
    add('blocked', 'main', issues.join(' '))
    return { source, frames, status: 'blocked' as const, exitCode: null, stdout: '', freeCount: 0 }
  }

  state.activeFunction = 'main'
  add('enter-main', 'main', '進入 main，準備配置一個 int 所需的空間。')
  const allocationFailed = config.outcome === 'failure'
  if (allocationFailed) {
    state.source = 'null'
    add('allocate', 'allocate', 'malloc 回傳 NULL，source.data 保存空指標。')
  } else {
    state.source = 'live'
    state.heap = 'live'
    state.responsibility = 'source'
    add('allocate', 'allocate', 'source.data 取得區塊 A 的位址，這一格 int 尚未初始化。')
  }
  state.destination = 'null'
  add('initialize-destination', 'destination', '目的端初始化為空，準備接手。')
  add('check-allocation', 'check-allocation', allocationFailed ? 'source.data 是 NULL，進入配置失敗分支。' : 'source.data 有效，繼續初始化資料。')
  if (allocationFailed) {
    state.printedOutcome = 'failure'
    state.stdout = 'allocation failed\n'
    add('print-failure', 'print-failure', '輸出配置失敗。')
    add('return-failure', 'return-failure', '以狀態 1 結束。這條路徑沒有取得區塊，也沒有建立 view。')
    return finish(1)
  }

  state.heapValue = config.value
  add('initialize-value', 'initialize', '先寫入資料，讓接下來的讀取有已初始化的值。')
  state.view = 'live'
  add('borrow', 'borrow', 'view 複製同一個位址，用來借看資料。釋放責任仍由 source 負責。')
  state.cleanup = 'source'
  add('select-source', 'choose-source', 'cleanup 指向 main 中的 source 結構。')
  const transfer = config.strategy === 'transfer'
  add('check-transfer', 'check-transfer', transfer ? '進入轉交分支。' : '由 source 繼續負責釋放。')
  if (transfer) {
    add('call-transfer', 'call-move', '把兩個 Buffer 的位址傳給 move_buffer。')
    state.activeFunction = 'move_buffer'
    add('enter-transfer', 'move', 'to 指向空的 destination，from 指向 source。')
    state.destination = 'live'
    add('copy-pointer', 'copy', '兩個 data 欄位暫時都保存 A 的位址，等待完成交接。')
    state.source = 'null'
    state.responsibility = 'destination'
    add('clear-source', 'clear-source', '把 source.data 設為 NULL，交接完成。destination 接手 A，view 仍可讀取。')
    state.activeFunction = 'main'
    add('leave-transfer', 'leave-move', '返回 main，to 與 from 的參數生命週期結束。')
    state.cleanup = 'destination'
    add('select-destination', 'choose-destination', '讓 cleanup 指向接手的 destination。')
  }

  state.observed = state.heapValue
  add('observe', 'observe', '在區塊仍有效時讀取 *view，把整數值存進 observed。')
  add('call-release', 'call-release', '把目前負責釋放的 Buffer 位址交給 release_buffer。')
  state.activeFunction = 'release_buffer'
  const releaser = state.cleanup
  state.releaseParameter = releaser
  add('enter-release', 'release', `buffer 指向 ${releaser} 結構，準備釋放 A。`)
  state.heap = 'released'
  state.heapValue = null
  state[releaser] = 'invalid'
  state.view = 'invalid'
  state.responsibility = null
  state.freeCount += 1
  add('free', 'free', 'A 的生命週期結束。指向 A 的欄位與 view 同時失效，buffer 仍指向有效的 Buffer 結構。')
  state[releaser] = 'null'
  add('clear-owner', 'clear-owner', '直接把持有者的 data 欄位設成 NULL。view 仍待清空。')
  state.activeFunction = 'main'
  state.releaseParameter = null
  add('leave-release', 'leave-release', '返回 main，區域參數 buffer 離開作用域。')
  state.view = 'null'
  add('clear-view', 'clear-view', '直接指定 view = NULL，清空這個別名。')
  state.printedOutcome = releaser
  state.stdout = `value=${state.observed}, released_by=${releaser}\n`
  add('print', 'print', '輸出先前保存的整數與釋放責任的紀錄。cleanup 仍指向 main 的 Buffer 結構。')
  add('return-main', 'return-main', '以狀態 0 結束。這條路徑釋放了一次 A。')
  return finish(0)
}
