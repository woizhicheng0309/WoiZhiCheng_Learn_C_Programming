import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  Info,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  ChallengePanel,
  LabShell,
  PlaybackControls,
  SourceCodePanel,
  type ChallengePanelItem,
  type SourceCodeLine,
} from '../components/lab'
import {
  ARITHMETIC_OPERATORS,
  DEFAULT_VARIABLE_CONFIG,
  VARIABLE_LIMITS,
  buildVariableSource,
  formatVariableNumber,
  simulateVariableProgram,
  type ArithmeticOperator,
  type GeneratedVariableSource,
  type VariableConfig,
  type VariableFrame,
  type VariableMemoryCell,
  type VariablePhase,
  type VariableSourcePart,
} from '../domain/variables'
import {
  VARIABLE_CHALLENGES,
  VARIABLE_DIAGNOSIS_OPTIONS,
  evaluateDivisionPrediction,
  evaluateDivisionRepair,
  evaluateMakeFourteen,
  type VariableChallengeEvaluation,
  type VariableChallengeId,
  type VariableDiagnosis,
} from '../data/variableChallenges'
import { useLearningProgress } from '../hooks/useLearningProgress'
import {
  useTracePlayer,
  type PlaybackSpeed,
} from '../hooks/useTracePlayer'

const LESSON_ID = 'variables-basics' as const

const phaseLabels: Readonly<Record<VariablePhase, string>> = {
  main: '進入 main',
  'init-x': '初始化 x',
  'init-y': '初始化 y',
  'declare-result': '宣告 result',
  evaluate: '計算算式',
  assign: '賦值',
  print: '輸出',
  return: '回傳',
  done: '完成',
  blocked: '安全停止',
}

const operatorLabels: Readonly<Record<ArithmeticOperator, string>> = {
  '+': '加法',
  '-': '減法',
  '*': '乘法',
  '/': '除法',
  '%': '取餘數',
}

type VariableCodePart = VariableSourcePart | 'plain'

function isSavedVariableConfig(value: unknown): value is VariableConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const state = value as Record<string, unknown>
  return (
    (state.valueType === 'int' || state.valueType === 'double') &&
    typeof state.x === 'number' &&
    Number.isFinite(state.x) &&
    typeof state.y === 'number' &&
    Number.isFinite(state.y) &&
    typeof state.operator === 'string' &&
    ARITHMETIC_OPERATORS.includes(state.operator as ArithmeticOperator)
  )
}

function readSavedConfig(value: unknown): VariableConfig {
  return isSavedVariableConfig(value)
    ? { ...value }
    : { ...DEFAULT_VARIABLE_CONFIG }
}

function configKey(config: VariableConfig): string {
  return `${config.valueType}:${config.x}:${config.operator}:${config.y}`
}

function sourceLinesFor(
  source: GeneratedVariableSource,
): readonly SourceCodeLine<VariableCodePart>[] {
  return source.lines.map((line) => {
    switch (line.lineNumber) {
      case 3:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'main-signature', text: line.code || ' ' }],
        }
      case 4:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'x-initializer', text: line.code }],
        }
      case 5:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'y-initializer', text: line.code }],
        }
      case 6:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'result-declaration', text: line.code }],
        }
      case 7:
        return {
          lineNumber: line.lineNumber,
          parts: [
            { id: 'assignment', text: '  result = ' },
            { id: 'expression', text: source.expression },
            { id: 'plain', text: ';' },
          ],
        }
      case 8:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'printf', text: line.code }],
        }
      case 9:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'return', text: line.code }],
        }
      case 10:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'exit', text: line.code }],
        }
      default:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: 'plain', text: line.code || ' ' }],
        }
    }
  })
}

function cellText(cell: Readonly<VariableMemoryCell>): string {
  if (!cell.declared) return '尚未宣告'
  if (!cell.initialized) return '尚未賦值'
  return cell.value === null ? '—' : formatVariableNumber(cell.value)
}

interface NumberControlProps {
  id: string
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  hint?: string
  onChange: (value: number) => void
}

function NumberControl({
  id,
  label,
  value,
  min = VARIABLE_LIMITS.x.min,
  max = VARIABLE_LIMITS.x.max,
  step = 1,
  hint,
  onChange,
}: NumberControlProps) {
  const update = (rawValue: string) => {
    const next = Number(rawValue)
    if (Number.isFinite(next)) onChange(next)
  }

  return (
    <div className="variables-number-control">
      <div className="variables-control-label">
        <label htmlFor={`${id}-number`}>{label}</label>
        {hint && <small>{hint}</small>}
      </div>
      <div className="variables-number-control__inputs">
        <input
          id={`${id}-range`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={`${label}滑桿`}
          onChange={(event) => update(event.target.value)}
        />
        <input
          id={`${id}-number`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          inputMode="decimal"
          onChange={(event) => update(event.target.value)}
        />
      </div>
    </div>
  )
}

function MemoryCell({
  name,
  cell,
  changed,
}: {
  name: 'x' | 'y' | 'result'
  cell: Readonly<VariableMemoryCell>
  changed: boolean
}) {
  const state = !cell.declared
    ? 'undeclared'
    : cell.initialized
      ? 'initialized'
      : 'uninitialized'

  return (
    <div
      className={`variables-memory-cell is-${state}${changed ? ' is-changing' : ''}`}
      aria-label={`${name}：${cellText(cell)}`}
    >
      <div className="variables-memory-cell__header">
        <code>{name}</code>
        <span>{cell.valueType ?? '—'}</span>
      </div>
      <strong>{cellText(cell)}</strong>
      <small>
        {!cell.declared
          ? '記憶體尚未配置'
          : cell.initialized
            ? '目前儲存值'
            : '已宣告，值未定義'}
      </small>
    </div>
  )
}

function MemoryPanel({ frame }: { frame: VariableFrame }) {
  const changed = (name: 'x' | 'y' | 'result') => (
    JSON.stringify(frame.memoryBefore[name]) !== JSON.stringify(frame.memoryAfter[name])
  )

  return (
    <section className="lab-panel variables-memory-panel" aria-labelledby="memory-title">
      <div className="variables-panel-heading">
        <div>
          <span className="variables-panel-icon"><BookOpen size={17} aria-hidden="true" /></span>
          <h2 id="memory-title">記憶盒</h2>
        </div>
        <span className="variables-step-chip">STEP {String(frame.index + 1).padStart(2, '0')}</span>
      </div>
      <p className="variables-panel-intro">每個盒子代表一個變數目前在記憶體中的狀態。</p>
      <div className="variables-memory-grid">
        <MemoryCell name="x" cell={frame.memoryAfter.x} changed={changed('x')} />
        <MemoryCell name="y" cell={frame.memoryAfter.y} changed={changed('y')} />
        <MemoryCell
          name="result"
          cell={frame.memoryAfter.result}
          changed={changed('result')}
        />
      </div>
    </section>
  )
}

function ExpressionPanel({ frame }: { frame: VariableFrame }) {
  const before = cellText(frame.memoryBefore.result)
  const after = cellText(frame.memoryAfter.result)
  const hasOutput = frame.output.length > 0

  return (
    <section
      className="lab-panel variables-expression-panel"
      aria-labelledby="expression-title"
    >
      <div className="variables-panel-heading">
        <div>
          <span className="variables-panel-icon"><Calculator size={17} aria-hidden="true" /></span>
          <h2 id="expression-title">算式與輸出</h2>
        </div>
        <span className={`variables-status-chip is-${frame.phase}`}>
          {phaseLabels[frame.phase]}
        </span>
      </div>

      <div className="variables-expression-breakdown" aria-label="目前算式拆解">
        <div><small>x</small><strong>{cellText(frame.memoryAfter.x)}</strong></div>
        <code>{frame.expression.split(' ')[1] ?? '?'}</code>
        <div><small>y</small><strong>{cellText(frame.memoryAfter.y)}</strong></div>
        <span>=</span>
        <div className="is-result">
          <small>計算結果</small>
          <strong>{frame.evaluatedValue === null ? '？' : formatVariableNumber(frame.evaluatedValue)}</strong>
        </div>
      </div>

      <div className="variables-before-after">
        <div><small>result · BEFORE</small><code>{before}</code></div>
        <ArrowRight size={20} aria-hidden="true" />
        <div><small>result · AFTER</small><code>{after}</code></div>
      </div>

      <div className="variables-console">
        <div><Terminal size={15} aria-hidden="true" /><span>printf 輸出</span></div>
        <code>{hasOutput ? frame.output.map(formatVariableNumber).join(' ') : '尚無輸出'}</code>
      </div>
    </section>
  )
}

function ChallengeFeedback({
  evaluation,
}: {
  evaluation: VariableChallengeEvaluation | null
}) {
  if (!evaluation) return null
  return (
    <div
      className={`variables-challenge-feedback ${evaluation.solved ? 'is-success' : 'is-hint'}`}
      role="status"
    >
      {evaluation.solved
        ? <CheckCircle2 size={18} aria-hidden="true" />
        : <Info size={18} aria-hidden="true" />}
      <span>{evaluation.message}</span>
    </div>
  )
}

export function VariablesBasicsPage() {
  const {
    getLessonProgress,
    markGuidedRunCompleted,
    markChallengeCompleted,
    rememberLessonState,
    visitLesson,
    resetProgress,
  } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState<VariableConfig>(() =>
    readSavedConfig(lessonProgress.savedState),
  )
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [playerUnlocked, setPlayerUnlocked] = useState(
    lessonProgress.guidedRunCompleted,
  )
  const [prediction, setPrediction] = useState('')
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [predictionResult, setPredictionResult] = useState<{
    expression: string
    predicted: number
    actual: number
    matched: boolean
  } | null>(null)
  const [activeChallengeId, setActiveChallengeId] = useState<VariableChallengeId>(
    () => VARIABLE_CHALLENGES.find((challenge) => (
      !lessonProgress.completedChallengeIds.includes(challenge.id)
    ))?.id ?? VARIABLE_CHALLENGES[0].id,
  )
  const [challengePrediction, setChallengePrediction] = useState('')
  const [challengeConfig, setChallengeConfig] = useState<VariableConfig>(() => ({
    valueType: 'int',
    x: 5,
    y: 2,
    operator: '+',
  }))
  const [repairY, setRepairY] = useState(0)
  const [diagnosis, setDiagnosis] = useState<VariableDiagnosis | null>(null)
  const [challengeFeedback, setChallengeFeedback] = useState<
    Partial<Record<VariableChallengeId, VariableChallengeEvaluation>>
  >({})
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const clearTriggerRef = useRef<HTMLButtonElement>(null)
  const clearConfirmRef = useRef<HTMLButtonElement>(null)

  const simulation = useMemo(() => simulateVariableProgram(config), [config])
  const sourceLines = useMemo(
    () => sourceLinesFor(buildVariableSource(config)),
    [config],
  )
  const player = useTracePlayer({
    frames: simulation.frames,
    speed,
    config: configKey(config),
  })
  const frame = player.frame ?? simulation.frames[0]
  const completedCount = VARIABLE_CHALLENGES.filter((challenge) => (
    lessonProgress.completedChallengeIds.includes(challenge.id)
  )).length
  const lessonCompleted = completedCount === VARIABLE_CHALLENGES.length

  useEffect(() => {
    visitLesson(LESSON_ID)
  }, [visitLesson])

  useEffect(() => {
    if (playerUnlocked && player.atEnd && frame.phase === 'done') {
      markGuidedRunCompleted(LESSON_ID)
    }
  }, [frame.phase, markGuidedRunCompleted, player.atEnd, playerUnlocked])

  useEffect(() => {
    if (showClearConfirm) clearConfirmRef.current?.focus()
  }, [showClearConfirm])

  const saveConfig = (next: VariableConfig) => {
    setConfig(next)
    setPrediction('')
    setPredictionResult(null)
    setPredictionError(null)
    rememberLessonState(LESSON_ID, {
      valueType: next.valueType,
      x: next.x,
      y: next.y,
      operator: next.operator,
    })
  }

  const changeConfig = <Key extends keyof VariableConfig>(
    key: Key,
    value: VariableConfig[Key],
  ) => {
    const next = { ...config, [key]: value }
    if (key === 'valueType' && value === 'int') {
      next.x = Math.trunc(next.x)
      next.y = Math.trunc(next.y)
    }
    saveConfig(next)
  }

  const restoreDefaults = () => {
    saveConfig({ ...DEFAULT_VARIABLE_CONFIG })
    setPrediction('')
    setPredictionResult(null)
  }

  const submitPrediction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (simulation.status === 'blocked' || simulation.resultValue === null) {
      setPredictionError(`這組參數無法得到合法結果：${simulation.message}`)
      return
    }
    if (prediction.trim() === '' || !Number.isFinite(Number(prediction))) {
      setPredictionError('請先輸入一個有限數字作為你的預測。')
      return
    }

    const predicted = Number(prediction)
    setPredictionResult({
      expression: `${formatVariableNumber(config.x)} ${config.operator} ${formatVariableNumber(config.y)}`,
      predicted,
      actual: simulation.resultValue,
      matched: Object.is(predicted, simulation.resultValue),
    })
    setPredictionError(null)
    setPlayerUnlocked(true)
    player.reset()
  }

  const completeChallenge = (
    id: VariableChallengeId,
    evaluation: VariableChallengeEvaluation,
  ) => {
    setChallengeFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) {
      markChallengeCompleted(LESSON_ID, id)
    }
  }

  const checkPredictionChallenge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = challengePrediction.trim() === ''
      ? null
      : Number(challengePrediction)
    completeChallenge(
      'predict-int-division',
      evaluateDivisionPrediction(value !== null && Number.isFinite(value) ? value : null),
    )
  }

  const checkConfigurationChallenge = () => {
    completeChallenge('make-fourteen', evaluateMakeFourteen(challengeConfig))
  }

  const checkRepairChallenge = () => {
    completeChallenge(
      'repair-division-by-zero',
      evaluateDivisionRepair(diagnosis, {
        valueType: 'int',
        x: 8,
        y: repairY,
        operator: '/',
      }),
    )
  }

  const cancelClear = () => {
    setShowClearConfirm(false)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const handleClearDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelClear()
      return
    }
    if (event.key !== 'Tab') return

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    )
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const clearAllProgress = () => {
    resetProgress()
    setConfig({ ...DEFAULT_VARIABLE_CONFIG })
    setPlayerUnlocked(false)
    setPrediction('')
    setPredictionError(null)
    setPredictionResult(null)
    setActiveChallengeId(VARIABLE_CHALLENGES[0].id)
    setChallengePrediction('')
    setChallengeConfig({ valueType: 'int', x: 5, y: 2, operator: '+' })
    setRepairY(0)
    setDiagnosis(null)
    setChallengeFeedback({})
    setShowClearConfirm(false)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const challengeItems: readonly ChallengePanelItem<VariableChallengeId>[] =
    VARIABLE_CHALLENGES.map((challenge) => ({
      id: challenge.id,
      label: challenge.title,
      eyebrow: `CHALLENGE ${String(challenge.order).padStart(2, '0')}`,
      completed: lessonProgress.completedChallengeIds.includes(challenge.id),
    }))

  const liveAnnouncement = frame.phase === 'print'
    ? `程式輸出 ${frame.output.map(formatVariableNumber).join(' ')}`
    : frame.phase === 'done' || frame.phase === 'blocked'
      ? frame.explanation
      : ''

  const controls = (
    <details className="variables-controls" open>
      <summary>
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span><small>CONTROL PANEL</small>調整變數</span>
      </summary>
      <div className="variables-controls__body">
        <fieldset className="variables-type-control">
          <legend>資料型別</legend>
          <div role="radiogroup" aria-label="資料型別">
            {(['int', 'double'] as const).map((valueType) => (
              <button
                type="button"
                role="radio"
                aria-checked={config.valueType === valueType}
                className={config.valueType === valueType ? 'is-active' : ''}
                key={valueType}
                onClick={() => changeConfig('valueType', valueType)}
              >
                <code>{valueType}</code>
                <small>{valueType === 'int' ? '整數' : '小數'}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <NumberControl
          id="variable-x"
          label="x 的值"
          hint={`${VARIABLE_LIMITS.x.min} 到 ${VARIABLE_LIMITS.x.max}`}
          value={config.x}
          step={config.valueType === 'double' ? VARIABLE_LIMITS.doubleStep : 1}
          onChange={(value) => changeConfig('x', value)}
        />
        <NumberControl
          id="variable-y"
          label="y 的值"
          hint={`${VARIABLE_LIMITS.y.min} 到 ${VARIABLE_LIMITS.y.max}`}
          value={config.y}
          step={config.valueType === 'double' ? VARIABLE_LIMITS.doubleStep : 1}
          onChange={(value) => changeConfig('y', value)}
        />

        <div className="variables-operator-control">
          <label htmlFor="variable-operator">算術運算子</label>
          <select
            id="variable-operator"
            value={config.operator}
            onChange={(event) => changeConfig(
              'operator',
              event.target.value as ArithmeticOperator,
            )}
          >
            {ARITHMETIC_OPERATORS.map((operator) => (
              <option value={operator} key={operator}>
                {operator} — {operatorLabels[operator]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="variables-restore-button"
          onClick={restoreDefaults}
        >
          <RotateCcw size={16} aria-hidden="true" /> 恢復預設參數
        </button>

        <div className="variables-safety-note">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>只模擬這組受限參數，不會編譯或執行任意 C 程式碼。</p>
        </div>
      </div>
    </details>
  )

  return (
    <div className="variables-page lab-page">
      <section className="variables-hero lab-hero">
        <div className="page-width">
          <nav className="breadcrumbs" aria-label="麵包屑">
            <Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" />
            <span>變數與運算</span>
          </nav>
          <div className="variables-hero__layout">
            <div className="variables-hero__copy">
              <Link className="back-link" to="/learn">
                <ArrowLeft size={16} aria-hidden="true" /> 回到課程地圖
              </Link>
              <span className="section-kicker">MODULE 01 · LESSON 01</span>
              <h1>從程式骨架開始，<br />看見變數如何記住一個值。</h1>
              <p>
                先預測，再逐步執行。你會親眼看到宣告、初始化、計算、賦值與輸出各自發生在哪一步。
              </p>
            </div>
            <aside
              className={`lesson-status-card${lessonCompleted ? ' complete' : ''}`}
              aria-label="本單元學習進度"
            >
              <div>
                {lessonCompleted
                  ? <Trophy size={21} aria-hidden="true" />
                  : <BookOpen size={21} aria-hidden="true" />}
                <span>{lessonCompleted ? '單元完成' : '學習進度'}</span>
              </div>
              <strong>{completedCount}<small>/3</small></strong>
              <p>{lessonCompleted ? '三個挑戰全部完成！' : '通過三題即可完成這個單元'}</p>
            </aside>
          </div>
        </div>
      </section>

      <div className="variables-page__content">
        <section className="variables-overview page-width" aria-labelledby="objectives-title">
          <div className="variables-objectives">
            <span className="section-kicker">LEARNING GOALS</span>
            <h2 id="objectives-title">這一課，你會學會什麼？</h2>
            <ul>
              <li><Check size={17} aria-hidden="true" />辨認 C 程式從 <code>main</code> 開始執行。</li>
              <li><Check size={17} aria-hidden="true" />分清楚宣告、初始化與賦值。</li>
              <li><Check size={17} aria-hidden="true" />預測 <code>int</code> 與 <code>double</code> 的算術結果。</li>
            </ul>
          </div>
          <div className="variables-concepts" aria-label="概念短講">
            <article>
              <span><Code2 size={18} aria-hidden="true" /></span>
              <small>01 · 程式入口</small>
              <h3><code>main</code> 是起點</h3>
              <p>電腦會由上而下執行 <code>main</code> 裡的敘述。</p>
            </article>
            <article>
              <span><BookOpen size={18} aria-hidden="true" /></span>
              <small>02 · 變數</small>
              <h3>型別決定怎麼存</h3>
              <p><code>int</code> 存整數；<code>double</code> 可以保留小數。</p>
            </article>
            <article>
              <span><Calculator size={18} aria-hidden="true" /></span>
              <small>03 · 賦值</small>
              <h3>先算右邊，再存左邊</h3>
              <p><code>result = x + y;</code> 會先算算式，最後才更新 result。</p>
            </article>
          </div>
        </section>

        <section className="variables-prediction-section" aria-labelledby="prediction-title">
          <div className="page-width variables-prediction-card">
            <div className="variables-prediction-card__copy">
              <span className="section-kicker">PREDICT BEFORE RUN</span>
              <h2 id="prediction-title">先別按播放。你猜會輸出多少？</h2>
              <p>提交後才會解鎖逐步播放器；答錯也沒關係，差異正是學習的線索。</p>
              <code className="variables-prediction-expression">
                {config.valueType} result = {formatVariableNumber(config.x)} {config.operator} {formatVariableNumber(config.y)};
              </code>
            </div>
            <form className="variables-prediction-form" onSubmit={submitPrediction}>
              <label htmlFor="guided-prediction">我預測 printf 會輸出</label>
              <div>
                <input
                  id="guided-prediction"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={prediction}
                  onChange={(event) => setPrediction(event.target.value)}
                  aria-describedby="guided-prediction-help"
                />
                <button type="submit" className="button button-primary">
                  提交預測 <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
              <small id="guided-prediction-help">可以填整數或小數。</small>
              {predictionError && <p className="variables-form-error" role="alert">{predictionError}</p>}
            </form>
            {predictionResult && frame.output.length === 0 && (
              <div className="variables-prediction-result is-pending" role="status">
                <Circle size={20} aria-hidden="true" />
                <div>
                  <strong>預測已記錄，現在請逐步執行。</strong>
                  <span>走到 <code>printf</code> 時，才會揭曉並比較實際輸出。</span>
                </div>
              </div>
            )}
            {predictionResult && frame.output.length > 0 && (
              <div
                className={`variables-prediction-result ${predictionResult.matched ? 'is-match' : 'is-different'}`}
                role="status"
              >
                {predictionResult.matched
                  ? <CheckCircle2 size={20} aria-hidden="true" />
                  : <Lightbulb size={20} aria-hidden="true" />}
                <div>
                  <strong>{predictionResult.matched ? '預測正確！' : '結果不一樣，來看看原因。'}</strong>
                  <span>
                    {predictionResult.expression}：你猜 {formatVariableNumber(predictionResult.predicted)}，實際是 {formatVariableNumber(predictionResult.actual)}。
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="variables-lab-section" aria-labelledby="lab-title">
          <div className="page-width">
            <div className="variables-section-heading">
              <span className="section-kicker">STEP THROUGH THE PROGRAM</span>
              <h2 id="lab-title">逐步執行，觀察記憶體怎麼改變。</h2>
              <p>修改參數會立即產生一份新的安全軌跡；畫面只呈現模擬器已計算好的狀態。</p>
            </div>

            <LabShell
              className="variables-lab-shell"
              controls={controls}
              controlsLabel="變數與運算控制參數"
              playback={playerUnlocked ? (
                <PlaybackControls
                  playing={player.playing}
                  atStart={player.atStart}
                  atEnd={player.atEnd}
                  speed={speed}
                  onPlay={player.play}
                  onPause={player.pause}
                  onNext={player.next}
                  onReset={player.reset}
                  onReplay={player.replay}
                  onSpeedChange={setSpeed}
                />
              ) : (
                <div className="variables-player-lock" role="status">
                  <Circle size={15} aria-hidden="true" /> 提交上方預測後解鎖播放與單步控制
                </div>
              )}
            >
              {simulation.status === 'blocked' && frame.phase === 'blocked' && (
                <div className="variables-blocked-banner" role="alert">
                  <ShieldAlert size={19} aria-hidden="true" />
                  <div><strong>已阻止不合法的運算</strong><span>{simulation.message}</span></div>
                </div>
              )}

              <div className="variables-execution-grid">
                <SourceCodePanel<VariableCodePart>
                  className="variables-source-panel"
                  lines={sourceLines}
                  activeLine={frame.activeLine}
                  activePart={frame.activePart}
                  title="C 程式碼"
                  status={phaseLabels[frame.phase]}
                  explanation={frame.explanation}
                />
                <MemoryPanel frame={frame} />
                <ExpressionPanel frame={frame} />
              </div>
            </LabShell>
          </div>
        </section>

        <section className="variables-challenges" aria-labelledby="challenges-title">
          <div className="page-width">
            <div className="variables-section-heading variables-challenges__heading">
              <span className="section-kicker">PUT IT INTO PRACTICE</span>
              <h2 id="challenges-title">預測、調參數、找錯：三種方式驗證理解。</h2>
              <p>每題都依程式實際模擬結果判定；全部通過後，這個單元才會完成。</p>
            </div>

            <ChallengePanel
              className="variables-challenge-panel"
              challenges={challengeItems}
              activeId={activeChallengeId}
              onSelect={setActiveChallengeId}
              label="變數與運算挑戰"
            >
              {(item) => {
                const definition = VARIABLE_CHALLENGES.find(
                  (challenge) => challenge.id === item.id,
                )!
                const feedback = challengeFeedback[item.id] ?? null

                if (item.id === 'predict-int-division') {
                  return (
                    <div className="variables-challenge-card">
                      <span className="variables-challenge-kind"><Sparkles size={16} /> 預測題</span>
                      <h3>{definition.description}</h3>
                      <code className="variables-challenge-code">int result = 5 / 2;</code>
                      <form onSubmit={checkPredictionChallenge}>
                        <label htmlFor="challenge-one-prediction">我預測輸出是</label>
                        <input
                          id="challenge-one-prediction"
                          type="number"
                          step="any"
                          inputMode="decimal"
                          value={challengePrediction}
                          onChange={(event) => setChallengePrediction(event.target.value)}
                        />
                        <button type="submit" className="button button-primary">提交並揭曉</button>
                      </form>
                      {feedback && (
                        <div className="variables-challenge-actual">
                          實際輸出：<code>{feedback.simulation.output.join(' ')}</code>
                        </div>
                      )}
                      {feedback && (
                        <div
                          className="variables-challenge-trace"
                          aria-label="5 除以 2 的逐步執行軌跡"
                        >
                          <div>
                            <span>揭曉逐步軌跡</span>
                            <small>{feedback.simulation.frames.length} STEPS</small>
                          </div>
                          <ol>
                            {feedback.simulation.frames.map((traceFrame) => (
                              <li key={traceFrame.index}>
                                <span>{String(traceFrame.index + 1).padStart(2, '0')}</span>
                                <div>
                                  <code>{phaseLabels[traceFrame.phase]}</code>
                                  <p>{traceFrame.explanation}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <ChallengeFeedback evaluation={feedback} />
                    </div>
                  )
                }

                if (item.id === 'make-fourteen') {
                  return (
                    <div className="variables-challenge-card">
                      <span className="variables-challenge-kind"><SlidersHorizontal size={16} /> 調參數</span>
                      <h3>{definition.description}</h3>
                      <div className="variables-fixed-program">
                        <span>固定條件</span><code>int · x + y</code>
                      </div>
                      <div className="variables-challenge-controls">
                        <NumberControl
                          id="challenge-two-x"
                          label="x"
                          value={challengeConfig.x}
                          onChange={(x) => setChallengeConfig((current) => ({ ...current, x }))}
                        />
                        <NumberControl
                          id="challenge-two-y"
                          label="y"
                          value={challengeConfig.y}
                          onChange={(y) => setChallengeConfig((current) => ({ ...current, y }))}
                        />
                      </div>
                      <div className="variables-challenge-preview">
                        目前算式：<code>{challengeConfig.x} + {challengeConfig.y}</code>
                      </div>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={checkConfigurationChallenge}
                      >
                        檢查實際輸出
                      </button>
                      <ChallengeFeedback evaluation={feedback} />
                    </div>
                  )
                }

                return (
                  <div className="variables-challenge-card">
                    <span className="variables-challenge-kind"><ShieldAlert size={16} /> 找錯題</span>
                    <h3>{definition.description}</h3>
                    <code className="variables-challenge-code is-blocked">int result = 8 / 0;</code>
                    <fieldset className="variables-diagnosis-options">
                      <legend>第一步：為什麼程式無法執行？</legend>
                      {VARIABLE_DIAGNOSIS_OPTIONS.map((option) => (
                        <label key={option.id}>
                          <input
                            type="radio"
                            name="division-diagnosis"
                            value={option.id}
                            checked={diagnosis === option.id}
                            onChange={() => setDiagnosis(option.id)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </fieldset>
                    <div className="variables-repair-control">
                      <NumberControl
                        id="challenge-three-y"
                        label="第二步：只調整 y"
                        value={repairY}
                        onChange={setRepairY}
                      />
                      <code>8 / {repairY}</code>
                    </div>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={checkRepairChallenge}
                    >
                      檢查診斷與修正
                    </button>
                    <ChallengeFeedback evaluation={feedback} />
                  </div>
                )
              }}
            </ChallengePanel>

            {lessonCompleted && (
              <div className="variables-completion-banner" role="status">
                <span><Trophy size={26} aria-hidden="true" /></span>
                <div>
                  <small>LESSON COMPLETE</small>
                  <h2>做得很好，你已完成變數與運算單元！</h2>
                  <p>你已能分辨型別、追蹤記憶體，並解釋算式如何變成輸出。</p>
                </div>
                <Link className="button button-light" to="/learn">
                  回到課程地圖 <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="variables-recap" aria-labelledby="recap-title">
          <div className="page-width variables-recap__layout">
            <div>
              <span className="section-kicker">KEY TAKEAWAYS</span>
              <h2 id="recap-title">離開前，記住這四件事。</h2>
            </div>
            <ol>
              <li><span>01</span><p><code>main</code> 是程式進入點，敘述通常由上往下執行。</p></li>
              <li><span>02</span><p>宣告建立變數；初始化是在建立時給值；賦值是之後更新值。</p></li>
              <li><span>03</span><p>賦值敘述會先計算等號右側，再把結果存進左側變數。</p></li>
              <li><span>04</span><p><code>int</code> 除法會向零截斷；除數為 0 永遠不是合法運算。</p></li>
            </ol>
          </div>
        </section>

        <section className="progress-management variables-progress-management">
          <div className="page-width">
            {!showClearConfirm ? (
              <button
                ref={clearTriggerRef}
                type="button"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 size={16} aria-hidden="true" /> 清除這台裝置的學習進度
              </button>
            ) : (
              <div
                className="clear-confirm variables-clear-confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="clear-progress-title"
                aria-describedby="clear-progress-description"
                onKeyDown={handleClearDialogKeyDown}
              >
                <div>
                  <strong id="clear-progress-title">確定清除全部進度？</strong>
                  <span id="clear-progress-description">所有單元、挑戰與參數紀錄都會被移除，且無法復原。</span>
                </div>
                <button ref={clearConfirmRef} type="button" onClick={clearAllProgress}>確定清除</button>
                <button type="button" onClick={cancelClear}>取消</button>
              </div>
            )}
          </div>
        </section>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </p>
      </div>
    </div>
  )
}
