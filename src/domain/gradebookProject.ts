import type { OutputFileStatus } from './recordFile'
import { inspectRecordFields, RECORD_LINE_LIMIT, RECORD_PARSER_STATEMENTS, type ScoreRecordValue } from './recordFields'

export const GRADEBOOK_CAPACITY = 4
export const GRADEBOOK_QUERY_IDS = [101, 205, 330, 444, 509, 9999] as const
export const GRADEBOOK_DATASETS = {
  mixed: { label: '混合錯誤、重複與滿表', text: '101,75\n205,90\noops\n330,0\n444,88\n101,99\n509,100' },
  sparse: { label: '未填滿，包含長度邊界', text: '205,100\n\n000000330,0000\n0000000331,0090\n444,88' },
  empty: { label: '空檔案', text: '' },
} as const
export const GRADEBOOK_OUTCOMES = {
  success: 'I/O 正常', 'input-open-failure': '輸入檔開啟失敗', 'input-read-failure': '第一次讀取失敗',
  'report-open-failure': '報告檔開啟失敗', 'report-write-failure': '找到紀錄時寫入失敗', 'report-close-failure': '報告檔關閉回報錯誤',
} as const
export interface GradebookConfig {
  dataset: keyof typeof GRADEBOOK_DATASETS
  outcome: keyof typeof GRADEBOOK_OUTCOMES
  queryId: number
  updateDuplicate: boolean
}
export const DEFAULT_GRADEBOOK_CONFIG: Readonly<GradebookConfig> = {
  dataset: 'mixed', outcome: 'success', queryId: 205, updateDuplicate: false,
}
export function validateGradebookConfig(config: GradebookConfig): string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(GRADEBOOK_DATASETS, config.dataset)) issues.push('請選擇輸入資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(GRADEBOOK_OUTCOMES, config.outcome)) issues.push('請選擇 I/O 情境。')
  if (!GRADEBOOK_QUERY_IDS.some(id => id === config.queryId)) issues.push('請從清單選擇查詢編號。')
  if (typeof config.updateDuplicate !== 'boolean') issues.push('請選擇重複資料的處理方式。')
  return issues
}

export function buildGradebookSource(config: GradebookConfig = DEFAULT_GRADEBOOK_CONFIG) {
  const safe = validateGradebookConfig(config).length ? DEFAULT_GRADEBOOK_CONFIG : config
  const statements = [
    ...RECORD_PARSER_STATEMENTS,
    ['gap-search', ''], ['find', 'static int find_record(const Record rows[], int used, int id) {'],
    ['find-loop', '  for (int i = 0; i < used; ++i) {'], ['compare', '    if (rows[i].id == id) return i;'],
    ['end-find-loop', '  }'], ['missing', '  return -1;'], ['end-find', '}'], ['gap-main', ''],
    ['main', 'int main(void) {'], ['open-input', '  FILE *input = fopen("scores.txt", "r");'],
    ['input-open-check', '  if (input == NULL) {'], ['input-open-error', '    puts("input open failed");'], ['input-open-return', '    return 1;'], ['end-input-open', '  }'],
    ['capacity', `  enum { CAPACITY = ${GRADEBOOK_CAPACITY} };`], ['rows', '  Record rows[CAPACITY];'],
    ['buffer', `  char line[${RECORD_LINE_LIMIT + 2}];`], ['setup', '  int used = 0, invalid = 0, duplicates = 0, full = 0;'],
    ['read', '  while (fgets(line, sizeof line, input) != NULL) {'],
    ['length', "    if (strlen(line) == sizeof line - 1 && strchr(line, '\\n') == NULL) {"], ['ch', '      int ch;'],
    ['drain', "      do { ch = fgetc(input); } while (ch != '\\n' && ch != EOF);"], ['drain-error', '      if (ferror(input)) break;'],
    ['reject-long', '      ++invalid;'], ['skip-long', '      continue;'], ['end-length', '    }'],
    ['declare-record', '    Record record;'], ['parse-call', '    if (!parse_record(line, &record)) {'], ['reject', '      ++invalid;'], ['skip-invalid', '      continue;'], ['end-parse-check', '    }'],
    ['check-duplicate', '    int existing = find_record(rows, used, record.id);'], ['duplicate-if', '    if (existing >= 0) {'],
    ['duplicate', '      ++duplicates;'], ['update', `      if (${safe.updateDuplicate ? 1 : 0}) rows[existing] = record;`], ['skip-duplicate', '      continue;'], ['end-duplicate', '    }'],
    ['capacity-check', '    if (used == CAPACITY) {'], ['full', '      ++full;'], ['skip-full', '      continue;'], ['end-capacity', '    }'],
    ['insert', '    rows[used++] = record;'], ['end-load', '  }'],
    ['read-error', '  int read_failed = ferror(input);'], ['close-input', '  if (fclose(input) == EOF || read_failed) {'],
    ['input-io-error', '    puts("input I/O failed");'], ['input-io-return', '    return 2;'], ['end-input-close', '  }'],
    ['query', `  int index = find_record(rows, used, ${safe.queryId});`],
    ['open-report', '  FILE *report = fopen("lookup.txt", "w");'], ['report-open-check', '  if (report == NULL) {'],
    ['report-open-error', '    puts("report open failed");'], ['report-open-return', '    return 3;'], ['end-report-open', '  }'],
    ['write', '  int write_failed = index >= 0 && fprintf(report, "%d,%d\\n",'],
    ['write-values', '      rows[index].id, rows[index].score) < 0;'],
    ['close-report', '  if (fclose(report) == EOF || write_failed) {'], ['report-io-error', '    puts("report I/O failed");'],
    ['report-io-return', '    return 4;'], ['end-report-close', '  }'],
    ['print', '  printf("used=%d, invalid=%d, duplicates=%d, full=%d, index=%d\\n",'],
    ['print-values', '         used, invalid, duplicates, full, index);'], ['return', '  return 0;'], ['end-main', '}'],
  ] as const
  type Location = typeof statements[number][0]
  const locations = Object.fromEntries(statements.map(([key], index) => [key, index + 1])) as Record<Location, number>
  const lines = statements.map(([, code], index) => ({ lineNumber: index + 1, code }))
  return { lines, locations, sourceText: lines.map(line => line.code).join('\n') }
}

type SourceLocation = keyof ReturnType<typeof buildGradebookSource>['locations']
export type GradebookPhase = 'prepare' | 'blocked' | 'open-input' | 'setup' | 'read' | 'drain' | 'parse' | 'reject'
  | 'duplicate-search' | 'compare' | 'search-end' | 'duplicate' | 'duplicate-found' | 'update' | 'full' | 'insert' | 'read-end'
  | 'close-input' | 'query' | 'query-result' | 'open-report' | 'write' | 'close-report' | 'error' | 'print' | 'return' | 'done'
type RowDecision = 'invalid' | 'long' | 'inserted' | 'duplicate' | 'updated' | 'full'
export interface GradebookFrame {
  index: number
  phase: GradebookPhase
  activeLine: number
  activePart: string
  explanation: string
  slots: readonly (Readonly<ScoreRecordValue> | null)[]
  used: number
  invalid: number
  duplicates: number
  full: number
  line: string | null
  record: Readonly<ScoreRecordValue> | null
  decisions: readonly Readonly<{ row: number; text: string; result: RowDecision }>[]
  probe: Readonly<{ purpose: 'duplicate' | 'query'; id: number; index: number }> | null
  queryIndex: number | null
  reportStatus: OutputFileStatus
  report: string
  stdout: string
  exitCode: number | null
}

export function simulateGradebookProject(config: GradebookConfig = DEFAULT_GRADEBOOK_CONFIG) {
  const source = buildGradebookSource(config)
  const issues = validateGradebookConfig(config)
  const frames: GradebookFrame[] = []
  const state: Omit<GradebookFrame, 'index' | 'phase' | 'activeLine' | 'activePart' | 'explanation'> = {
    slots: Array<null>(GRADEBOOK_CAPACITY).fill(null), used: 0, invalid: 0, duplicates: 0, full: 0, line: null, record: null,
    decisions: [], probe: null, queryIndex: null, reportStatus: 'absent', report: '', stdout: '', exitCode: null,
  }
  function add(phase: GradebookPhase, location: SourceLocation, explanation: string) {
    const activeLine = source.locations[location]
    frames.push({ ...state, index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation })
  }
  function finish(code: number, location: SourceLocation) {
    state.exitCode = code
    add('return', location, `main 回傳 ${code}。`)
    add('done', 'end-main', '執行結束，保留最後一次的資料表與報告快照。')
    return { source, frames, status: 'completed' as const, exitCode: code, stdout: state.stdout, report: state.report, reportStatus: state.reportStatus }
  }
  function error(code: number, location: SourceLocation, returnLocation: SourceLocation, message: string) {
    state.stdout = `${message}\n`
    add('error', location, '輸出 I/O 錯誤訊息。')
    return finish(code, returnLocation)
  }
  function findRecord(id: number, purpose: 'duplicate' | 'query') {
    for (let index = 0; index < state.used; index++) {
      state.probe = { purpose, id, index }
      const found = state.slots[index]?.id === id
      add('compare', 'compare', found ? `rows[${index}] 的編號相同，回傳 ${index}。` : `rows[${index}] 的編號不同，繼續查找。`)
      if (found) {
        state.probe = null
        return index
      }
    }
    state.probe = null
    add('search-end', 'missing', '已檢查有效範圍，查無編號，回傳 -1。')
    return -1
  }
  function decide(row: number, text: string, result: RowDecision) {
    state.decisions = [...state.decisions, { row, text: text.replace(/\n$/, ''), result }]
  }
  function setSlot(index: number, record: ScoreRecordValue) {
    state.slots = state.slots.map((slot, slotIndex) => slotIndex === index ? record : slot)
  }

  add('prepare', 'main', '先讀檔建立資料表，再查詢編號並輸出報告。')
  if (issues.length) {
    add('blocked', 'main', issues.join(' '))
    return { source, frames, status: 'blocked' as const, exitCode: null, stdout: '', report: '', reportStatus: state.reportStatus }
  }
  add('open-input', 'open-input', config.outcome === 'input-open-failure' ? '輸入檔開啟失敗。' : '開啟 scores.txt。')
  if (config.outcome === 'input-open-failure') return error(1, 'input-open-error', 'input-open-return', 'input open failed')
  add('setup', 'setup', '建立四格陣列。used 為 0，尚無可查詢的紀錄。')
  const lines = GRADEBOOK_DATASETS[config.dataset].text.match(/[^\n]*\n|[^\n]+$/g) ?? []
  if (config.outcome !== 'input-read-failure') {
    for (const [index, text] of lines.entries()) {
      const row = index + 1
      state.line = text.slice(0, RECORD_LINE_LIMIT + 1)
      state.record = null
      add('read', 'read', `讀取第 ${row} 行。`)
      if (state.line.length === RECORD_LINE_LIMIT + 1 && !state.line.endsWith('\n')) {
        add('drain', 'drain', '這行太長，讀到換行或 EOF。')
        state.invalid++
        decide(row, text, 'long')
        add('reject', 'reject-long', '整筆列為無效。')
        continue
      }
      const fields = inspectRecordFields(text)
      state.record = fields.record
      add('parse', 'parse-call', fields.record ? '兩欄驗證成功，得到暫存的 Record。' : '欄位驗證失敗。')
      if (fields.record === null) {
        state.invalid++
        decide(row, text, 'invalid')
        add('reject', 'reject', '無效紀錄略過。')
        continue
      }
      add('duplicate-search', 'check-duplicate', `先在已存範圍內查找 ${fields.record.id}。`)
      const existing = findRecord(fields.record.id, 'duplicate')
      if (existing >= 0) {
        state.duplicates++
        if (config.updateDuplicate) {
          add('duplicate-found', 'duplicate', '發現重複編號，準備更新既有位置。')
          setSlot(existing, fields.record)
          decide(row, text, 'updated')
          add('update', 'update', `更新 rows[${existing}]，used 維持不變。`)
        } else {
          decide(row, text, 'duplicate')
          add('duplicate', 'duplicate', '保留第一筆，重複編號不佔新空間。')
        }
        continue
      }
      if (state.used === GRADEBOOK_CAPACITY) {
        state.full++
        decide(row, text, 'full')
        add('full', 'full', '新編號遇到滿表，略過這筆。')
        continue
      }
      const slot = state.used
      setSlot(slot, fields.record)
      state.used++
      decide(row, text, 'inserted')
      add('insert', 'insert', `寫入 rows[${slot}]，再把 used 加一。`)
    }
  }
  state.line = null
  state.record = null
  add('read-end', 'read-error', config.outcome === 'input-read-failure' ? 'ferror 確認讀取失敗。' : '已到 EOF，檢查錯誤指示。')
  add('close-input', 'close-input', '關閉輸入檔。')
  if (config.outcome === 'input-read-failure') return error(2, 'input-io-error', 'input-io-return', 'input I/O failed')
  add('query', 'query', `在前 ${state.used} 格查詢編號 ${config.queryId}。`)
  state.queryIndex = findRecord(config.queryId, 'query')
  add('query-result', 'query', state.queryIndex >= 0 ? `找到索引 ${state.queryIndex}。` : '查無資料，結果為 -1。')
  if (config.outcome === 'report-open-failure') {
    add('open-report', 'open-report', '報告檔開啟失敗。')
    return error(3, 'report-open-error', 'report-open-return', 'report open failed')
  }
  state.reportStatus = 'open'
  add('open-report', 'open-report', '開啟 lookup.txt。')
  const found = state.queryIndex >= 0 ? state.slots[state.queryIndex] : null
  const writeFailed = found != null && config.outcome === 'report-write-failure'
  if (found && !writeFailed) state.report = `${found.id},${found.score}\n`
  add('write', 'write', found ? writeFailed ? 'fprintf 回報失敗。' : '把找到的紀錄交給輸出串流。' : 'index 小於 0，短路判斷略過寫入。')
  state.reportStatus = config.outcome === 'report-close-failure' ? 'unconfirmed' : writeFailed ? 'incomplete' : 'confirmed'
  add('close-report', 'close-report', state.reportStatus === 'confirmed' ? '報告檔已成功關閉。' : '關檔後回報本次輸出失敗。')
  if (state.reportStatus !== 'confirmed') return error(4, 'report-io-error', 'report-io-return', 'report I/O failed')
  state.stdout = `used=${state.used}, invalid=${state.invalid}, duplicates=${state.duplicates}, full=${state.full}, index=${state.queryIndex}\n`
  add('print', 'print', '輸出資料表摘要與查詢索引。')
  return finish(0, 'return')
}
