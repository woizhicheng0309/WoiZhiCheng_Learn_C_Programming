import { simulateIntegerParsingProgram } from './integerParsing'

export const RECORD_LINE_LIMIT = 14
export interface ScoreRecordValue { id: number; score: number }

export type RecordFieldError = 'id' | 'separator' | 'score' | 'tail'

export interface RecordFields {
  idValue: string | null
  idEnd: number
  scoreValue: string | null
  scoreEnd: number | null
  tailEnd: number | null
  error: RecordFieldError | null
  record: ScoreRecordValue | null
}

export const RECORD_PARSER_STATEMENTS = [
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
] as const

/** Inspect one bounded ASCII input line using the same rules as the displayed C parser. */
export function inspectRecordFields(text: string): RecordFields {
  const id = simulateIntegerParsingProgram({ text, longBits: 64, allowTrailingSpace: false })
  const idEnd = id.conversionEnd ?? 0
  const fields: RecordFields = { idValue: id.value, idEnd, scoreValue: null, scoreEnd: null, tailEnd: null, error: null, record: null }
  if (idEnd === 0 || id.errno === 'ERANGE' || Number(id.value) < 1 || Number(id.value) > 9999) {
    return { ...fields, error: 'id' }
  }
  if (text[idEnd] !== ',') return { ...fields, error: 'separator' }

  const start = idEnd + 1
  const score = simulateIntegerParsingProgram({ text: text.slice(start), longBits: 64, allowTrailingSpace: false })
  const converted = score.conversionEnd ?? 0
  const scoreEnd = start + converted
  fields.scoreValue = score.value
  fields.scoreEnd = scoreEnd
  if (converted === 0 || score.errno === 'ERANGE' || Number(score.value) < 0 || Number(score.value) > 100) {
    return { ...fields, error: 'score' }
  }
  fields.tailEnd = scoreEnd + Number(text[scoreEnd] === '\n')
  if (fields.tailEnd !== text.length) return { ...fields, error: 'tail' }
  return { ...fields, record: { id: Number(id.value), score: Number(score.value) } }
}
