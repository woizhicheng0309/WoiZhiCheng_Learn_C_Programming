import { DEFAULT_DYNAMIC_RECORDS_CONFIG, DYNAMIC_RECORD_SAMPLES, validateDynamicRecordsConfig, type DynamicRecordsConfig } from './dynamicRecordsConfig'
import type { ScoreRecordValue } from './recordFields'
export * from './dynamicRecordsConfig'

export function buildDynamicRecordsSource(config: DynamicRecordsConfig = DEFAULT_DYNAMIC_RECORDS_CONFIG) {
  const safe = validateDynamicRecordsConfig(config).length ? DEFAULT_DYNAMIC_RECORDS_CONFIG : config
  const rows = DYNAMIC_RECORD_SAMPLES[safe.sample].rows
  const statements = [
    ['stdio', '#include <stdio.h>'], ['stdlib', '#include <stdlib.h>'], ['stdint', '#include <stdint.h>'],
    ['record-type', 'typedef struct { int id; int score; } Record;'],
    ['list-type', 'typedef struct { Record *data; size_t used; size_t capacity; } RecordList;'],
    ['blank-resize', ''], ['resize', 'static Record *resize_records(Record *data, size_t capacity) {'],
    ['attempt-static', '  static int attempt = 0;'], ['attempt', '  ++attempt;'],
    ['inject', `  if (attempt == ${safe.failAt}) return NULL; /* teaching: injected failure */`],
    ['realloc', '  return realloc(data, capacity * sizeof *data);'], ['end-resize', '}'],
    ['blank-append', ''], ['append', 'static int append_record(RecordList *list, Record value) {'],
    ['full', '  if (list->used == list->capacity) {'], ['limit', '    size_t limit = SIZE_MAX / sizeof *list->data;'],
    ['next-declare', '    size_t next;'],
    ['grow', safe.growth === 'double'
      ? '    if (list->capacity == 0) next = 2;'
      : '    if (list->capacity == limit) return 0;'],
    ['guard', safe.growth === 'double' ? '    else if (list->capacity > limit / 2) return 0;' : '    next = list->capacity + 1;'],
    ['next', safe.growth === 'double' ? '    else next = list->capacity * 2;' : '    /* exact growth: one new slot */'],
    ['byte-guard', '    if (next > limit) return 0;'],
    ['request', '    Record *temp = resize_records(list->data, next);'],
    ['check', '    if (temp == NULL) return 0;'], ['adopt', '    list->data = temp;'], ['capacity', '    list->capacity = next;'],
    ['end-full', '  }'], ['write', '  list->data[list->used] = value;'], ['increment', '  ++list->used;'],
    ['return-append', '  return 1;'], ['end-append', '}'],
    ['blank-main', ''], ['main', 'int main(void) {'],
    ['input', `  const Record input[6] = {${rows.map(row => `{${row.id}, ${row.score}}`).join(', ')}};`],
    ['count', `  const size_t count = ${safe.count};`], ['initialize', '  RecordList list = {NULL, 0, 0};'],
    ['status', '  int status = 0;'], ['loop', '  for (size_t i = 0; i < count; ++i) {'],
    ['call', '    if (!append_record(&list, input[i])) {'], ['failure-output', '      printf("append failed at index=%zu\\n", i);'],
    ['failure-status', '      status = 1;'], ['break', '      break;'], ['end-failure', '    }'], ['end-loop', '  }'],
    ['summary', '  printf("used=%zu, capacity=%zu\\n", list.used, list.capacity);'],
    ['output-loop', '  for (size_t i = 0; i < list.used; ++i) {'],
    ['print', '    printf("%d,%d\\n", list.data[i].id, list.data[i].score);'], ['end-output', '  }'],
    ['free', '  free(list.data);'], ['clear', '  list.data = NULL;'], ['reset', '  list.used = list.capacity = 0;'],
    ['return', '  return status;'], ['end-main', '}'],
  ] as const
  type Location = typeof statements[number][0]
  const locations = Object.fromEntries(statements.map(([key], index) => [key, index + 1])) as Record<Location, number>
  const lines = statements.map(([, code], index) => ({ lineNumber: index + 1, code }))
  return { lines, locations, sourceText: lines.map(line => line.code).join('\n') }
}
type Location = keyof ReturnType<typeof buildDynamicRecordsSource>['locations']
export type DynamicRecordsPhase = 'prepare' | 'blocked' | 'initialize' | 'loop' | 'call' | 'full' | 'limit' | 'grow' | 'guard'
  | 'request' | 'attempt' | 'injected-failure' | 'resized' | 'check' | 'adopt' | 'capacity' | 'write' | 'increment'
  | 'scope' | 'appended' | 'failed' | 'break' | 'summary' | 'print' | 'free' | 'clear' | 'reset' | 'return' | 'done'
export interface DynamicRecordsFrame {
  index: number
  phase: DynamicRecordsPhase
  activeLine: number
  activePart: string
  explanation: string
  used: number | null
  capacity: number | null
  rows: readonly (Readonly<ScoreRecordValue> | null)[] | null
  data: string
  temp: string
  next: number | null
  i: number | null
  pending: Readonly<ScoreRecordValue> | null
  attempts: number
  releases: number
  exitCode: number | null
  output: string
  revealed: boolean
}
export function simulateDynamicRecords(config: DynamicRecordsConfig = DEFAULT_DYNAMIC_RECORDS_CONFIG) {
  const source = buildDynamicRecordsSource(config)
  const issues = validateDynamicRecordsConfig(config)
  const frames: DynamicRecordsFrame[] = []
  const state: Omit<DynamicRecordsFrame, 'index' | 'phase' | 'activeLine' | 'activePart' | 'explanation'> = {
    used: null, capacity: null, rows: null, data: '—', temp: '—', next: null, i: null, pending: null,
    attempts: 0, releases: 0, exitCode: null, output: '', revealed: false,
  }
  let used = 0, capacity = 0, generation = 0, status = 0
  let rows: (ScoreRecordValue | null)[] = []
  let accepted: ScoreRecordValue[] = []
  function add(phase: DynamicRecordsPhase, location: Location, explanation: string) {
    const activeLine = source.locations[location]
    frames.push({ ...state, rows: state.rows ? rows.map(row => row ? { ...row } : null) : null,
      pending: state.pending ? { ...state.pending } : null, index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation })
  }
  const result = (completed: boolean) => ({ source, frames, status: completed ? 'completed' as const : 'blocked' as const,
    message: issues.join(' '), accepted, capacityBeforeFree: capacity, attempts: state.attempts, releases: state.releases, exitCode: state.exitCode, output: state.output })
  add('prepare', 'main', '每次加入完整紀錄；空間用完才擴充，最後只走訪有效筆數。')
  if (issues.length) { add('blocked', 'main', issues.join(' ')); return result(false) }
  state.used = 0; state.capacity = 0; state.data = 'NULL'
  add('initialize', 'initialize', '空清單尚未配置：data 為 NULL，used 與 capacity 都是 0。')
  for (let i = 0; i < config.count; i++) {
    state.i = i
    add('loop', 'loop', `i = ${i}，還有一筆輸入需要加入。`)
    state.pending = { ...DYNAMIC_RECORD_SAMPLES[config.sample].rows[i] }
    add('call', 'call', '傳入清單位址與完整 Record 值；成功時才增加 used。')
    add('full', 'full', used === capacity ? 'used 等於 capacity，需要先擴充。' : '尚有空格，略過配置，直接寫入。')
    if (used === capacity) {
      add('limit', 'limit', '先以 SIZE_MAX / sizeof 計算可表示的元素上限，避免位元組乘法溢位。')
      const next = config.growth === 'double' ? (capacity === 0 ? 2 : capacity * 2) : capacity + 1
      state.next = next
      add('grow', config.growth === 'double' ? capacity === 0 ? 'grow' : 'next' : 'guard', `下一次容量為 ${next} 格。${config.growth === 'double' ? '加倍前會先確認容量不超過 limit / 2。' : '加一前先確認容量尚未達到 limit。'}`)
      add('guard', 'byte-guard', '確認 next 沒有超過可配置的元素上限。這組最多六筆的資料不會觸及上限。')
      add('request', 'request', '以 temp 接收配置結果，失敗時保留 list.data。')
      state.attempts++
      add('attempt', 'attempt', `第 ${state.attempts} 次配置嘗試；尚未改寫清單欄位。`)
      if (state.attempts === config.failAt) {
        state.temp = 'NULL'
        add('injected-failure', 'inject', '教學輔助函式注入失敗，直接回傳 NULL，原區塊不受影響。')
        add('check', 'check', `temp 為 NULL，立即回傳失敗；保留 ${used} 筆紀錄與 ${capacity} 格容量。`)
        state.temp = '—'; state.next = null; state.pending = null
        state.output += `append failed at index=${i}\n`
        add('failed', 'failure-output', '呼叫端記錄失敗；本筆沒有寫入，也沒有增加 used。')
        status = 1
        add('break', 'break', '設定失敗狀態並停止加入，仍會輸出已接收資料並清理。')
        break
      }
      generation++
      rows = [...rows, ...Array.from({ length: next - capacity }, () => null)]
      state.rows = rows
      state.temp = `B${generation}`
      if (capacity > 0) state.data = '失效，待接回'
      add('resized', 'realloc', '成功取得新區塊；原有紀錄保留，新增空格尚未初始化。B 編號表示配置生命週期，與實際位址無關。')
      add('check', 'check', 'temp 非 NULL，可接回新的有效指標。成功後不讀取或比較舊指標。')
      state.data = state.temp
      add('adopt', 'adopt', '將有效指標接回 list.data。')
      capacity = next; state.capacity = next
      add('capacity', 'capacity', '接回指標之後，才更新 capacity。')
      state.temp = '—'; state.next = null
      add('scope', 'end-full', '擴充分支結束，temp 與 next 離開作用域；清單保留已接回的指標與容量。')
    }
    rows[used] = { ...state.pending! }
    state.rows = rows
    add('write', 'write', `先把完整紀錄寫入索引 ${used}；此格現在已有值，但尚未計入有效筆數。`)
    used++; state.used = used
    add('increment', 'increment', `used 增加為 ${used}，有效範圍是 [0, used)。`)
    state.temp = '—'; state.next = null; state.pending = null
    add('appended', 'return-append', '回傳成功；區域暫存與參數離開作用域，清單仍由 main 管理。')
  }
  state.i = null; state.revealed = true
  state.output += `used=${used}, capacity=${capacity}\n`
  add('summary', 'summary', '先輸出有效筆數與容量，再逐筆讀取已初始化的紀錄。')
  accepted = rows.slice(0, used).map(row => ({ ...row! }))
  accepted.forEach((row, i) => { state.i = i; state.output += `${row.id},${row.score}\n`; add('print', 'print', `輸出有效索引 ${i}，不讀取剩餘空格。`) })
  state.i = null
  if (capacity > 0) { state.releases++; state.data = '失效，待清空' }
  state.rows = null
  add('free', 'free', capacity > 0 ? '釋放最後仍持有的區塊一次。此時不再讀取原指標或紀錄。' : 'free(NULL) 不做任何事，沒有區塊需要釋放。')
  state.data = 'NULL'
  add('clear', 'clear', '直接把指標改寫為 NULL，不讀取先前的失效值。')
  state.used = 0; state.capacity = 0
  add('reset', 'reset', '清單回到空狀態：used 與 capacity 都是 0。')
  state.exitCode = status
  add('return', 'return', `回傳狀態 ${status}。配置失敗後的清理流程也已完成。`)
  state.used = null; state.capacity = null; state.data = '—'
  add('done', 'end-main', 'main 結束，清單離開作用域，主控台保留本次輸出。')
  return result(true)
}
