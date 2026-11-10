import { inspectRecordFields, RECORD_LINE_LIMIT, RECORD_PARSER_STATEMENTS } from './recordFields'
import {
  RECORD_FILE_DATASETS,
  type RecordFileConfig,
  DEFAULT_RECORD_FILE_CONFIG,
  validateRecordFileConfig,
} from './recordFileConfig'

export {
  RECORD_FILE_DATASETS,
  RECORD_FILE_OUTCOMES,
  type RecordFileConfig,
  DEFAULT_RECORD_FILE_CONFIG,
  validateRecordFileConfig,
} from './recordFileConfig'

export { RECORD_LINE_LIMIT } from './recordFields'

export function buildRecordFileSource(config: RecordFileConfig = DEFAULT_RECORD_FILE_CONFIG) {
  const safe = validateRecordFileConfig(config).length ? DEFAULT_RECORD_FILE_CONFIG : config
  const statements = [
    ...RECORD_PARSER_STATEMENTS,
    ['gap-main', ''], ['main', 'int main(void) {'],
    ['open-input', '  FILE *input = fopen("scores.txt", "r");'],
    ['check-input', '  if (input == NULL) {'], ['print-input-error', '    puts("input open failed");'], ['return-input-error', '    return 1;'], ['end-input-check', '  }'],
    ['open-output', '  FILE *output = fopen("selected.txt", "w");'], ['check-output', '  if (output == NULL) {'],
    ['close-on-open-error', '    if (fclose(input) == EOF) {'], ['print-early-close-error', '      puts("I/O failed");'],
    ['return-early-close-error', '      return 3;'], ['end-early-close-check', '    }'],
    ['print-output-error', '    puts("output open failed");'], ['return-output-error', '    return 2;'], ['end-output-check', '  }'],
    ['setup-buffer', `  char line[${RECORD_LINE_LIMIT + 2}];`], ['setup-counts', '  int valid = 0, rejected = 0, written = 0, failed = 0;'],
    ['read', '  while (fgets(line, sizeof line, input) != NULL) {'],
    ['length', "    if (strlen(line) == sizeof line - 1 && strchr(line, '\\n') == NULL) {"],
    ['declare-tail', '      int ch;'], ['drain', "      do { ch = fgetc(input); } while (ch != '\\n' && ch != EOF);"],
    ['drain-error', '      if (ferror(input)) break;'], ['reject-long', '      ++rejected;'], ['continue-long', '      continue;'], ['end-length', '    }'],
    ['declare-record', '    Record record;'], ['parse-call', '    if (!parse_record(line, &record)) {'],
    ['reject', '      ++rejected;'], ['continue-invalid', '      continue;'], ['end-record-check', '    }'],
    ['accept', '    ++valid;'], ['threshold', `    if (record.score >= ${safe.minimumScore}) {`],
    ['write', '      if (fprintf(output, "%d,%d\\n", record.id, record.score) < 0) {'],
    ['fail-write', '        failed = 1;'], ['stop-write', '        break;'], ['end-write-check', '      }'],
    ['count-write', '      ++written;'], ['end-threshold', '    }'], ['end-loop', '  }'],
    ['check-read-error', '  if (ferror(input)) failed = 1;'], ['close-input', '  if (fclose(input) == EOF) failed = 1;'],
    ['close-output', '  if (fclose(output) == EOF) failed = 1;'], ['check-io', '  if (failed) {'],
    ['print-io-error', '    puts("I/O failed");'], ['return-io-error', '    return 3;'], ['end-io-check', '  }'],
    ['print', '  printf("valid=%d, rejected=%d, written=%d\\n", valid, rejected, written);'],
    ['return-main', '  return 0;'], ['end-main', '}'],
  ] as const
  type Location = typeof statements[number][0]
  const locations = Object.fromEntries(statements.map(([key], index) => [key, index + 1])) as Record<Location, number>
  const lines = statements.map(([, code], index) => ({ lineNumber: index + 1, code }))
  return { lines, locations, sourceText: lines.map(line => line.code).join('\n') }
}

type SourceLocation = keyof ReturnType<typeof buildRecordFileSource>['locations']
export type RecordFilePhase = 'prepare' | 'blocked' | 'open-input' | 'open-output' | 'setup' | 'read' | 'length' | 'drain'
  | 'parse-id' | 'check-id' | 'comma' | 'parse-score' | 'check-score' | 'tail' | 'store' | 'reject' | 'accept'
  | 'skip' | 'qualify' | 'write' | 'written' | 'write-failed' | 'read-end' | 'check-read-error'
  | 'close-input' | 'close-output' | 'print-error' | 'print' | 'return' | 'done'
export type RecordDecision = 'too-long' | 'id' | 'separator' | 'score' | 'tail' | 'below' | 'written' | 'write-error'
export type OutputFileStatus = 'absent' | 'open' | 'confirmed' | 'incomplete' | 'unconfirmed'

export interface RecordFileFrame {
  index: number
  phase: RecordFilePhase
  activeLine: number
  activePart: string
  explanation: string
  row: number
  chunk: string | null
  end: number | null
  idValue: string | null
  scoreValue: string | null
  record: Readonly<{ id: number; score: number }> | null
  decisions: readonly Readonly<{ row: number; text: string; result: RecordDecision }>[]
  valid: number
  rejected: number
  written: number
  inputStatus: 'absent' | 'open' | 'closed'
  outputStatus: OutputFileStatus
  outputText: string
  stdout: string
  exitCode: number | null
}

export function simulateRecordFileProgram(config: RecordFileConfig = DEFAULT_RECORD_FILE_CONFIG) {
  const source = buildRecordFileSource(config)
  const issues = validateRecordFileConfig(config)
  const frames: RecordFileFrame[] = []
  const state: Omit<RecordFileFrame, 'index' | 'phase' | 'activeLine' | 'activePart' | 'explanation'> = {
    row: 0, chunk: null, end: null, idValue: null, scoreValue: null, record: null, decisions: [],
    valid: 0, rejected: 0, written: 0, inputStatus: 'absent', outputStatus: 'absent', outputText: '', stdout: '', exitCode: null,
  }
  function add(phase: RecordFilePhase, location: SourceLocation, explanation: string) {
    const activeLine = source.locations[location]
    frames.push({ ...state, index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation })
  }
  function result(status: 'completed' | 'blocked') {
    const { exitCode, stdout, outputText, outputStatus, valid, rejected, written } = state
    return { source, frames, status, exitCode, stdout, outputText, outputStatus, valid, rejected, written }
  }
  function finish(exitCode: number, location: SourceLocation) {
    state.exitCode = exitCode
    add('return', location, `main 回傳 ${exitCode}。`)
    add('done', 'end-main', '執行結束，保留逐筆判定與輸出結果。')
    return result('completed')
  }
  function decide(text: string, decision: RecordDecision) {
    state.decisions = [...state.decisions, { row: state.row, text: text.replace(/\n$/, ''), result: decision }]
  }

  add('prepare', 'type', 'Record 用兩個 int 保存通過驗證的 id 與 score。')
  if (issues.length) {
    add('blocked', 'main', issues.join(' '))
    return result('blocked')
  }
  const { outcome, minimumScore } = config
  if (outcome === 'input-open-failure') {
    add('open-input', 'open-input', '輸入檔開啟失敗，fopen 回傳 NULL。')
    state.stdout = 'input open failed\n'
    add('print-error', 'print-input-error', '在開啟輸出檔前結束。')
    return finish(1, 'return-input-error')
  }
  state.inputStatus = 'open'
  add('open-input', 'open-input', '以 r 模式開啟 scores.txt。')
  if (outcome === 'output-open-failure') {
    add('open-output', 'open-output', '輸出檔開啟失敗，fopen 回傳 NULL。')
    state.inputStatus = 'closed'
    add('close-input', 'close-on-open-error', '關閉已成功開啟的輸入檔。')
    state.stdout = 'output open failed\n'
    add('print-error', 'print-output-error', '輸出開檔失敗訊息。')
    return finish(2, 'return-output-error')
  }
  state.outputStatus = 'open'
  add('open-output', 'open-output', '以 w 模式開啟 selected.txt，準備寫入新的內容。')
  add('setup', 'setup-counts', '合法、拒絕與已寫入筆數各自從 0 開始。')
  let failed = false
  const rows = RECORD_FILE_DATASETS[config.dataset].text.match(/[^\n]*\n|[^\n]+$/g) ?? []
  if (outcome !== 'read-failure') {
    for (const text of rows) {
      state.row += 1
      state.chunk = text.slice(0, RECORD_LINE_LIMIT + 1)
      state.end = null
      state.idValue = null
      state.scoreValue = null
      state.record = null
      add('read', 'read', `讀取第 ${state.row} 行的第一段。`)
      const tooLong = state.chunk.length === RECORD_LINE_LIMIT + 1 && !state.chunk.endsWith('\n')
      add('length', 'length', tooLong ? '緩衝區已讀滿且沒有換行，整行超過限制。' : '長度合格，可以開始解析。')
      const reject = (reason: RecordDecision, location: 'reject' | 'reject-long') => {
        state.rejected += 1
        decide(text, reason)
        add('reject', location, '拒絕整筆紀錄，rejected 加一。')
      }
      if (tooLong) {
        add('drain', 'drain', '讀到換行或 EOF，下一次從下一行開始。')
        reject('too-long', 'reject-long')
        continue
      }
      const fields = inspectRecordFields(text)
      state.idValue = fields.idValue
      state.end = fields.idEnd
      add('parse-id', 'parse-id', '轉換 id，記住 end 停止的位置。')
      add('check-id', 'check-id', fields.error === 'id' ? 'id 缺少數字或超出範圍。' : 'id 介於 1 到 9999。')
      if (fields.error === 'id') { reject('id', 'reject'); continue }
      add('comma', 'comma', fields.error === 'separator' ? 'id 後方需要一個逗號。' : 'end 指在逗號，下一格是 score 的起點。')
      if (fields.error === 'separator') { reject('separator', 'reject'); continue }
      state.scoreValue = fields.scoreValue
      state.end = fields.scoreEnd
      add('parse-score', 'parse-score', '從逗號後轉換 score，再次更新 end。')
      add('check-score', 'check-score', fields.error === 'score' ? 'score 缺少數字或超出範圍。' : 'score 介於 0 到 100。')
      if (fields.error === 'score') { reject('score', 'reject'); continue }
      state.end = fields.tailEnd
      add('tail', 'tail', fields.error === 'tail' ? '分數後仍有多餘字元。' : '略過可有可無的換行後，抵達字串終點。')
      if (fields.error === 'tail' || fields.record === null) { reject('tail', 'reject'); continue }
      state.record = fields.record
      add('store', 'store', '所有欄位與尾端都合格，現在才填入 Record。')
      state.valid += 1
      add('accept', 'accept', 'valid 加一，接著判斷輸出門檻。')
      if (state.record.score < minimumScore) {
        decide(text, 'below')
        add('skip', 'threshold', '這筆紀錄合法，分數低於輸出門檻。')
        continue
      }
      add('qualify', 'threshold', '分數達到門檻，準備格式化輸出。')
      if (outcome === 'write-failure') {
        add('write', 'write', 'fprintf 回傳負值。')
        failed = true
        decide(text, 'write-error')
        add('write-failed', 'fail-write', '記下 I/O 錯誤並跳出迴圈，接著關閉檔案。')
        break
      }
      state.outputText += `${state.record.id},${state.record.score}\n`
      add('write', 'write', '格式化成 id,score 並交給輸出串流。')
      state.written += 1
      decide(text, 'written')
      add('written', 'count-write', 'fprintf 成功，written 加一，最後還要檢查關檔。')
    }
  }
  state.chunk = null
  state.end = null
  state.idValue = null
  state.scoreValue = null
  state.record = null
  if (!failed) {
    add('read-end', 'read', outcome === 'read-failure' ? 'fgets 回傳 NULL，讀取發生錯誤。' : 'fgets 回傳 NULL，輸入已到 EOF。')
  }
  if (outcome === 'read-failure') failed = true
  add('check-read-error', 'check-read-error', outcome === 'read-failure' ? 'ferror 確認輸入錯誤。' : '檢查輸入串流的錯誤指示。')
  state.inputStatus = 'closed'
  add('close-input', 'close-input', '關閉輸入檔。')
  state.outputStatus = outcome === 'close-failure' ? 'unconfirmed' : failed ? 'incomplete' : 'confirmed'
  if (outcome === 'close-failure') failed = true
  add('close-output', 'close-output', state.outputStatus === 'confirmed' ? '輸出檔成功關閉，現在可以確認結果。' : '輸出串流已關閉，本次執行有 I/O 錯誤。')
  if (failed) {
    state.stdout = 'I/O failed\n'
    add('print-error', 'print-io-error', '回報 I/O 失敗。')
    return finish(3, 'return-io-error')
  }
  state.stdout = `valid=${state.valid}, rejected=${state.rejected}, written=${state.written}\n`
  add('print', 'print', '輸出三個計數，完成篩選。')
  return finish(0, 'return-main')
}
