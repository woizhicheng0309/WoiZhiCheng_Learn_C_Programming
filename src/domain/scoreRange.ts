import {
  DEFAULT_SCORE_RANGE_CONFIG, SCORE_RANGE_SAMPLES, validateScoreRangeConfig, type ScoreRangeConfig,
} from './scoreRangeConfig'
import type { ScoreRecordValue } from './recordFields'

export { DEFAULT_SCORE_RANGE_CONFIG, SCORE_RANGE_SAMPLES, validateScoreRangeConfig, type ScoreRangeConfig } from './scoreRangeConfig'

export function buildScoreRangeSource(config: ScoreRangeConfig = DEFAULT_SCORE_RANGE_CONFIG) {
  const safe = validateScoreRangeConfig(config).length ? DEFAULT_SCORE_RANGE_CONFIG : config
  const rows = SCORE_RANGE_SAMPLES[safe.sample].rows
  const statements = [
    ['stdio', '#include <stdio.h>'], ['blank-type', ''], ['type', 'typedef struct { int id; int score; } Record;'],
    ['blank-sort', ''], ['sort', 'static void sort_scores(Record rows[], int count) {'],
    ['sort-loop', '  for (int i = 1; i < count; ++i) {'], ['save-key', '    Record key = rows[i];'], ['initialize-j', '    int j = i - 1;'],
    ['sort-condition', '    while (j >= 0 && rows[j].score > key.score) {'], ['shift', '      rows[j + 1] = rows[j];'],
    ['decrement', '      --j;'], ['end-sort-while', '    }'], ['insert', '    rows[j + 1] = key;'], ['end-sort-loop', '  }'], ['end-sort', '}'],
    ['blank-bound', ''], ['bound', 'static int bound_score(const Record rows[], int count, int target, int after_equal) {'],
    ['initialize-bounds', '  int left = 0, right = count;'], ['bound-condition', '  while (left < right) {'],
    ['mid', '    int mid = left + (right - left) / 2;'],
    ['compare', '    if (rows[mid].score < target || (after_equal && rows[mid].score == target)) {'],
    ['move-left', '      left = mid + 1;'], ['else-bound', '    } else {'], ['move-right', '      right = mid;'],
    ['end-bound-if', '    }'], ['end-bound-loop', '  }'], ['return-bound', '  return left;'], ['end-bound', '}'],
    ['blank-main', ''], ['main', 'int main(void) {'],
    ['initialize', `  Record rows[6] = {${rows.map(row => `{${row.id}, ${row.score}}`).join(', ')}};`],
    ['count', `  int count = ${safe.count};`], ['call-sort', '  sort_scores(rows, count);'],
    ['lower', `  int begin = bound_score(rows, count, ${safe.low}, 0);`],
    ['upper', `  int end = bound_score(rows, count, ${safe.high}, 1);`],
    ['print-summary', '  printf("begin=%d, end=%d, matches=%d\\n", begin, end, end - begin);'],
    ['output-loop', '  for (int i = begin; i < end; ++i) {'],
    ['print-record', '    printf("%d,%d\\n", rows[i].id, rows[i].score);'], ['end-output', '  }'], ['return-main', '  return 0;'], ['end-main', '}'],
  ] as const
  type Location = typeof statements[number][0]
  const locations = Object.fromEntries(statements.map(([key], index) => [key, index + 1])) as Record<Location, number>
  const lines = statements.map(([, code], index) => ({ lineNumber: index + 1, code }))
  return { lines, locations, sourceText: lines.map(line => line.code).join('\n') }
}

type SourceLocation = keyof ReturnType<typeof buildScoreRangeSource>['locations']
export type ScoreRangePhase = 'prepare' | 'blocked' | 'initialize' | 'set-count' | 'call-sort' | 'sort-loop' | 'save-key'
  | 'initialize-j' | 'sort-condition' | 'shift' | 'decrement' | 'insert' | 'sorted' | 'call-bound' | 'initialize-bounds'
  | 'bound-condition' | 'mid' | 'compare' | 'move-left' | 'move-right' | 'return-bound' | 'receive-bound'
  | 'print-summary' | 'output-loop' | 'print-record' | 'return-main' | 'done'
export interface ScoreRangeSearch {
  kind: 'lower' | 'upper'
  target: number
  left: number
  right: number
  mid: number | null
}
export interface ScoreRangeFrame {
  index: number
  phase: ScoreRangePhase
  activeLine: number
  activePart: string
  explanation: string
  rows: readonly Readonly<ScoreRecordValue>[] | null
  count: number | null
  sortedPrefix: number
  i: number | null
  j: number | null
  key: Readonly<ScoreRecordValue> | null
  hole: number | null
  search: Readonly<ScoreRangeSearch> | null
  begin: number | null
  end: number | null
  activeIndices: readonly number[]
  output: string
  report: string
  revealed: boolean
  mainInScope: boolean
}

export function simulateScoreRangeProject(config: ScoreRangeConfig = DEFAULT_SCORE_RANGE_CONFIG) {
  const source = buildScoreRangeSource(config)
  const issues = validateScoreRangeConfig(config)
  const frames: ScoreRangeFrame[] = []
  const state: Omit<ScoreRangeFrame, 'index' | 'phase' | 'activeLine' | 'activePart' | 'explanation'> = {
    rows: null, count: null, sortedPrefix: 0, i: null, j: null, key: null, hole: null, search: null,
    begin: null, end: null, activeIndices: [], output: '', report: '', revealed: false, mainInScope: false,
  }
  const rows: ScoreRecordValue[] = []
  function add(phase: ScoreRangePhase, location: SourceLocation, explanation: string, activeIndices: number[] = []) {
    const activeLine = source.locations[location]
    frames.push({ ...state, rows: state.rows ? [...rows] : null, search: state.search ? { ...state.search } : null,
      activeIndices, index: frames.length, phase, activeLine, activePart: `line-${activeLine}`, explanation })
  }
  function result(status: 'completed' | 'blocked') {
    return { source, frames, status, message: issues.join(' '), begin: state.begin, end: state.end,
      matches: state.begin === null || state.end === null ? null : state.end - state.begin,
      output: state.output, report: state.report }
  }
  add('prepare', 'main', '先按 score 穩定排序，再找出符合分數區間的半開索引範圍。')
  if (issues.length) {
    add('blocked', 'main', issues.join(' '))
    return result('blocked')
  }
  state.mainInScope = true
  rows.push(...SCORE_RANGE_SAMPLES[config.sample].rows.map(row => ({ ...row })))
  state.rows = rows
  add('initialize', 'initialize', '六格各自保存完整的 id 與 score。')
  state.count = config.count
  add('set-count', 'count', `本次處理前 ${config.count} 格。`)
  state.sortedPrefix = Math.min(1, config.count)
  add('call-sort', 'call-sort', '把陣列與有效筆數傳給 sort_scores。')
  for (let i = 1; ; i++) {
    state.i = i
    add('sort-loop', 'sort-loop', i < config.count ? '還有下一筆要插入有序前綴。' : '排序迴圈結束。')
    if (i >= config.count) break
    const key = rows[i]
    state.key = key
    state.hole = i
    add('save-key', 'save-key', `先保存完整紀錄 ${key.id},${key.score}。`, [i])
    let j = i - 1
    state.j = j
    add('initialize-j', 'initialize-j', `j 從 ${j} 開始。`)
    while (true) {
      const move = j >= 0 && rows[j].score > key.score
      add('sort-condition', 'sort-condition', j < 0 ? 'j 小於 0，短路判斷停止。' : move ? '左邊的分數較高，完整紀錄向右移。' : '分數較低或相等，停止右移。', j >= 0 ? [j] : [])
      if (!move) break
      rows[j + 1] = rows[j]
      state.hole = j
      add('shift', 'shift', '複製整筆紀錄到右邊，id 與 score 一起移動。', [j, j + 1])
      j--
      state.j = j
      add('decrement', 'decrement', 'j 減一，準備檢查下一格。')
    }
    rows[j + 1] = key
    state.hole = null
    state.sortedPrefix = i + 1
    add('insert', 'insert', '把保存的 key 放回。相等時保留原始先後順序。', [j + 1])
    state.key = null
    state.j = null
  }
  state.i = null
  state.sortedPrefix = config.count
  add('sorted', 'end-sort', '有效區段已按分數遞增排序。')

  function findBound(kind: 'lower' | 'upper', target: number) {
    const call = kind === 'lower' ? 'lower' : 'upper'
    add('call-bound', call, kind === 'lower' ? '找第一筆 score >= 下界的位置。' : '找第一筆 score > 上界的位置。')
    let left = 0, right = config.count
    state.search = { kind, target, left, right, mid: null }
    add('initialize-bounds', 'initialize-bounds', `候選範圍為 [0, ${right})，right 可以等於 count。`)
    while (true) {
      add('bound-condition', 'bound-condition', left < right ? '範圍非空，取中點。' : 'left 與 right 相等，已找到邊界。')
      if (left >= right) break
      const mid = left + Math.floor((right - left) / 2)
      state.search = { kind, target, left, right, mid }
      add('mid', 'mid', `mid = ${mid}，位於有效資料範圍內。`, [mid])
      const moveLeft = rows[mid].score < target || (kind === 'upper' && rows[mid].score === target)
      add('compare', 'compare', moveLeft ? '中點仍位於邊界之前，下一步移動 left。' : '中點可能是邊界，保留並縮小 right。', [mid])
      if (moveLeft) {
        left = mid + 1
        state.search = { kind, target, left, right, mid }
        add('move-left', 'move-left', `left 改為 ${left}。`)
      } else {
        right = mid
        state.search = { kind, target, left, right, mid }
        add('move-right', 'move-right', `right 改為 ${right}。`)
      }
      state.search = { kind, target, left, right, mid: null }
    }
    add('return-bound', 'return-bound', `回傳邊界 ${left}，可能等於 count。`)
    state.search = null
    if (kind === 'lower') state.begin = left
    else state.end = left
    add('receive-bound', call, `main 接到 ${kind === 'lower' ? 'begin' : 'end'} = ${left}。`)
    return left
  }
  const begin = findBound('lower', config.low)
  const end = findBound('upper', config.high)
  state.output = `begin=${begin}, end=${end}, matches=${end - begin}\n`
  state.revealed = true
  add('print-summary', 'print-summary', '符合條件的紀錄位於 [begin, end)，筆數等於 end - begin。')
  for (let index = begin; ; index++) {
    state.i = index
    add('output-loop', 'output-loop', index < end ? '索引仍小於 end，可以輸出這筆。' : '到達 end，結束輸出。')
    if (index >= end) break
    const line = `${rows[index].id},${rows[index].score}\n`
    state.output += line
    state.report += line
    add('print-record', 'print-record', '輸出這筆 id 與 score。', [index])
  }
  state.i = null
  add('return-main', 'return-main', 'main 回傳 0。')
  state.mainInScope = false
  add('done', 'end-main', '執行結束，保留資料表快照與查詢結果。')
  return result('completed')
}
