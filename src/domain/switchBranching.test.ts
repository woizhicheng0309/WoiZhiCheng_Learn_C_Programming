import { simulateSwitchProgram, DEFAULT_SWITCH_CONFIG, type SwitchConfig } from './switchBranching'

describe('switch dispatch and fall-through', () => {
  it.each([
    [0, 'with-break', ['Water', 'Done']], [1, 'with-break', ['Tea', 'Done']],
    [2, 'with-break', ['Coffee', 'Done']], [3, 'with-break', ['Water', 'Done']],
    [4, 'with-break', ['Water', 'Done']], [0, 'fall-through', ['Water', 'Done']],
    [1, 'fall-through', ['Tea', 'Coffee', 'Water', 'Done']],
    [2, 'fall-through', ['Coffee', 'Water', 'Done']],
    [3, 'fall-through', ['Water', 'Done']], [4, 'fall-through', ['Water', 'Done']],
  ])('choice %s in %s mode', (choice, mode, expected) => {
    const result = simulateSwitchProgram({ choice: choice as number, mode: mode as SwitchConfig['mode'] })
    expect(result.status).toBe('completed')
    expect(result.output).toEqual(expected)
    expect(result.frames.filter(f => f.phase === 'evaluate-switch')).toHaveLength(1)
    expect(result.frames.filter(f => f.phase === 'select-case')).toHaveLength(1)
    expect(result.frames.at(-1)?.memory.inScope).toBe(false)
    for (const frame of result.frames) expect(result.source.lines[frame.activeLine - 1]).toBeDefined()
  })
  it('retains the matched entry when flowing into default without comparing labels again', () => {
    const result = simulateSwitchProgram({ choice: 1, mode: 'fall-through' })
    const flow = result.frames.filter(f => f.phase === 'fall-through')
    expect(flow.map(f => f.activeCase)).toEqual(['case-2', 'default'])
    expect(flow.every(f => f.selectedCase === 'case-1')).toBe(true)
    expect(result.frames.some(f => f.phase === 'break')).toBe(false)
    expect(result.frames.find(f => f.phase === 'after-switch')?.output).toEqual(result.output)
  })
  it('jumps from break to the statement after switch', () => {
    const result = simulateSwitchProgram()
    const index = result.frames.findIndex(f => f.phase === 'break')
    expect(result.frames[index + 1].phase).toBe('after-switch')
    expect(result.frames[index].output).toEqual(['Coffee'])
  })
  it.each([NaN, Infinity, -1, 5, 1.5])('blocks invalid choice %s before initialization', choice => {
    const result = simulateSwitchProgram({ ...DEFAULT_SWITCH_CONFIG, choice })
    expect(result.frames.map(f => f.phase)).toEqual(['enter-main', 'blocked'])
    expect(result.output).toEqual([])
    expect(result.source.sourceText).not.toMatch(/NaN|Infinity/)
  })
  it('rejects invalid modes and isolates source inputs and snapshots', () => {
    expect(simulateSwitchProgram({ choice: 1, mode: 'bad' as SwitchConfig['mode'] }).status).toBe('blocked')
    const config: SwitchConfig = { choice: 1, mode: 'fall-through' }
    const result = simulateSwitchProgram(config)
    config.choice = 4
    expect(result.config.choice).toBe(1)
    result.frames[0].memory.choice = 99
    expect(result.frames[1].memory.choice).toBe(1)
    expect(result.frames[0].output).not.toBe(result.frames[1].output)
  })
})
