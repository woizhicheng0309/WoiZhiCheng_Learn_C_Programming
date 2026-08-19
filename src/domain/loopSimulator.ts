import {
  DEFAULT_LOOP_CONFIG,
  LOOP_LIMITS,
  type CSourcePart,
  type Comparator,
  type GeneratedLoopSource,
  type LoopConfig,
  type LoopFrame,
  type LoopPhase,
  type LoopValidationIssue,
  type SimulationBlockReason,
  type SimulationResult,
} from './types'

const LINE_BY_PHASE: Readonly<Record<LoopPhase, number>> = {
  init: 4,
  condition: 4,
  body: 5,
  increment: 4,
  done: 4,
  blocked: 4,
}

const PART_BY_PHASE: Readonly<Record<LoopPhase, CSourcePart>> = {
  init: 'initializer',
  condition: 'condition',
  body: 'body',
  increment: 'increment',
  done: 'exit',
  blocked: 'exit',
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) return '0'
  if (!Number.isFinite(value)) return String(value)
  if (Number.isInteger(value)) return String(value)

  const exponential = value.toExponential(12)
  const [coefficient, exponent] = exponential.split('e')
  const compactCoefficient = coefficient.replace(/(?:\.0+|(?:(\..*?)0+))$/, '$1')
  return `${compactCoefficient}e${Number(exponent)}`
}

function conditionForValue(value: number, config: LoopConfig): string {
  return `${formatNumber(value)} ${config.comparator} ${formatNumber(config.end)}`
}

function copyConfig(config: LoopConfig): Readonly<LoopConfig> {
  return {
    start: config.start,
    end: config.end,
    comparator: config.comparator,
    step: config.step,
  }
}

export function compareLoopValue(
  value: number,
  comparator: Comparator,
  end: number,
): boolean {
  switch (comparator) {
    case '<':
      return value < end
    case '<=':
      return value <= end
    case '>':
      return value > end
    case '>=':
      return value >= end
  }
}

export function validateLoopConfig(
  config: LoopConfig,
): readonly LoopValidationIssue[] {
  if (
    !Number.isFinite(config.start) ||
    !Number.isFinite(config.end) ||
    !Number.isFinite(config.step)
  ) {
    return [{ code: 'invalid-number', message: '所有參數都必須是有限數字。' }]
  }

  const issues: LoopValidationIssue[] = []

  if (config.start < LOOP_LIMITS.start.min || config.start > LOOP_LIMITS.start.max) {
    issues.push({
      code: 'start-out-of-range',
      message: `起始值必須介於 ${LOOP_LIMITS.start.min} 到 ${LOOP_LIMITS.start.max}。`,
    })
  }

  if (config.end < LOOP_LIMITS.end.min || config.end > LOOP_LIMITS.end.max) {
    issues.push({
      code: 'end-out-of-range',
      message: `終止值必須介於 ${LOOP_LIMITS.end.min} 到 ${LOOP_LIMITS.end.max}。`,
    })
  }

  if (config.step < LOOP_LIMITS.step.min || config.step > LOOP_LIMITS.step.max) {
    issues.push({
      code: 'step-out-of-range',
      message: `步進值必須介於 ${LOOP_LIMITS.step.min} 到 ${LOOP_LIMITS.step.max}。`,
    })
  }

  return issues
}

export function buildForLoopSource(
  config: LoopConfig = DEFAULT_LOOP_CONFIG,
): GeneratedLoopSource {
  const usesDecimal = [config.start, config.end, config.step].some(
    (value) => Number.isFinite(value) && !Number.isInteger(value),
  )
  const variableType = usesDecimal ? 'double' : 'int'
  const printFormat = usesDecimal ? '%g' : '%d'
  const stepOperator = config.step < 0 ? '-=' : '+='
  const stepMagnitude = formatNumber(Math.abs(config.step))
  const conditionExpression = `i ${config.comparator} ${formatNumber(config.end)}`

  return {
    lines: [
      { lineNumber: 1, code: '#include <stdio.h>', phases: [] },
      { lineNumber: 2, code: '', phases: [] },
      { lineNumber: 3, code: 'int main(void) {', phases: [] },
      {
        lineNumber: 4,
        code: `  for (${variableType} i = ${formatNumber(config.start)}; ${conditionExpression}; i ${stepOperator} ${stepMagnitude}) {`,
        phases: ['init', 'condition', 'increment', 'done', 'blocked'],
      },
      {
        lineNumber: 5,
        code: `    printf("${printFormat} ", i);`,
        phases: ['body'],
      },
      { lineNumber: 6, code: '  }', phases: [] },
      { lineNumber: 7, code: '  return 0;', phases: [] },
      { lineNumber: 8, code: '}', phases: [] },
    ],
    lineByPhase: LINE_BY_PHASE,
    partByPhase: PART_BY_PHASE,
    variableType,
    conditionExpression,
  }
}

function safetyBlockReason(config: LoopConfig): SimulationBlockReason | null {
  if (config.step === 0) return 'step-zero'

  const needsPositiveStep = config.comparator === '<' || config.comparator === '<='
  if (needsPositiveStep && config.step < 0) return 'wrong-direction'
  if (!needsPositiveStep && config.step > 0) return 'wrong-direction'
  return null
}

function blockMessage(reason: SimulationBlockReason): string {
  switch (reason) {
    case 'step-zero':
      return '條件為真，但步進值是 0，i 永遠不會改變，因此已阻止可能的無窮迴圈。'
    case 'wrong-direction':
      return '條件為真，但步進方向會讓 i 遠離終止條件，因此已阻止可能的無窮迴圈。'
    case 'iteration-limit':
      return `迴圈已達 ${LOOP_LIMITS.maxIterations} 次安全上限，已停止模擬。`
    default:
      return '參數不符合安全範圍，無法開始模擬。'
  }
}

export function simulateForLoop(
  config: LoopConfig = DEFAULT_LOOP_CONFIG,
): SimulationResult {
  const stableConfig = copyConfig(config)
  const source = buildForLoopSource(stableConfig)
  const frames: LoopFrame[] = []
  const output: number[] = []
  let value = stableConfig.start
  let completedIterations = 0

  const addFrame = (
    phase: LoopPhase,
    explanation: string,
    conditionResult: boolean | null = null,
    iteration = completedIterations,
  ) => {
    frames.push({
      index: frames.length,
      phase,
      iteration,
      currentValue: value,
      conditionExpression: conditionForValue(value, stableConfig),
      conditionResult,
      output: [...output],
      activeLine: source.lineByPhase[phase],
      activePart: source.partByPhase[phase],
      explanation,
    })
  }

  addFrame('init', `將 i 初始化為 ${formatNumber(value)}。`)

  const validationIssues = validateLoopConfig(stableConfig)
  if (validationIssues.length > 0) {
    const issue = validationIssues[0]
    addFrame('blocked', issue.message)
    return {
      config: stableConfig,
      source,
      frames,
      output,
      iterations: 0,
      status: 'blocked',
      blockReason: issue.code,
      message: issue.message,
    }
  }

  while (true) {
    const conditionResult = compareLoopValue(
      value,
      stableConfig.comparator,
      stableConfig.end,
    )
    const expression = conditionForValue(value, stableConfig)
    addFrame(
      'condition',
      `判斷 ${expression}，結果為${conditionResult ? '真' : '假'}。`,
      conditionResult,
    )

    if (!conditionResult) {
      const message = `條件為假，離開 for 迴圈；共執行 ${completedIterations} 次。`
      addFrame('done', message, false)
      return {
        config: stableConfig,
        source,
        frames,
        output: [...output],
        iterations: completedIterations,
        status: 'completed',
        blockReason: null,
        message,
      }
    }

    const unsafeDirection = safetyBlockReason(stableConfig)
    if (unsafeDirection) {
      const message = blockMessage(unsafeDirection)
      addFrame('blocked', message, true)
      return {
        config: stableConfig,
        source,
        frames,
        output: [...output],
        iterations: completedIterations,
        status: 'blocked',
        blockReason: unsafeDirection,
        message,
      }
    }

    if (completedIterations >= LOOP_LIMITS.maxIterations) {
      const message = blockMessage('iteration-limit')
      addFrame('blocked', message, true)
      return {
        config: stableConfig,
        source,
        frames,
        output: [...output],
        iterations: completedIterations,
        status: 'blocked',
        blockReason: 'iteration-limit',
        message,
      }
    }

    completedIterations += 1
    output.push(value)
    addFrame(
      'body',
      `條件為真，執行 printf，輸出 ${formatNumber(value)}。`,
      true,
      completedIterations,
    )

    const previousValue = value
    value += stableConfig.step
    addFrame(
      'increment',
      `執行 i ${stableConfig.step < 0 ? '-=' : '+='} ${formatNumber(Math.abs(stableConfig.step))}，i 從 ${formatNumber(previousValue)} 變成 ${formatNumber(value)}。`,
      null,
      completedIterations,
    )
  }
}
