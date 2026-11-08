import { DEFAULT_FILE_CHARACTER_CONFIG, FILE_CHARACTER_DATASETS, buildFileCharacterSource, simulateFileCharacterProgram, validateFileCharacterConfig, type FileCharacterConfig } from './fileCharacters'

const expectedData: Record<FileCharacterConfig['dataset'], { all: number[]; stopped: number[]; retrieved: number[] }> = {
  text: { all: [65, 48, 10, 66, 57], stopped: [65, 48], retrieved: [65, 48, 10] },
  nul: { all: [65, 0, 66, 57], stopped: [65, 0, 66, 57], retrieved: [65, 0, 66, 57] },
  high: { all: [255, 48, 10, 57], stopped: [255, 48], retrieved: [255, 48, 10] },
  digits: { all: [48, 49, 57], stopped: [48, 49, 57], retrieved: [48, 49, 57] },
  empty: { all: [], stopped: [], retrieved: [] },
}

describe('fgetc return values and early termination', () => {
  for (const dataset of Object.keys(FILE_CHARACTER_DATASETS) as FileCharacterConfig['dataset'][]) {
    for (const outcome of ['success', 'open-failure', 'read-failure', 'close-failure'] as const) {
      it(`handles ${dataset} with ${outcome} and either stop policy`, () => {
        for (const stopAtNewline of [false, true]) {
          const failedBeforeData = outcome === 'open-failure' || outcome === 'read-failure'
          const data = expectedData[dataset]
          const processed = failedBeforeData ? [] : stopAtNewline ? data.stopped : data.all
          const retrieved = failedBeforeData ? [] : stopAtNewline ? data.retrieved : data.all
          const digits = processed.filter(value => value >= 48 && value <= 57).length
          const run = simulateFileCharacterProgram({ dataset, outcome, stopAtNewline })
          expect(run.status).toBe('completed')
          expect(run.processed).toEqual(processed)
          expect(run.retrieved).toEqual(retrieved)
          expect(run.printedValues).toEqual([processed.length, digits])
          expect(run.exitCode).toBe(outcome === 'open-failure' ? 1 : outcome === 'success' ? 0 : 2)
          expect(run.closeCalls).toBe(outcome === 'open-failure' ? 0 : 1)
          const prefix = processed.map(value => `code=${value}\n`).join('')
          expect(run.stdout).toBe(outcome === 'open-failure' ? 'open failed\n' : prefix + (outcome === 'success' ? `count=${processed.length}, digits=${digits}\n` : 'I/O failed\n'))
          const stopped = stopAtNewline && data.all.includes(10)
          expect(run.readCalls).toBe(outcome === 'open-failure' ? 0 : outcome === 'read-failure' ? 1 : stopped ? retrieved.length : retrieved.length + 1)
          expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
        }
      })
    }
  }
  it('treats a zero byte as data while ASCII zero is a digit', () => {
    const nul = simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, dataset: 'nul' })
    const zero = nul.frames.find(frame => frame.phase === 'read-attempt' && frame.ch === 0)!
    expect(zero).toMatchObject({ eof: false, position: 2, count: 1 })
    expect(nul.frames[zero.index + 1]).toMatchObject({ phase: 'while-condition', condition: { value: true } })
    expect(nul.frames.find(frame => frame.phase === 'check-digit' && frame.ch === 0)!.condition!.value).toBe(false)
    expect(nul.processed).toEqual([65, 0, 66, 57])
    expect(nul.printedValues).toEqual([4, 1])
    const text = simulateFileCharacterProgram()
    expect(text.frames.find(frame => frame.phase === 'check-digit' && frame.ch === 48)!.condition!.value).toBe(true)
    expect(text.printedValues).toEqual([5, 2])
  })
  it('keeps 255 as a nonnegative int data value and never narrows the EOF signal to a byte', () => {
    const run = simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, dataset: 'high' })
    const calls = run.frames.filter(frame => frame.phase === 'read-attempt')
    expect(calls.map(frame => frame.ch)).toEqual([255, 48, 10, 57, 'EOF'])
    expect(calls[0]).toMatchObject({ count: 0, eof: false, error: false })
    expect(calls.at(-1)).toMatchObject({ count: 4, eof: true, error: false, activeByte: null })
    expect(run.processed).toEqual([255, 48, 10, 57])
    expect(run.stdout).not.toContain('code=EOF')
  })
  it('does not set EOF just because the last data byte has been consumed', () => {
    const run = simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, dataset: 'digits' })
    const calls = run.frames.filter(frame => frame.phase === 'read-attempt')
    expect(calls[2]).toMatchObject({ ch: 57, position: 3, eof: false })
    expect(calls[3]).toMatchObject({ ch: 'EOF', position: 3, eof: true })
    expect(run.readCalls).toBe(4)
    expect(run.processed).toHaveLength(3)
  })
  it('breaks before counting the newline, preserves its read progress and skips the extra EOF read', () => {
    const run = simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, stopAtNewline: true })
    const stopped = run.frames.findIndex(frame => frame.phase === 'break')
    expect(run.frames[stopped]).toMatchObject({ ch: 10, position: 3, count: 2, digits: 1, eof: false, retrieved: [65, 48, 10], processed: [65, 48] })
    expect(run.frames[stopped + 1].phase).toBe('capture-read-error')
    expect(run.frames.some(frame => frame.phase === 'read-attempt' && frame.ch === 'EOF')).toBe(false)
    expect(run.stdout).toBe('code=65\ncode=48\ncount=2, digits=1\n')
    expect(run.readCalls).toBe(3)
  })
  it('returns EOF for a read error but sets error rather than the end-of-file indicator', () => {
    const run = simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, outcome: 'read-failure' })
    expect(run.frames.find(frame => frame.phase === 'read-attempt')).toMatchObject({ ch: 'EOF', eof: false, error: true, position: 0, count: 0, digits: 0 })
    expect(run.frames.some(frame => frame.phase === 'check-stop' || frame.phase === 'count-byte')).toBe(false)
    expect(run.frames.find(frame => frame.phase === 'capture-read-error')).toMatchObject({ streamStatus: 'open', readFailed: true })
    expect(run.frames.find(frame => frame.phase === 'close')).toMatchObject({ eof: null, error: null, pointer: 'invalidated', readFailed: true, closeFailed: false })
    expect(run.exitCode).toBe(2)
  })
  it('does not declare counters or attempt cleanup when opening fails', () => {
    const run = simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, outcome: 'open-failure' })
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'enter-main', 'open', 'check-open', 'print-open-failure', 'return-open-failure', 'done'])
    expect(run.frames.every(frame => !frame.chDeclared && frame.count === null && frame.digits === null)).toBe(true)
    expect(run.readCalls).toBe(0)
    expect(run.closeCalls).toBe(0)
    expect(run.printedValues).toEqual([0, 0])
    expect(run.exitCode).toBe(1)
  })
  it('disassociates a stream after a close error without changing already processed data', () => {
    const run = simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, outcome: 'close-failure' })
    const closed = run.frames.findIndex(frame => frame.phase === 'close')
    expect(run.frames[closed]).toMatchObject({ streamStatus: 'disassociated', pointer: 'invalidated', readFailed: false, closeFailed: true, count: 5, digits: 2 })
    expect(run.frames.slice(closed).every(frame => frame.eof === null && frame.error === null)).toBe(true)
    expect(run.closeCalls).toBe(1)
    expect(run.frames.some(frame => frame.phase === 'print-summary')).toBe(false)
    expect(run.printedValues).toEqual([5, 2])
    expect(run.exitCode).toBe(2)
  })
  it('keeps historical arrays and configs independent and gates prediction feedback until return', () => {
    const config = { ...DEFAULT_FILE_CHARACTER_CONFIG }
    const run = simulateFileCharacterProgram(config)
    const read = run.frames.find(frame => frame.phase === 'read-attempt')!
    const processed = run.frames.find(frame => frame.phase === 'count-byte')!
    expect(read.retrieved).toEqual([65]); expect(read.processed).toEqual([])
    expect(processed.processed).toEqual([65])
    expect(read.retrieved).not.toBe(processed.retrieved)
    expect(processed.processed).not.toBe(run.processed)
    const returned = run.frames.findIndex(frame => frame.phase === 'return-success')
    expect(run.frames.slice(0, returned).every(frame => frame.printedValues === null)).toBe(true)
    expect(run.frames[returned].printedValues).toEqual([5, 2])
    config.stopAtNewline = true
    expect(run.config.stopAtNewline).toBe(false)
    expect(FILE_CHARACTER_DATASETS.text.bytes).toEqual([65, 48, 10, 66, 57])
  })
  it('builds the parenthesized int assignment and synchronizes C lines and frame parts', () => {
    const source = buildFileCharacterSource()
    expect(source.lines).toHaveLength(30)
    expect(source.lines[3].code).toBe('  FILE *fp = fopen("bytes.bin", "rb");')
    expect(source.lines[8].code).toBe('  int ch;')
    expect(source.lines[11].code).toBe('  while ((ch = fgetc(fp)) != EOF) {')
    expect(source.lines[12].code).toBe("    if (stop_at_newline && ch == '\\n') {")
    expect(source.lines[21].code).toBe('  int read_failed = ferror(fp) != 0;')
    expect(source.lines[22].code).toBe('  int close_failed = fclose(fp) != 0;')
    expect(buildFileCharacterSource({ ...DEFAULT_FILE_CHARACTER_CONFIG, outcome: 'read-failure', dataset: 'high' }).sourceText).toBe(source.sourceText)
    const lineByPhase = { prepare: 3, 'enter-main': 3, open: 4, 'check-open': 5, 'print-open-failure': 6, 'return-open-failure': 7,
      'declare-ch': 9, 'initialize-counters': 10, 'set-stop': 11, 'read-attempt': 12, 'while-condition': 12, 'check-stop': 13,
      break: 14, 'count-byte': 16, 'check-digit': 17, 'count-digit': 18, 'print-code': 20, 'capture-read-error': 22, close: 23,
      'check-errors': 24, 'print-io-failure': 25, 'return-io-failure': 26, 'print-summary': 28, 'return-success': 29, done: 30, blocked: 3 }
    for (const outcome of ['success', 'open-failure', 'read-failure', 'close-failure'] as const) for (const stopAtNewline of [false, true]) {
      for (const [index, frame] of simulateFileCharacterProgram({ ...DEFAULT_FILE_CHARACTER_CONFIG, outcome, stopAtNewline }).frames.entries()) {
        expect(frame.index).toBe(index)
        expect(frame.activeLine).toBe(lineByPhase[frame.phase])
        expect(frame.activePart).toBe(frame.phase === 'read-attempt' ? 'fgetc-call' : frame.phase === 'while-condition' ? 'eof-check' : `line-${frame.activeLine}`)
      }
    }
  })
  it.each([
    { dataset: '__proto__' }, { dataset: 'constructor' }, { dataset: { toString: null } }, { dataset: null },
    { outcome: 'other' }, { outcome: { toString: null } }, { outcome: null },
    { stopAtNewline: 'false' }, { stopAtNewline: 0 }, { stopAtNewline: null }, { stopAtNewline: [] },
  ])('blocks invalid configuration %j before opening or reading', change => {
    const config = { ...DEFAULT_FILE_CHARACTER_CONFIG, ...change } as FileCharacterConfig
    expect(validateFileCharacterConfig(config).length).toBeGreaterThan(0)
    const run = simulateFileCharacterProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
    expect(run.readCalls).toBe(0); expect(run.closeCalls).toBe(0)
    expect(run.frames.every(frame => !frame.mainInScope && !frame.chDeclared && frame.count === null)).toBe(true)
    expect(run.exitCode).toBeNull()
    expect(run.output).toEqual([])
  })
})
