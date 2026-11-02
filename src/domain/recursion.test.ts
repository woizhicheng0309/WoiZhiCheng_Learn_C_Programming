import { DEFAULT_RECURSION_CONFIG, simulateRecursionProgram } from './recursion'

describe('factorial recursion', () => {
  it.each([1, 1, 2, 6, 24, 120, 720].map((answer, n) => ({ answer, n })))('computes factorial($n) = $answer', ({ n, answer }) => {
    const result = simulateRecursionProgram({ n })
    expect(result).toMatchObject({ status: 'completed', answer, output: [answer], maxDepth: Math.max(1, n) })
    expect(result.frames.filter(f => f.phase === 'enter-function').map(f => f.stack.at(-1)?.n))
      .toEqual(n <= 1 ? [n] : Array.from({ length: n }, (_, index) => n - index))
    expect(result.frames.filter(f => f.phase === 'return-base')).toHaveLength(1)
    expect(result.frames.at(-1)).toMatchObject({ stack: [], mainInScope: false })
    result.frames.forEach(f => expect(result.source.lines[f.activeLine - 1]).toBeDefined())
  })
  it('preserves each caller parameter and resumes only after its child returns', () => {
    const result = simulateRecursionProgram({ n: 4 })
    const base = result.frames.find(f => f.phase === 'return-base')!
    expect(base.stack.map(f => f.n)).toEqual([4, 3, 2, 1])
    expect(base.stack.slice(0, -1).every(f => f.previous === null && f.result === null)).toBe(true)
    const receives = result.frames.filter(f => f.phase === 'receive')
    expect(receives.map(f => [f.stack.at(-1)?.n, f.stack.at(-1)?.previous])).toEqual([[2, 1], [3, 2], [4, 6]])
    expect(result.frames.filter(f => f.phase === 'return-result').map(f => f.stack.at(-1)?.returnValue)).toEqual([2, 6, 24])
    const main = result.frames.find(f => f.phase === 'main-result')!
    expect(main).toMatchObject({ stack: [], answer: 24, output: [] })
    expect(result.frames.slice(0, main.index).every(f => f.answer === null)).toBe(true)
  })
  it.each([-1, 7, 1.5, NaN, Infinity])('blocks invalid input %s before calling', n => {
    const result = simulateRecursionProgram({ n })
    expect(result).toMatchObject({ status: 'blocked', output: [], answer: null, maxDepth: 0 })
    expect(result.frames.map(f => f.phase)).toEqual(['enter-main', 'blocked'])
    expect(result.source.sourceText).not.toMatch(/NaN|Infinity/)
  })
  it('keeps config and stack snapshots independent', () => {
    const config = { ...DEFAULT_RECURSION_CONFIG }
    const result = simulateRecursionProgram(config)
    config.n = 0
    expect(result.config.n).toBe(4)
    const first = result.frames.find(f => f.phase === 'enter-function')!
    const next = result.frames[first.index + 1]
    expect(first.stack).not.toBe(next.stack)
    expect(first.stack[0]).not.toBe(next.stack[0])
    expect(first.output).not.toBe(next.output)
  })
})
