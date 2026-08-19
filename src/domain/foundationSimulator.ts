export const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%'] as const
export type ArithmeticOperator = (typeof ARITHMETIC_OPERATORS)[number]

export const LOGICAL_OPERATORS = ['&&', '||'] as const
export type LogicalOperator = (typeof LOGICAL_OPERATORS)[number]

export interface IntegerExpressionResult {
  expression: string
  result: number | null
  status: 'ok' | 'blocked'
  explanation: string
}

const arithmeticNames: Record<ArithmeticOperator, string> = {
  '+': '加法',
  '-': '減法',
  '*': '乘法',
  '/': '整數除法',
  '%': '取餘數',
}

/**
 * Evaluate the same small, integer-only expression shown by the variables lab.
 * C integer division truncates toward zero, so Math.trunc is intentional here.
 */
export function evaluateIntegerExpression(
  left: number,
  right: number,
  operator: ArithmeticOperator,
): IntegerExpressionResult {
  const expression = `${left} ${operator} ${right}`

  if (!Number.isInteger(left) || !Number.isInteger(right)) {
    return {
      expression,
      result: null,
      status: 'blocked',
      explanation: '這個實驗只使用 int，請輸入整數。',
    }
  }

  if ((operator === '/' || operator === '%') && right === 0) {
    return {
      expression,
      result: null,
      status: 'blocked',
      explanation: '除數不能是 0，因此程式不會進行這次運算。',
    }
  }

  let result: number
  switch (operator) {
    case '+':
      result = left + right
      break
    case '-':
      result = left - right
      break
    case '*':
      result = left * right
      break
    case '/':
      result = Math.trunc(left / right)
      break
    case '%': {
      const quotient = Math.trunc(left / right)
      result = left - quotient * right
      break
    }
  }

  const integerDivisionNote = operator === '/'
    ? '；因為兩邊都是 int，小數部分會被捨去'
    : ''

  return {
    expression,
    result,
    status: 'ok',
    explanation: `讀取兩個變數的值，進行${arithmeticNames[operator]}，將 ${result} 存入 result${integerDivisionNote}。`,
  }
}

export interface ConditionalEvaluation {
  scorePasses: boolean
  attendancePasses: boolean
  result: boolean
  expression: string
  selectedBranch: 'if' | 'else'
  output: '通過' | '再練習'
  explanation: string
}

export const SCORE_THRESHOLD = 60
export const ATTENDANCE_THRESHOLD = 70

/** Evaluate the two comparisons and the logical operator used by the conditionals lab. */
export function evaluateCourseCondition(
  score: number,
  attendance: number,
  logicalOperator: LogicalOperator,
): ConditionalEvaluation {
  const scorePasses = score >= SCORE_THRESHOLD
  const attendancePasses = attendance >= ATTENDANCE_THRESHOLD
  const result = logicalOperator === '&&'
    ? scorePasses && attendancePasses
    : scorePasses || attendancePasses
  const selectedBranch = result ? 'if' : 'else'
  const logicalDescription = logicalOperator === '&&'
    ? '兩個條件都要成立'
    : '只要一個條件成立'

  return {
    scorePasses,
    attendancePasses,
    result,
    expression: `score >= ${SCORE_THRESHOLD} ${logicalOperator} attendance >= ${ATTENDANCE_THRESHOLD}`,
    selectedBranch,
    output: result ? '通過' : '再練習',
    explanation: `${logicalOperator} 代表${logicalDescription}；整個表達式是 ${result ? 'true' : 'false'}，所以執行 ${selectedBranch} 區塊。`,
  }
}
