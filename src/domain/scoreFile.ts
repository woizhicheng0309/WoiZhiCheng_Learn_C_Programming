import { isAsciiSpace, simulateIntegerParsingProgram } from './integerParsing'
import { type FileStreamStatus } from './fileReading'
import {
  SCORE_FILE_DATASETS,
  type ScoreFileConfig,
  DEFAULT_SCORE_FILE_CONFIG,
  validateScoreFileConfig,
} from './scoreFileConfig'

export {
  SCORE_FILE_DATASETS,
  SCORE_FILE_OUTCOMES,
  type ScoreFileConfig,
  DEFAULT_SCORE_FILE_CONFIG,
  validateScoreFileConfig,
} from './scoreFileConfig'

export const SCORE_BUFFER_SIZE = 12

export function buildScoreFileSource(config: ScoreFileConfig = DEFAULT_SCORE_FILE_CONFIG) {
  const safe = validateScoreFileConfig(config).length ? DEFAULT_SCORE_FILE_CONFIG : config
  const statements = [
    ['include-stdio', '#include <stdio.h>'], ['include-stdlib', '#include <stdlib.h>'], ['include-errno', '#include <errno.h>'], ['include-ctype', '#include <ctype.h>'],
    ['blank', ''], ['main', 'int main(void) {'], ['open', '  FILE *fp = fopen("scores.txt", "r");'],
    ['check-open', '  if (fp == NULL) {'], ['print-open', '    puts("open failed");'], ['return-open', '    return 1;'], ['end-open', '  }'],
    ['buffer', `  char line[${SCORE_BUFFER_SIZE}];`], ['collector', '  size_t used = 0; int too_long = 0;'], ['counters', '  int accepted = 0, rejected = 0, sum = 0;'],
    ['policy', `  int stop_on_invalid = ${Number(safe.stopOnInvalid)};`], ['stopped', '  int stopped = 0;'], ['loop', '  for (;;) {'],
    ['read', '    int ch = fgetc(fp);'], ['read-error', '    if (ch == EOF && ferror(fp)) break;'],
    ['empty-eof', '    if (ch == EOF && used == 0 && !too_long) break;'],
    ['character', "    if (ch != EOF && ch != '\\n') {"], ['capacity', '      if (used < sizeof line - 1) {'],
    ['append', '        line[used++] = (char)ch;'], ['else-capacity', '      } else {'], ['too-long', '        too_long = 1;'], ['end-capacity', '      }'],
    ['continue', '      continue;'], ['end-character', '    }'], ['terminate', "    line[used] = '\\0';"],
    ['valid', '    int valid = !too_long;'], ['end-pointer', '    char *end;'], ['clear-errno', '    errno = 0;'],
    ['convert', '    long value = strtol(line, &end, 10);'],
    ['check-conversion', '    if (end == line || errno == ERANGE) valid = 0;'],
    ['tail-condition', '    while (isspace((unsigned char)*end)) {'], ['advance-end', '      end++;'], ['end-tail', '    }'],
    ['check-score', "    if (*end != '\\0' || value < 0 || value > 100) valid = 0;"],
    ['check-valid', '    if (valid) {'], ['accept', '      accepted++;'], ['sum', '      sum += (int)value;'], ['else-valid', '    } else {'],
    ['reject', '      rejected++;'], ['end-valid', '    }'], ['stop-condition', '    if (!valid && stop_on_invalid) {'],
    ['stop', '      stopped = 1;'], ['break-invalid', '      break;'], ['end-stop', '    }'],
    ['reset', '    used = 0; too_long = 0;'], ['final-eof', '    if (ch == EOF) break;'], ['end-loop', '  }'],
    ['capture-error', '  int read_failed = ferror(fp) != 0;'], ['close', '  int close_failed = fclose(fp) != 0;'],
    ['check-io', '  if (read_failed || close_failed) {'], ['print-io', '    puts("I/O failed");'], ['return-io', '    return 2;'], ['end-io', '  }'],
    ['print-status', '  puts(stopped ? "partial" : "complete");'], ['print-summary', '  printf("accepted=%d, rejected=%d, sum=%d\\n", accepted, rejected, sum);'],
    ['average-condition', '  if (accepted > 0) {'], ['print-average', '    printf("average=%.2f\\n", (double)sum / accepted);'],
    ['else-average', '  } else {'], ['print-no-average', '    puts("average=N/A");'], ['end-average', '  }'],
    ['return', '  return stopped ? 3 : 0;'], ['end-main', '}'],
  ] as const
  const locations = Object.fromEntries(statements.map(([key], index) => [key, index + 1])) as Record<(typeof statements)[number][0], number>
  return { lines: statements.map(([, code], index) => ({ lineNumber: index + 1, code })), sourceText: statements.map(([, code]) => code).join('\n'), locations }
}
type SourceLocation = keyof ReturnType<typeof buildScoreFileSource>['locations']
export type ScoreFilePhase = 'prepare' | 'enter-main' | 'open' | 'check-open' | 'print-open' | 'return-open'
  | 'declare-buffer' | 'initialize-collector' | 'initialize-counters' | 'set-policy' | 'initialize-stopped'
  | 'read' | 'read-error' | 'empty-eof' | 'check-character' | 'check-capacity' | 'append' | 'too-long' | 'continue'
  | 'terminate' | 'initialize-valid' | 'declare-end' | 'clear-errno' | 'convert' | 'check-conversion' | 'tail-condition' | 'advance-end'
  | 'check-score' | 'check-valid' | 'accept' | 'sum' | 'reject' | 'stop-condition' | 'stop' | 'break-invalid' | 'reset' | 'final-eof'
  | 'capture-error' | 'close' | 'check-io' | 'print-io' | 'return-io' | 'print-status' | 'print-summary' | 'average-condition'
  | 'print-average' | 'print-no-average' | 'return' | 'done' | 'blocked'
export type ScoreRecordReason = 'accepted' | 'too-long' | 'no-digits' | 'long-range' | 'trailing-data' | 'score-range'
export interface ScoreRecord { index: number; text: string; reason: ScoreRecordReason; value: string }
export interface ScoreFileFrame {
  index: number; phase: ScoreFilePhase; activeLine: number; activePart: string; explanation: string
  mainInScope: boolean; iterationInScope: boolean; pointer: 'undeclared' | 'stream' | 'null' | 'invalidated'; streamStatus: FileStreamStatus
  position: number | null; eof: boolean | null; error: boolean | null; ch: number | 'EOF' | null
  buffer: readonly (string | null)[] | null; used: number | null; tooLong: boolean | null; terminated: boolean
  accepted: number | null; rejected: number | null; sum: number | null; stopped: boolean | null; stopOnInvalid: boolean | null
  valid: boolean | null; endDeclared: boolean; endIndex: number | null; conversionEnd: number | null; value: string | null; errno: 'unknown' | '0' | 'ERANGE'
  readFailed: boolean | null; closeFailed: boolean | null; records: readonly ScoreRecord[]
  condition: { expression: string; value: boolean } | null; predictionValues: readonly number[] | null; exitCode: number | null; output: readonly string[]
}
export function simulateScoreFileProgram(config: ScoreFileConfig = DEFAULT_SCORE_FILE_CONFIG) {
  const stableConfig = { dataset: config.dataset, outcome: config.outcome, stopOnInvalid: config.stopOnInvalid }
  const source = buildScoreFileSource(stableConfig), issues = validateScoreFileConfig(stableConfig)
  const frames: ScoreFileFrame[] = [], records: ScoreRecord[] = [], output: string[] = []
  let mainInScope = false, iterationInScope = false
  let pointer: ScoreFileFrame['pointer'] = 'undeclared', streamStatus: FileStreamStatus = 'not-opened'
  let position: number | null = null, eof: boolean | null = null, error: boolean | null = null, ch: ScoreFileFrame['ch'] = null
  let buffer: (string | null)[] | null = null, used: number | null = null, tooLong: boolean | null = null, terminated = false
  let accepted: number | null = null, rejected: number | null = null, sum: number | null = null
  let stopped: boolean | null = null, stopOnInvalid: boolean | null = null, valid: boolean | null = null, endDeclared = false
  let endIndex: number | null = null, conversionEnd: number | null = null, value: string | null = null, errno: ScoreFileFrame['errno'] = 'unknown'
  let readFailed: boolean | null = null, closeFailed: boolean | null = null, predictionValues: number[] | null = null, exitCode: number | null = null
  let closeCalls = 0, attempts = 0, recordStart = 0
  const add = (phase: ScoreFilePhase, location: SourceLocation, explanation: string, condition: ScoreFileFrame['condition'] = null) => {
    const activeLine = source.locations[location]
    frames.push({ index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation, mainInScope, iterationInScope,
      pointer, streamStatus, position, eof, error, ch, buffer: buffer ? [...buffer] : null, used, tooLong, terminated,
      accepted, rejected, sum, stopped, stopOnInvalid, valid, endDeclared, endIndex, conversionEnd, value, errno, readFailed, closeFailed,
      records: records.map(record => ({ ...record })), condition: condition ? { ...condition } : null,
      predictionValues: predictionValues ? [...predictionValues] : null, exitCode, output: [...output] })
  }
  const result = (status: 'completed' | 'blocked', message: string) => ({ config: stableConfig, source, frames, status, message,
    accepted: accepted ?? 0, rejected: rejected ?? 0, sum: sum ?? 0,
    average: accepted && sum !== null && !readFailed && !closeFailed ? sum / accepted : null,
    stopped, position, closeCalls, attempts, records: records.map(record => ({ ...record })), exitCode, output: [...output], stdout: output.join('') })
  const finish = (code: number, phase: ScoreFilePhase, location: SourceLocation) => {
    exitCode = code; predictionValues = [accepted ?? 0, rejected ?? 0, sum ?? 0]
    add(phase, location, `main 回傳 ${code}；預測以實際接受、拒絕與加總事件數揭曉。`)
    mainInScope = false; iterationInScope = false
    add('done', 'end-main', 'main 結束，區域變數離開作用域，保留輸出與逐筆判定紀錄。')
    return result('completed', `main 回傳 ${code}。`)
  }
  add('prepare', 'main', '先預測接受筆數、拒絕筆數與總和，再追蹤完整紀錄的收集與驗證。')
  if (issues.length) { add('blocked', 'main', issues.join(' ')); return result('blocked', issues.join(' ')) }
  const text = SCORE_FILE_DATASETS[stableConfig.dataset].text
  mainInScope = true; add('enter-main', 'main', '進入 main，本課虛擬檔案為 ASCII、C locale；long 以 32 位元二補數模型示意。')
  const opened = stableConfig.outcome !== 'open-failure'
  pointer = opened ? 'stream' : 'null'; streamStatus = opened ? 'open' : 'not-opened'
  if (opened) { position = 0; eof = false; error = false }
  add('open', 'open', opened ? '成功開啟 scores.txt 的文字串流。' : '開啟失敗，fp 為 NULL。')
  add('check-open', 'check-open', opened ? 'fp 不是 NULL，繼續建立統計資料。' : 'fp == NULL，不能讀取或關閉。', { expression: 'fp == NULL', value: !opened })
  if (!opened) { output.push('open failed\n'); add('print-open', 'print-open', '輸出開啟失敗；統計變數尚未建立。'); return finish(1, 'return-open', 'return-open') }
  buffer = Array(SCORE_BUFFER_SIZE).fill(null); add('declare-buffer', 'buffer', '建立 12 格陣列，內容尚未初始化。最多保存 11 個資料字元，預留結尾空字元。')
  used = 0; tooLong = false; add('initialize-collector', 'collector', '目前已保存字元數為 0，尚未發現過長紀錄。')
  accepted = 0; rejected = 0; sum = 0; add('initialize-counters', 'counters', '接受、拒絕與總和歸零；只有通過整筆驗證的值能加入 sum。')
  stopOnInvalid = stableConfig.stopOnInvalid; add('set-policy', 'policy', '設定遇到無效紀錄時，繼續或提早停止的策略。')
  stopped = false; add('initialize-stopped', 'stopped', '尚未因無效紀錄提早停止。')
  while (true) {
    iterationInScope = true; valid = null; endDeclared = false; endIndex = null; conversionEnd = null; value = null
    attempts++
    if (stableConfig.outcome === 'read-failure' && position! >= Math.min(4, text.length)) {
      ch = 'EOF'
      error = true
    } else if (position! >= text.length) {
      ch = 'EOF'
      eof = true
    } else {
      ch = text.charCodeAt(position!)
      position!++
    }
    add('read', 'read', ch === 'EOF' ? error ? 'fgetc 回傳 EOF，錯誤指標已設定；這不是正常的檔尾。' : 'fgetc 回傳 EOF，已到檔案結尾。' : `fgetc 取得 ${JSON.stringify(String.fromCharCode(ch))}，存入 int ch。`)
    const ioError = ch === 'EOF' && error === true
    add('read-error', 'read-error', ioError ? '讀取錯誤，立即離開，半筆資料不解析、不加總。' : '這次不是讀取錯誤。', { expression: 'ch == EOF && ferror(fp)', value: ioError })
    if (ioError) break
    const emptyEof = ch === 'EOF' && used === 0 && !tooLong
    add('empty-eof', 'empty-eof', emptyEof ? '沒有尚待處理的字元，檔尾不額外產生一筆空紀錄。' : '還有字元或已取得行分隔，繼續收集或驗證。', { expression: 'ch == EOF && used == 0 && !too_long', value: emptyEof })
    if (emptyEof) break
    const character = ch !== 'EOF' && ch !== 10
    add('check-character', 'character', character ? '一般字元，先檢查容量。' : '換行或正常 EOF，這一筆紀錄已完整。', { expression: "ch != EOF && ch != '\\n'", value: character })
    if (character) {
      const fits = used! < SCORE_BUFFER_SIZE - 1
      add('check-capacity', 'capacity', fits ? '還有資料格，保留最後一格給空字元。' : '資料格已滿，只標記過長，繼續讀到行尾。', { expression: 'used < sizeof line - 1', value: fits })
      if (fits) { buffer[used!] = String.fromCharCode(ch as number); used!++; terminated = false; add('append', 'append', `保存字元，目前 used = ${used}；尚不能把它當成完整的 C 字串。`) }
      else { tooLong = true; add('too-long', 'too-long', '標記 too_long = 1；保留的前綴不能讓這筆過長資料變成有效分數。') }
      add('continue', 'continue', '回到下一次讀取；這一步還沒有接受或拒絕任何紀錄。')
      continue
    }
    buffer[used!] = '\0'; terminated = true; add('terminate', 'terminate', '在 used 位置補空字元，建立本次保留的字串。換行本身不放進 line。')
    valid = !tooLong; add('initialize-valid', 'valid', tooLong ? '過長紀錄先設 valid = 0，後面不會把它改回有效。' : '長度合格，先設 valid = 1，還要通過數字與分數驗證。')
    endDeclared = true; add('declare-end', 'end-pointer', '宣告本輪的 end；尚未取得停止位址。')
    errno = '0'; add('clear-errno', 'clear-errno', '每筆呼叫 strtol 前清除 errno。')
    const line = buffer.slice(0, used!).join('')
    const parsed = simulateIntegerParsingProgram({ text: line, longBits: 32, allowTrailingSpace: true })
    value = parsed.value!; endIndex = parsed.conversionEnd!; conversionEnd = endIndex; errno = parsed.errno
    let reason: ScoreRecordReason = tooLong ? 'too-long' : 'accepted'
    add('convert', 'convert', `轉換保留字串，value = ${value}，end 索引 = ${endIndex}。這一步尚未計入統計。`)
    const badConversion = endIndex === 0 || errno === 'ERANGE'
    if (badConversion) {
      valid = false
      if (reason === 'accepted') reason = endIndex === 0 ? 'no-digits' : 'long-range'
    }
    add('check-conversion', 'check-conversion', badConversion ? '沒有數字或超出 long 範圍，valid 設為 0。' : '數字轉換有結果且範圍合格；不會把既有的 valid = 0 改回 1。', { expression: 'end == line || errno == ERANGE', value: badConversion })
    while (true) {
      const space = isAsciiSpace(line[endIndex])
      add('tail-condition', 'tail-condition', space ? '尾端是空白，準備移動 end。' : '不是空白，停止移動 end。', { expression: 'isspace((unsigned char)*end)', value: space })
      if (!space) break
      endIndex++; add('advance-end', 'advance-end', `end 移到索引 ${endIndex}，略過一個尾端空白。`)
    }
    const trailing = endIndex < line.length, outOfScore = BigInt(value) < 0n || BigInt(value) > 100n
    const badScore = trailing || outOfScore
    if (badScore) {
      valid = false
      if (reason === 'accepted') reason = trailing ? 'trailing-data' : 'score-range'
    }
    add('check-score', 'check-score', badScore ? '仍有尾端資料，或分數不在 0 到 100，valid 設為 0。' : '尾端與分數範圍通過；其他檢查失敗的紀錄仍維持無效。', { expression: "*end != '\\0' || value < 0 || value > 100", value: badScore })
    add('check-valid', 'check-valid', valid ? '整筆通過，準備增加接受筆數與總和。' : '整筆無效，只增加拒絕筆數。', { expression: 'valid', value: valid })
    const record = { index: records.length, text: text.slice(recordStart, ch === 'EOF' ? position! : position! - 1), reason, value }
    if (valid) {
      accepted++; add('accept', 'accept', 'accepted 加一；下一步才將數值加入總和。')
      sum += Number(value); records.push(record); add('sum', 'sum', `sum 加上 ${value}；轉成 int 前，已確認 value 在 0 到 100。`)
    } else { rejected++; records.push(record); add('reject', 'reject', 'rejected 加一；sum 與 accepted 都不變。') }
    const stop = !valid && stopOnInvalid
    add('stop-condition', 'stop-condition', stop ? '無效且策略要求停止，準備提早離開。' : '不因本筆資料停止。', { expression: '!valid && stop_on_invalid', value: stop })
    if (stop) { stopped = true; add('stop', 'stop', 'stopped = 1，最後輸出會清楚標為 partial。'); add('break-invalid', 'break-invalid', '離開讀取迴圈，仍需檢查錯誤並關閉串流。'); break }
    used = 0; tooLong = false; terminated = false; recordStart = position!
    add('reset', 'reset', '重設 used 與 too_long，舊的陣列內容沒有被清空；下一筆不能使用舊的字串結尾。')
    const finalEof = ch === 'EOF'
    add('final-eof', 'final-eof', finalEof ? '已處理沒有換行的最後一筆，正常離開。' : '繼續讀取下一筆。', { expression: 'ch == EOF', value: finalEof })
    if (finalEof) break
  }
  iterationInScope = false
  readFailed = error; add('capture-error', 'capture-error', '在串流仍有效時保存 ferror；不把讀取錯誤當成正常檔尾。')
  closeCalls++; closeFailed = stableConfig.outcome === 'close-failure'; pointer = 'invalidated'; streamStatus = closeFailed ? 'disassociated' : 'closed'; eof = null; error = null
  add('close', 'close', closeFailed ? 'fclose 回報錯誤，串流已解除關聯，不得再查詢。' : 'fclose 成功，串流已關閉。')
  const failed = readFailed || closeFailed
  add('check-io', 'check-io', failed ? 'I/O 有錯誤，不能輸出成功的完整統計報表。' : 'I/O 檢查通過，依是否提早停止標示統計範圍。', { expression: 'read_failed || close_failed', value: failed })
  if (failed) { output.push('I/O failed\n'); add('print-io', 'print-io', '只輸出 I/O 失敗；已發生的統計事件仍保留在追蹤紀錄中。'); return finish(2, 'return-io', 'return-io') }
  output.push(stopped ? 'partial\n' : 'complete\n'); add('print-status', 'print-status', stopped ? '提早停止，標示 partial，不能當成全檔統計。' : '正常完成全檔讀取，標示 complete。')
  output.push(`accepted=${accepted}, rejected=${rejected}, sum=${sum}\n`); add('print-summary', 'print-summary', '輸出已完成驗證的接受、拒絕與總和。')
  const hasAverage = accepted > 0
  add('average-condition', 'average-condition', hasAverage ? '有合法紀錄，可以計算平均。' : '沒有合法紀錄，不做除以零的運算。', { expression: 'accepted > 0', value: hasAverage })
  if (hasAverage) { output.push(`average=${(sum / accepted).toFixed(2)}\n`); add('print-average', 'print-average', '先把 sum 轉成 double，再除以 accepted，保留小數。') }
  else { output.push('average=N/A\n'); add('print-no-average', 'print-no-average', '無有效分數，平均值不適用；不能把它假裝成 0 分。') }
  return finish(stopped ? 3 : 0, 'return', 'return')
}
