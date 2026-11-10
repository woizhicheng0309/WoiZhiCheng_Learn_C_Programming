import { simulateIntegerParsingProgram } from './integerParsing'

export const RECORD_FILE_DATASETS = {
  mixed: { label: '混合格式錯誤與合法分數', text: '10,80\n11;95\n0,75\n12,101\n13,60\n14,88,1\n15,100' },
  boundary: { label: '長度邊界與過長行', text: '000000001,0060\n0000000002,0099\n9999,0\n3,100' },
  empty: { label: '空檔案', text: '' },
  malformed: { label: '空欄、分數尾端與合法零分', text: '\n1,\n2,6x\n3, 0\n4,60 \n5,60' },
} as const

export const RECORD_FILE_OUTCOMES = {
  success: 'I/O 正常',
  'input-open-failure': '輸入檔開啟失敗',
  'output-open-failure': '輸出檔開啟失敗',
  'read-failure': '第一次讀取失敗',
  'write-failure': '第一次符合門檻的寫入失敗',
  'close-failure': '輸出檔關閉回報錯誤',
} as const

export interface RecordFileConfig {
  dataset: keyof typeof RECORD_FILE_DATASETS
  outcome: keyof typeof RECORD_FILE_OUTCOMES
  minimumScore: number
}

export const DEFAULT_RECORD_FILE_CONFIG: Readonly<RecordFileConfig> = { dataset: 'mixed', outcome: 'success', minimumScore: 70 }
export const RECORD_LINE_LIMIT = 14

export function validateRecordFileConfig(config: RecordFileConfig): string[] {
  const issues: string[] = []
  if (typeof config.dataset !== 'string' || !Object.hasOwn(RECORD_FILE_DATASETS, config.dataset)) issues.push('請選擇有效的輸入資料。')
  if (typeof config.outcome !== 'string' || !Object.hasOwn(RECORD_FILE_OUTCOMES, config.outcome)) issues.push('請選擇有效的 I/O 情境。')
  if (!Number.isInteger(config.minimumScore) || config.minimumScore < 0 || config.minimumScore > 100) issues.push('門檻須為 0 到 100 的整數。')
  return issues
}

export function buildRecordFileSource(config: RecordFileConfig = DEFAULT_RECORD_FILE_CONFIG) {
  const safe = validateRecordFileConfig(config).length ? DEFAULT_RECORD_FILE_CONFIG : config
  const statements = [
    ['stdio', '#include <stdio.h>'], ['stdlib', '#include <stdlib.h>'], ['string', '#include <string.h>'], ['errno', '#include <errno.h>'],
    ['gap-type', ''], ['type', 'typedef struct { int id; int score; } Record;'], ['gap-parse', ''],
    ['parse', 'static int parse_record(const char *line, Record *record) {'],
    ['end', '  char *end;'], ['reset-id', '  errno = 0;'], ['parse-id', '  long id = strtol(line, &end, 10);'],
    ['check-id', '  if (end == line || errno == ERANGE || id < 1 || id > 9999) return 0;'],
    ['comma', "  if (*end != ',') return 0;"], ['score-start', '  const char *start = end + 1;'],
    ['reset-score', '  errno = 0;'], ['parse-score', '  long score = strtol(start, &end, 10);'],
    ['check-score', '  if (end == start || errno == ERANGE || score < 0 || score > 100) return 0;'],
    ['newline', "  if (*end == '\\n') ++end;"], ['tail', "  if (*end != '\\0') return 0;"],
    ['store', '  *record = (Record){(int)id, (int)score};'], ['return-valid', '  return 1;'], ['end-parse', '}'],
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
      const id = simulateIntegerParsingProgram({ text, longBits: 64, allowTrailingSpace: false })
      state.idValue = id.value
      state.end = id.conversionEnd
      add('parse-id', 'parse-id', '轉換 id，記住 end 停止的位置。')
      const idValid = id.conversionEnd !== 0 && id.errno !== 'ERANGE' && Number(id.value) >= 1 && Number(id.value) <= 9999
      add('check-id', 'check-id', idValid ? 'id 介於 1 到 9999。' : 'id 缺少數字或超出範圍。')
      if (!idValid) { reject('id', 'reject'); continue }
      const comma = id.conversionEnd!
      add('comma', 'comma', text[comma] === ',' ? 'end 指在逗號，下一格是 score 的起點。' : 'id 後方需要一個逗號。')
      if (text[comma] !== ',') { reject('separator', 'reject'); continue }
      const start = comma + 1
      const score = simulateIntegerParsingProgram({ text: text.slice(start), longBits: 64, allowTrailingSpace: false })
      state.scoreValue = score.value
      state.end = start + score.conversionEnd!
      add('parse-score', 'parse-score', '從逗號後轉換 score，再次更新 end。')
      const scoreValid = score.conversionEnd !== 0 && score.errno !== 'ERANGE' && Number(score.value) >= 0 && Number(score.value) <= 100
      add('check-score', 'check-score', scoreValid ? 'score 介於 0 到 100。' : 'score 缺少數字或超出範圍。')
      if (!scoreValid) { reject('score', 'reject'); continue }
      if (text[state.end] === '\n') state.end += 1
      add('tail', 'tail', state.end === text.length ? '略過可有可無的換行後，抵達字串終點。' : '分數後仍有多餘字元。')
      if (state.end !== text.length) { reject('tail', 'reject'); continue }
      state.record = { id: Number(id.value), score: Number(score.value) }
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
