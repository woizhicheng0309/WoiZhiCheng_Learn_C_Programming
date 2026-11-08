import { DEFAULT_FILE_READING_CONFIG, FILE_READING_DATASETS, buildFileReadingSource, simulateFileReadingProgram, validateFileReadingConfig, type FileReadingConfig } from './fileReading'

const expectedChunks = {
  short: [['H', 'i', '\n', 'C', '\n'], ['Hi', '\n', 'C\n'], ...Array.from({ length: 5 }, () => ['Hi\n', 'C\n'])],
  long: [['A', 'B', 'C', 'D', 'E', 'F', '\n', 'X'], ['AB', 'CD', 'EF', '\n', 'X'], ['ABC', 'DEF', '\n', 'X'], ['ABCD', 'EF\n', 'X'], ['ABCDE', 'F\n', 'X'], ['ABCDEF', '\n', 'X'], ['ABCDEF\n', 'X']],
  blank: [['A', '\n', '\n', 'B'], ...Array.from({ length: 6 }, () => ['A\n', '\n', 'B'])],
  empty: Array.from({ length: 7 }, () => [] as string[]),
}

describe('file streams and fgets', () => {
  for (const dataset of Object.keys(FILE_READING_DATASETS) as FileReadingConfig['dataset'][]) {
    for (const outcome of ['success', 'open-failure', 'read-failure', 'close-failure'] as const) {
      it(`handles ${dataset} with ${outcome} across every supported buffer size`, () => {
        for (let bufferSize = 2; bufferSize <= 8; bufferSize++) {
          const chunks = outcome === 'open-failure' || outcome === 'read-failure' ? [] : expectedChunks[dataset][bufferSize - 2]
          const run = simulateFileReadingProgram({ dataset, outcome, bufferSize })
          const exit = outcome === 'open-failure' ? 1 : outcome === 'success' ? 0 : 2
          const prefix = chunks.map((chunk, index) => `[${index + 1}] ${chunk}`).join('')
          expect(run.status).toBe('completed')
          expect(run.chunks).toEqual(chunks)
          expect(run.printedValues).toEqual([chunks.length, exit])
          expect(run.stdout).toBe(outcome === 'open-failure' ? 'open failed\n' : prefix + (exit === 2 ? '\nI/O failed\n' : `\nreads=${chunks.length}\n`))
          expect(run.closeCalls).toBe(outcome === 'open-failure' ? 0 : 1)
          expect(run.streamStatus).toBe(outcome === 'open-failure' ? 'not-opened' : outcome === 'close-failure' ? 'disassociated' : 'closed')
          expect(run.frames.filter(frame => frame.phase === 'count-read')).toHaveLength(chunks.length)
          for (const frame of run.frames.filter(frame => frame.phase === 'read-attempt' && frame.readResult === 'buffer')) {
            expect(frame.bufferState).toBe('valid')
            expect(frame.currentString!.length).toBeLessThan(bufferSize)
            expect(frame.buffer!.slice(0, frame.currentString!.length).join('')).toBe(frame.currentString)
            expect(frame.buffer![frame.currentString!.length]).toBe('\0')
          }
          expect(run.frames.at(-1)).toMatchObject({ phase: 'done', mainInScope: false })
        }
      })
    }
  }
  it('sets EOF only when input encounters it, not just because the last newline was consumed', () => {
    const run = simulateFileReadingProgram()
    const reads = run.frames.filter(frame => frame.phase === 'read-attempt')
    expect(reads.map(frame => [frame.readResult, frame.currentString, frame.eof])).toEqual([
      ['buffer', 'Hi\n', false], ['buffer', 'C\n', false], ['null', 'C\n', true],
    ])
    expect(reads[2].buffer).toEqual(reads[1].buffer)
    expect(reads[2].buffer).not.toBe(reads[1].buffer)
    expect(reads[2].reads).toBe(2)
    expect(run.stdout).toBe('[1] Hi\n[2] C\n\nreads=2\n')
  })
  it('can encounter EOF on a successful final partial read, preserves tail cells, and does not print stale buffer again', () => {
    const run = simulateFileReadingProgram({ dataset: 'long', outcome: 'success', bufferSize: 8 })
    const reads = run.frames.filter(frame => frame.phase === 'read-attempt')
    expect(reads[0]).toMatchObject({ currentString: 'ABCDEF\n', eof: false })
    expect(reads[1]).toMatchObject({ readResult: 'buffer', currentString: 'X', eof: true, reads: 1 })
    expect(reads[1].buffer).toEqual(['X', '\0', 'C', 'D', 'E', 'F', '\n', '\0'])
    expect(reads[2]).toMatchObject({ readResult: 'null', currentString: 'X', eof: true, reads: 2 })
    expect(reads[2].buffer).toEqual(reads[1].buffer)
    expect(run.stdout).toBe('[1] ABCDEF\n[2] X\nreads=2\n')
  })
  it('leaves an empty-file buffer uninitialized and never enters the body', () => {
    const run = simulateFileReadingProgram({ ...DEFAULT_FILE_READING_CONFIG, dataset: 'empty' })
    const eof = run.frames.find(frame => frame.phase === 'read-attempt')!
    expect(eof).toMatchObject({ readResult: 'null', eof: true, error: false, bufferState: 'uninitialized', buffer: [null, null, null, null, null, null] })
    expect(run.frames.some(frame => frame.phase === 'print-chunk')).toBe(false)
    expect(run.printedValues).toEqual([0, 0])
    expect(run.stdout).toBe('\nreads=0\n')
  })
  it('marks a read-error buffer indeterminate and captures its error before closing', () => {
    const run = simulateFileReadingProgram({ ...DEFAULT_FILE_READING_CONFIG, outcome: 'read-failure' })
    const read = run.frames.find(frame => frame.phase === 'read-attempt')!
    expect(read).toMatchObject({ position: 0, readResult: 'null', eof: false, error: true, bufferState: 'indeterminate', currentString: null })
    expect(read.buffer!.every(value => value === null)).toBe(true)
    const capture = run.frames.findIndex(frame => frame.phase === 'capture-read-error')
    expect(run.frames[capture]).toMatchObject({ streamStatus: 'open', readFailed: true, error: true })
    expect(run.frames[capture + 1]).toMatchObject({ phase: 'close', streamStatus: 'closed', pointer: 'invalidated', eof: null, error: null, readFailed: true, closeFailed: false })
    expect(run.frames.some(frame => frame.phase === 'print-chunk' || frame.phase === 'print-summary')).toBe(false)
    expect(run.printedValues).toEqual([0, 2])
  })
  it('disassociates the stream even when fclose reports an error and does not query it again', () => {
    const run = simulateFileReadingProgram({ ...DEFAULT_FILE_READING_CONFIG, outcome: 'close-failure' })
    const close = run.frames.findIndex(frame => frame.phase === 'close')
    expect(run.frames[close]).toMatchObject({ streamStatus: 'disassociated', pointer: 'invalidated', readFailed: false, closeFailed: true, eof: null, error: null, reads: 2 })
    expect(run.frames.slice(close).every(frame => frame.eof === null && frame.error === null)).toBe(true)
    expect(run.frames.filter(frame => frame.phase === 'close')).toHaveLength(1)
    expect(run.frames.some(frame => frame.phase === 'print-summary')).toBe(false)
    expect(run.printedValues).toEqual([2, 2])
  })
  it('does not invent a reads variable or close a null pointer on open failure', () => {
    const run = simulateFileReadingProgram({ ...DEFAULT_FILE_READING_CONFIG, outcome: 'open-failure' })
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'enter-main', 'open', 'check-open', 'print-open-failure', 'return-open-failure', 'done'])
    expect(run.frames.every(frame => frame.reads === null && frame.buffer === null && frame.position === null)).toBe(true)
    expect(run.closeCalls).toBe(0)
    expect(run.printedValues).toEqual([0, 1])
  })
  it('keeps snapshots independent and waits for the main return before revealing both predicted values', () => {
    const config = { ...DEFAULT_FILE_READING_CONFIG }
    const run = simulateFileReadingProgram(config)
    const declaration = run.frames.find(frame => frame.phase === 'declare-buffer')!
    const first = run.frames.find(frame => frame.phase === 'read-attempt')!
    expect(declaration.buffer).toEqual([null, null, null, null, null, null])
    expect(first.buffer).toEqual(['H', 'i', '\n', '\0', null, null])
    expect(declaration.buffer).not.toBe(first.buffer)
    const returned = run.frames.findIndex(frame => frame.phase === 'return-success')
    expect(run.frames.slice(0, returned).every(frame => frame.printedValues === null)).toBe(true)
    expect(run.frames[returned].printedValues).toEqual([2, 0])
    expect(run.frames[returned].printedValues).not.toBe(run.printedValues)
    config.bufferSize = 2
    expect(run.config.bufferSize).toBe(6)
    expect(FILE_READING_DATASETS.short.text).toBe('Hi\nC\n')
  })
  it('builds the guarded C source and aligns phases, calls, conditions and cleanup', () => {
    const source = buildFileReadingSource()
    expect(source.lines).toHaveLength(23)
    expect(source.lines[3].code).toBe('  FILE *fp = fopen("notes.txt", "r");')
    expect(source.lines[10].code).toBe('  while (fgets(buffer, sizeof buffer, fp) != NULL) {')
    expect(source.lines[14].code).toBe('  int read_failed = ferror(fp) != 0;')
    expect(source.lines[15].code).toBe('  int close_failed = fclose(fp) != 0;')
    expect(buildFileReadingSource({ ...DEFAULT_FILE_READING_CONFIG, outcome: 'open-failure', dataset: 'empty' }).sourceText).toBe(source.sourceText)
    const lineByPhase = { prepare: 3, 'enter-main': 3, open: 4, 'check-open': 5, 'print-open-failure': 6, 'return-open-failure': 7,
      'declare-buffer': 9, 'initialize-reads': 10, 'read-attempt': 11, 'while-condition': 11, 'count-read': 12, 'print-chunk': 13,
      'capture-read-error': 15, close: 16, 'check-errors': 17, 'print-io-failure': 18, 'return-io-failure': 19, 'print-summary': 21, 'return-success': 22, done: 23, blocked: 3 }
    for (const outcome of ['success', 'open-failure', 'read-failure', 'close-failure'] as const) for (const [index, frame] of simulateFileReadingProgram({ ...DEFAULT_FILE_READING_CONFIG, outcome }).frames.entries()) {
      expect(frame.index).toBe(index)
      expect(frame.activeLine).toBe(lineByPhase[frame.phase])
      expect(frame.activePart).toBe(frame.phase === 'read-attempt' ? 'fgets-call' : frame.phase === 'while-condition' ? 'fgets-check' : `line-${frame.activeLine}`)
    }
  })
  it.each([
    { dataset: '__proto__' }, { dataset: 'constructor' }, { dataset: { toString: null } }, { dataset: null },
    { outcome: 'other' }, { outcome: { toString: null } }, { outcome: null },
    { bufferSize: 0 }, { bufferSize: 1 }, { bufferSize: 9 }, { bufferSize: 2.5 }, { bufferSize: '6' }, { bufferSize: Infinity }, { bufferSize: null },
  ])('blocks invalid configuration %j before opening a stream', change => {
    const config = { ...DEFAULT_FILE_READING_CONFIG, ...change } as FileReadingConfig
    expect(validateFileReadingConfig(config).length).toBeGreaterThan(0)
    const run = simulateFileReadingProgram(config)
    expect(run.status).toBe('blocked')
    expect(run.frames.map(frame => frame.phase)).toEqual(['prepare', 'blocked'])
    expect(run.frames.every(frame => !frame.mainInScope && frame.pointer === 'undeclared' && frame.buffer === null)).toBe(true)
    expect(run.closeCalls).toBe(0)
    expect(run.exitCode).toBeNull()
    expect(run.output).toEqual([])
  })
})
