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
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  Info,
  Layers3,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  SquareFunction,
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
  DEFAULT_FUNCTION_CONFIG,
  FUNCTION_LIMITS,
  buildFunctionSource,
  simulateFunctionProgram,
  validateFunctionConfig,
  type FunctionConfig,
  type FunctionFrame,
  type FunctionPhase,
  type FunctionStackFrameStatus,
  type FunctionVariableState,
  type GeneratedFunctionSource,
} from '../domain'
import {
  FUNCTION_CHALLENGES,
  FUNCTION_SCOPE_OPTIONS,
  evaluateFunctionPrediction,
  evaluateFunctionScope,
  evaluateMakeReturnTen,
  type FunctionChallengeEvaluation,
  type FunctionChallengeId,
  type FunctionScopeAnswer,
} from '../data'
import { useLearningProgress } from '../hooks/useLearningProgress'
import {
  useTracePlayer,
  type PlaybackSpeed,
} from '../hooks/useTracePlayer'

const LESSON_ID = 'functions-basics' as const

const phaseLabels: Record<FunctionPhase, string> = {
  'enter-main': '進入 main',
  'init-x': '初始化 x',
  'init-y': '初始化 y',
  'call-add': '呼叫 add',
  'bind-parameters': '綁定參數 a、b',
  'declare-result': '宣告 result',
  'calculate-result': '計算 result',
  'return-add': 'add 回傳',
  'assign-answer': '儲存回傳值',
  print: '輸出 answer',
  'return-main': 'main 回傳',
  done: '執行完成',
  blocked: '安全停止',
}

const stackStatusLabels: Record<FunctionStackFrameStatus, string> = {
  'not-created': '尚未建立',
  active: '執行中',
  suspended: '等待 add 回傳',
  returned: '已離開作用域',
}

function readSavedConfig(value: unknown): FunctionConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_FUNCTION_CONFIG }
  }

  const candidate = value as Record<string, unknown>
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
    return { ...DEFAULT_FUNCTION_CONFIG }
  }

  const config = { x: candidate.x, y: candidate.y }
  return validateFunctionConfig(config).length === 0
    ? config
    : { ...DEFAULT_FUNCTION_CONFIG }
}

function functionConfigKey(config: FunctionConfig): string {
  return `${config.x}:${config.y}`
}

function sourceLinesFor(
  source: GeneratedFunctionSource,
): readonly SourceCodeLine<string>[] {
  return source.lines.map((line) => {
    const wholeLine = [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }]

    switch (line.lineNumber) {
      case 3:
        return {
          lineNumber: 3,
          parts: [
            { id: 'line-3-prefix', text: 'int add(int ' },
            { id: 'parameters', text: 'a, int b' },
            { id: 'line-3-suffix', text: ') {' },
          ],
        }
      case 4:
        return {
          lineNumber: 4,
          parts: [
            { id: 'result-declaration', text: '  int result = ' },
            { id: 'result-expression', text: 'a + b;' },
          ],
        }
      case 5:
        return { lineNumber: 5, parts: [{ id: 'add-return', text: line.code }] }
      case 8:
        return { lineNumber: 8, parts: [{ id: 'main-signature', text: line.code }] }
      case 9:
        return { lineNumber: 9, parts: [{ id: 'x-initializer', text: line.code }] }
      case 10:
        return { lineNumber: 10, parts: [{ id: 'y-initializer', text: line.code }] }
      case 11:
        return {
          lineNumber: 11,
          parts: [
            { id: 'answer-assignment', text: '  int answer = ' },
            { id: 'add-call', text: 'add(x, y);' },
          ],
        }
      case 12:
        return { lineNumber: 12, parts: [{ id: 'printf', text: line.code }] }
      case 13:
        return { lineNumber: 13, parts: [{ id: 'main-return', text: line.code }] }
      case 14:
        return { lineNumber: 14, parts: [{ id: 'exit', text: line.code }] }
      default:
        return { lineNumber: line.lineNumber, parts: wholeLine }
    }
  })
}

function NumberControl({
  id,
  label,
  value,
  onChange,
  min = FUNCTION_LIMITS.x.min,
  max = FUNCTION_LIMITS.x.max,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  const numberInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = numberInputRef.current
    if (input && input.value !== String(value)) input.value = String(value)
  }, [value])

  const update = (value: number) => {
    if (!Number.isFinite(value)) return
    onChange(Math.min(max, Math.max(min, Math.trunc(value))))
  }

  const updateDraft = (nextDraft: string) => {
    if (nextDraft.trim() === '' || nextDraft === '-' || nextDraft === '+') return

    const nextValue = Number(nextDraft)
    if (Number.isFinite(nextValue) && Number.isInteger(nextValue)) {
      update(nextValue)
    }
  }

  return (
    <div className="functions-number-control">
      <div className="functions-control-label">
        <label htmlFor={`${id}-number`}>{label}</label>
        <small>{min} 到 {max} 的整數</small>
      </div>
      <div className="functions-number-control__inputs">
        <input
          ref={numberInputRef}
          id={`${id}-number`}
          type="number"
          min={min}
          max={max}
          step={1}
          defaultValue={value}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={(event) => { event.currentTarget.value = String(value) }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={`${label}滑桿`}
          onChange={(event) => update(Number(event.target.value))}
        />
      </div>
    </div>
  )
}

function variableChanged(
  before: Readonly<FunctionVariableState>,
  after: Readonly<FunctionVariableState>,
): boolean {
  return before.declared !== after.declared
    || before.initialized !== after.initialized
    || before.inScope !== after.inScope
    || !Object.is(before.value, after.value)
}

function VariableCell({
  name,
  state,
  before,
}: {
  name: string
  state: Readonly<FunctionVariableState>
  before: Readonly<FunctionVariableState>
}) {
  const value = !state.declared
    ? '尚未宣告'
    : !state.inScope
      ? '離開作用域'
      : !state.initialized
        ? '尚未賦值'
        : String(state.value)

  return (
    <div
      className={[
        'functions-memory-cell',
        state.initialized && state.inScope ? 'is-ready' : '',
        variableChanged(before, state) ? 'is-changing' : '',
      ].filter(Boolean).join(' ')}
    >
      <div><code>{name}</code><small>int</small></div>
      <strong>{value}</strong>
    </div>
  )
}

function CallStackPanel({ frame }: { frame: FunctionFrame }) {
  const addVisible = frame.addFrame.status !== 'not-created'
  const returning = frame.phase === 'return-add' || frame.phase === 'assign-answer'
  const calling = frame.phase === 'call-add'
    || frame.phase === 'bind-parameters'

  return (
    <section className="functions-stack-panel lab-panel" aria-label="函式呼叫堆疊">
      <div className="functions-panel-heading">
        <div>
          <span><Layers3 size={18} aria-hidden="true" /></span>
          <div><small>CALL STACK</small><h2>呼叫框架</h2></div>
        </div>
        <span className={`functions-status-chip is-${frame.activeFunction ?? 'done'}`}>
          {frame.activeFunction ? `${frame.activeFunction} 執行中` : '沒有執行中的函式'}
        </span>
      </div>

      <p className="functions-panel-intro">
        每次呼叫都會建立自己的區域空間；最上方是目前正在執行的函式。
      </p>

      <div className="functions-stack">
        <article
          className={`functions-stack-frame${frame.addFrame.active ? ' is-active' : ''}${frame.addFrame.status === 'returned' ? ' is-popped' : ''}`}
          aria-hidden={!addVisible && frame.addFrame.status === 'not-created'}
        >
          <div className="functions-stack-frame__header">
            <div><span>TOP</span><code>add(a, b)</code></div>
            <small>{stackStatusLabels[frame.addFrame.status]}</small>
          </div>
          <div className="functions-memory-grid">
            <VariableCell name="a" state={frame.addFrame.a} before={frame.memoryBefore.add.a} />
            <VariableCell name="b" state={frame.addFrame.b} before={frame.memoryBefore.add.b} />
            <VariableCell name="result" state={frame.addFrame.result} before={frame.memoryBefore.add.result} />
          </div>
        </article>

        <div className={`functions-return-flow${returning ? ' is-returning' : ''}${calling ? ' is-calling' : ''}`}>
          <ArrowRight size={18} aria-hidden="true" />
          <span>
            {returning
              ? `return ${frame.addReturnValue ?? '？'} 回到 main`
              : calling
                ? `${frame.resolvedCall ?? frame.callExpression} 建立 add 框架`
                : '呼叫與回傳會在兩個框架間移動控制權'}
          </span>
        </div>

        <article className={`functions-stack-frame${frame.mainFrame.active ? ' is-active' : ''}${frame.mainFrame.status === 'returned' ? ' is-popped' : ''}`}>
          <div className="functions-stack-frame__header">
            <div><span>BASE</span><code>main()</code></div>
            <small>{stackStatusLabels[frame.mainFrame.status]}</small>
          </div>
          <div className="functions-memory-grid">
            <VariableCell name="x" state={frame.mainFrame.x} before={frame.memoryBefore.main.x} />
            <VariableCell name="y" state={frame.mainFrame.y} before={frame.memoryBefore.main.y} />
            <VariableCell name="answer" state={frame.mainFrame.answer} before={frame.memoryBefore.main.answer} />
          </div>
        </article>
      </div>

      <div className="functions-console">
        <div><Terminal size={15} aria-hidden="true" /><span>printf 輸出</span></div>
        <code>{frame.output.length > 0 ? frame.output.join(' ') : '尚無輸出'}</code>
      </div>
    </section>
  )
}

function ChallengeFeedback({
  evaluation,
}: {
  evaluation: FunctionChallengeEvaluation | null
}) {
  if (!evaluation) return null

  return (
    <div
      className={`functions-challenge-feedback ${evaluation.solved ? 'is-success' : 'is-hint'}`}
      role="status"
    >
      {evaluation.solved
        ? <CheckCircle2 size={18} aria-hidden="true" />
        : <Info size={18} aria-hidden="true" />}
      <span>{evaluation.message}</span>
    </div>
  )
}

export function FunctionLessonPage() {
  const {
    progress,
    getLessonProgress,
    markGuidedRunCompleted,
    markChallengeCompleted,
    rememberLessonState,
    visitLesson,
    resetProgress,
  } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const persistedLessonProgress = progress.lessons[LESSON_ID]
  const persistedConfig = readSavedConfig(
    persistedLessonProgress?.savedState ?? null,
  )
  const persistedConfigKey = functionConfigKey(persistedConfig)
  const hasPersistedLesson = persistedLessonProgress !== undefined
  const persistedGuidedRunCompleted =
    persistedLessonProgress?.guidedRunCompleted ?? false
  const [config, setConfig] = useState<FunctionConfig>(() =>
    readSavedConfig(lessonProgress.savedState),
  )
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [playerUnlocked, setPlayerUnlocked] = useState(
    lessonProgress.guidedRunCompleted,
  )
  const [prediction, setPrediction] = useState('')
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [predictionResult, setPredictionResult] = useState<{
    predicted: number
    actual: number
    matched: boolean
  } | null>(null)
  const [activeChallengeId, setActiveChallengeId] = useState<FunctionChallengeId>(
    () => FUNCTION_CHALLENGES.find((challenge) =>
      !lessonProgress.completedChallengeIds.includes(challenge.id),
    )?.id ?? FUNCTION_CHALLENGES[0].id,
  )
  const [challengePrediction, setChallengePrediction] = useState('')
  const [challengeConfig, setChallengeConfig] = useState<FunctionConfig>({
    ...DEFAULT_FUNCTION_CONFIG,
  })
  const [scopeAnswer, setScopeAnswer] = useState<FunctionScopeAnswer | null>(null)
  const [challengeFeedback, setChallengeFeedback] = useState<
    Partial<Record<FunctionChallengeId, FunctionChallengeEvaluation>>
  >({})
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const clearTriggerRef = useRef<HTMLButtonElement>(null)
  const clearConfirmRef = useRef<HTMLButtonElement>(null)
  const progressSyncRef = useRef({
    configKey: persistedConfigKey,
    hasLesson: hasPersistedLesson,
    guidedRunCompleted: persistedGuidedRunCompleted,
    lastVisitedLessonId: progress.lastVisitedLessonId,
  })

  const simulation = useMemo(() => simulateFunctionProgram(config), [config])
  const sourceLines = useMemo(
    () => sourceLinesFor(buildFunctionSource(config)),
    [config],
  )
  const player = useTracePlayer({
    frames: simulation.frames,
    speed,
    config: functionConfigKey(config),
  })
  const frame = player.frame ?? simulation.frames[0]
  const completedCount = FUNCTION_CHALLENGES.filter((challenge) =>
    lessonProgress.completedChallengeIds.includes(challenge.id),
  ).length
  const lessonCompleted = completedCount === FUNCTION_CHALLENGES.length

  useEffect(() => {
    visitLesson(LESSON_ID)
  }, [visitLesson])

  useEffect(() => {
    const previous = progressSyncRef.current
    const configChanged = previous.configKey !== persistedConfigKey
    const progressCleared = (
      (previous.hasLesson && !hasPersistedLesson)
      || (
        previous.lastVisitedLessonId === LESSON_ID
        && progress.lastVisitedLessonId === null
        && !hasPersistedLesson
      )
    )

    progressSyncRef.current = {
      configKey: persistedConfigKey,
      hasLesson: hasPersistedLesson,
      guidedRunCompleted: persistedGuidedRunCompleted,
      lastVisitedLessonId: progress.lastVisitedLessonId,
    }

    if (configChanged || progressCleared) {
      setConfig({ x: persistedConfig.x, y: persistedConfig.y })
      setPrediction('')
      setPredictionError(null)
      setPredictionResult(null)
      setPlayerUnlocked(persistedGuidedRunCompleted)
      return
    }

    if (
      previous.guidedRunCompleted !== persistedGuidedRunCompleted
      && (persistedGuidedRunCompleted || previous.guidedRunCompleted)
    ) {
      setPlayerUnlocked(persistedGuidedRunCompleted)
    }
  }, [
    hasPersistedLesson,
    persistedConfig.x,
    persistedConfig.y,
    persistedConfigKey,
    persistedGuidedRunCompleted,
    progress.lastVisitedLessonId,
  ])

  useEffect(() => {
    if (playerUnlocked && player.atEnd && frame.phase === 'done') {
      markGuidedRunCompleted(LESSON_ID)
    }
  }, [frame.phase, markGuidedRunCompleted, player.atEnd, playerUnlocked])

  useEffect(() => {
    if (showClearConfirm) clearConfirmRef.current?.focus()
  }, [showClearConfirm])

  const saveConfig = (next: FunctionConfig) => {
    if (validateFunctionConfig(next).length > 0) return
    setConfig(next)
    setPrediction('')
    setPredictionError(null)
    setPredictionResult(null)
    setPlayerUnlocked(lessonProgress.guidedRunCompleted)
    rememberLessonState(LESSON_ID, next)
  }

  const changeConfig = (field: keyof FunctionConfig, value: number) => {
    saveConfig({ ...config, [field]: value })
  }

  const submitPrediction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const predicted = prediction.trim() === '' ? Number.NaN : Number(prediction)
    if (!Number.isFinite(predicted) || !Number.isInteger(predicted)) {
      setPredictionError('請先輸入一個整數作為你的預測。')
      return
    }
    if (simulation.returnValue === null) {
      setPredictionError(simulation.message)
      return
    }

    setPredictionResult({
      predicted,
      actual: simulation.returnValue,
      matched: Object.is(predicted, simulation.returnValue),
    })
    setPredictionError(null)
    setPlayerUnlocked(true)
    player.reset()
  }

  const completeChallenge = (
    id: FunctionChallengeId,
    evaluation: FunctionChallengeEvaluation,
  ) => {
    setChallengeFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) markChallengeCompleted(LESSON_ID, id)
  }

  const checkPredictionChallenge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = challengePrediction.trim() === ''
      ? null
      : Number(challengePrediction)
    completeChallenge(
      'predict-return-value',
      evaluateFunctionPrediction(
        value !== null && Number.isFinite(value) ? value : null,
      ),
    )
  }

  const checkConfigurationChallenge = () => {
    completeChallenge('make-return-ten', evaluateMakeReturnTen(challengeConfig))
  }

  const checkScopeChallenge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    completeChallenge('identify-local-scope', evaluateFunctionScope(scopeAnswer))
  }

  const cancelClear = () => {
    setShowClearConfirm(false)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const handleClearDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelClear()
    }
  }

  const clearAllProgress = () => {
    resetProgress()
    setConfig({ ...DEFAULT_FUNCTION_CONFIG })
    setPlayerUnlocked(false)
    setPrediction('')
    setPredictionError(null)
    setPredictionResult(null)
    setActiveChallengeId(FUNCTION_CHALLENGES[0].id)
    setChallengePrediction('')
    setChallengeConfig({ ...DEFAULT_FUNCTION_CONFIG })
    setScopeAnswer(null)
    setChallengeFeedback({})
    setShowClearConfirm(false)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const challengeItems: readonly ChallengePanelItem<FunctionChallengeId>[] =
    FUNCTION_CHALLENGES.map((challenge) => ({
      id: challenge.id,
      label: challenge.title,
      eyebrow: `CHALLENGE ${String(challenge.order).padStart(2, '0')}`,
      completed: lessonProgress.completedChallengeIds.includes(challenge.id),
    }))

  const controls = (
    <details className="functions-controls" open>
      <summary>
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span><small>CONTROL PANEL</small>調整 main 的引數</span>
      </summary>
      <div className="functions-controls__body">
        <NumberControl
          id="function-x"
          label="x 的值"
          value={config.x}
          min={FUNCTION_LIMITS.x.min}
          max={FUNCTION_LIMITS.x.max}
          onChange={(value) => changeConfig('x', value)}
        />
        <NumberControl
          id="function-y"
          label="y 的值"
          value={config.y}
          min={FUNCTION_LIMITS.y.min}
          max={FUNCTION_LIMITS.y.max}
          onChange={(value) => changeConfig('y', value)}
        />
        <div className="functions-call-preview">
          <small>這次呼叫</small>
          <code>add({config.x}, {config.y})</code>
        </div>
        <button
          type="button"
          className="functions-restore-button"
          onClick={() => saveConfig({ ...DEFAULT_FUNCTION_CONFIG })}
        >
          <RotateCcw size={16} aria-hidden="true" /> 恢復預設引數
        </button>
        <div className="functions-safety-note">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>只模擬這個固定的 add 範例，不會編譯或執行任意 C 程式碼。</p>
        </div>
      </div>
    </details>
  )

  const liveAnnouncement = playerUnlocked
    ? `${phaseLabels[frame.phase]}。${frame.explanation}`
    : ''

  return (
    <div className="functions-page lab-page">
      <section className="functions-hero lab-hero">
        <div className="page-width">
          <nav className="breadcrumbs" aria-label="麵包屑">
            <Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" />
            <span>函式</span>
          </nav>
          <div className="functions-hero__layout">
            <div className="functions-hero__copy">
              <Link className="back-link" to="/learn">
                <ArrowLeft size={16} aria-hidden="true" /> 回到課程地圖
              </Link>
              <span className="section-kicker">MODULE 04 · LESSON 01</span>
              <h1>把工作交給函式，<br />再把答案帶回 main。</h1>
              <p>
                逐步追蹤一次 <code>add(x, y)</code>：引數如何複製成參數、區域變數住在哪裡，以及 <code>return</code> 如何把結果交回呼叫端。
              </p>
            </div>
            <aside
              className={`lesson-status-card${lessonCompleted ? ' complete' : ''}`}
              aria-label="本單元學習進度"
            >
              <div>
                {lessonCompleted
                  ? <Trophy size={21} aria-hidden="true" />
                  : <SquareFunction size={21} aria-hidden="true" />}
                <span>{lessonCompleted ? '單元完成' : '學習進度'}</span>
              </div>
              <strong>{completedCount}<small>/3</small></strong>
              <p>{lessonCompleted ? '三個挑戰全部完成！' : '通過三題即可完成這個單元'}</p>
            </aside>
          </div>
        </div>
      </section>

      <div className="functions-page__content">
        <section className="functions-overview page-width" aria-labelledby="functions-objectives-title">
          <div className="functions-objectives">
            <span className="section-kicker">LEARNING GOALS</span>
            <h2 id="functions-objectives-title">這一課，你會學會什麼？</h2>
            <ul>
              <li><Check size={17} aria-hidden="true" />分清楚呼叫時的引數與定義裡的參數。</li>
              <li><Check size={17} aria-hidden="true" />追蹤每次函式呼叫建立的區域作用域。</li>
              <li><Check size={17} aria-hidden="true" />看懂 <code>return</code> 如何回到呼叫處並完成賦值。</li>
            </ul>
          </div>
          <div className="functions-concepts" aria-label="概念短講">
            <article>
              <span><SquareFunction size={18} aria-hidden="true" /></span>
              <small>01 · 呼叫</small>
              <h3>函式是一份可重用工作</h3>
              <p><code>add(x, y)</code> 暫停 main，轉去執行 add 的函式內容。</p>
            </article>
            <article>
              <span><Layers3 size={18} aria-hidden="true" /></span>
              <small>02 · 參數</small>
              <h3>值會複製到新框架</h3>
              <p>x、y 是引數；a、b 是 add 自己的參數，不是同一個變數。</p>
            </article>
            <article>
              <span><ArrowLeft size={18} aria-hidden="true" /></span>
              <small>03 · 回傳</small>
              <h3>return 把結果帶回去</h3>
              <p>add 的 result 離開作用域前，值會先交回 main 的 answer。</p>
            </article>
          </div>
        </section>

        <section className="functions-prediction-section" aria-labelledby="functions-prediction-title">
          <div className="page-width functions-prediction-card">
            <div className="functions-prediction-card__copy">
              <span className="section-kicker">PREDICT BEFORE RUN</span>
              <h2 id="functions-prediction-title">先別按播放。add 會回傳多少？</h2>
              <p>先留下預測，再沿著呼叫堆疊逐步驗證；答錯也不會扣分。</p>
              <code className="functions-prediction-expression">
                int answer = add({config.x}, {config.y});
              </code>
            </div>
            <form className="functions-prediction-form" onSubmit={submitPrediction}>
              <label htmlFor="function-guided-prediction">我預測 answer 最後會是</label>
              <div>
                <input
                  id="function-guided-prediction"
                  type="number"
                  step={1}
                  inputMode="numeric"
                  value={prediction}
                  onChange={(event) => setPrediction(event.target.value)}
                />
                <button type="submit" className="button button-primary">
                  提交預測 <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
              {predictionError && <p className="functions-form-error" role="alert">{predictionError}</p>}
            </form>
            {predictionResult && frame.output.length === 0 && (
              <div className="functions-prediction-result is-pending" role="status">
                <Circle size={20} aria-hidden="true" />
                <div><strong>預測已記錄。</strong><span>現在請逐步執行，走到 printf 再揭曉結果。</span></div>
              </div>
            )}
            {predictionResult && frame.output.length > 0 && (
              <div className={`functions-prediction-result ${predictionResult.matched ? 'is-match' : 'is-different'}`} role="status">
                {predictionResult.matched
                  ? <CheckCircle2 size={20} aria-hidden="true" />
                  : <Lightbulb size={20} aria-hidden="true" />}
                <div>
                  <strong>{predictionResult.matched ? '預測正確！' : '結果不一樣，沿著框架再看一次。'}</strong>
                  <span>你猜 {predictionResult.predicted}，add 實際回傳 {predictionResult.actual}。</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="functions-lab-section" aria-labelledby="functions-lab-title">
          <div className="page-width">
            <div className="functions-section-heading">
              <span className="section-kicker">FOLLOW THE CALL STACK</span>
              <h2 id="functions-lab-title">逐步執行，看見控制權來回移動。</h2>
              <p>修改 x 或 y 會建立一條新的安全軌跡；main 與 add 各自擁有自己的變數空間。</p>
            </div>

            <LabShell
              className="functions-lab-shell"
              controls={controls}
              controlsLabel="函式引數控制"
              playback={playerUnlocked ? (
                <PlaybackControls
                  controlName="函式呼叫"
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
                <div className="functions-player-lock" role="status">
                  <Circle size={15} aria-hidden="true" /> 提交上方預測後解鎖播放與單步控制
                </div>
              )}
            >
              {simulation.status === 'blocked' && frame.phase === 'blocked' && (
                <div className="functions-blocked-banner" role="alert">
                  <ShieldAlert size={19} aria-hidden="true" />
                  <div><strong>已阻止不合法的引數</strong><span>{simulation.message}</span></div>
                </div>
              )}
              <div className="functions-execution-grid">
                <SourceCodePanel<string>
                  className="functions-source-panel"
                  lines={sourceLines}
                  activeLine={frame.activeLine}
                  activePart={frame.activePart}
                  title={<><Code2 size={16} aria-hidden="true" /> C 程式碼</>}
                  status={<span>{phaseLabels[frame.phase]}</span>}
                  explanation={(
                    <div>
                      <strong>{frame.activeFunction ? `目前在 ${frame.activeFunction}()` : '程式已結束'}</strong>
                      <p>{frame.explanation}</p>
                    </div>
                  )}
                />
                <CallStackPanel frame={frame} />
              </div>
            </LabShell>
          </div>
        </section>

        <section className="functions-challenges" aria-labelledby="functions-challenges-title">
          <div className="page-width">
            <div className="functions-challenges__heading">
              <div><span className="section-kicker">TRY IT YOURSELF</span><h2 id="functions-challenges-title">三道挑戰，把呼叫流程說清楚。</h2></div>
              <p><Sparkles size={17} aria-hidden="true" /> 進度會保存在這台裝置。</p>
            </div>

            <ChallengePanel
              className="functions-challenge-panel"
              challenges={challengeItems}
              activeId={activeChallengeId}
              onSelect={setActiveChallengeId}
              label="函式學習挑戰"
            >
              {(activeChallenge) => {
                const definition = FUNCTION_CHALLENGES.find((challenge) =>
                  challenge.id === activeChallenge.id,
                )!
                const feedback = challengeFeedback[activeChallenge.id] ?? null

                if (activeChallenge.id === 'predict-return-value') {
                  return (
                    <div className="functions-challenge-card">
                      <span className="functions-challenge-kind"><BookOpen size={16} aria-hidden="true" /> 預測題</span>
                      <h3>{definition.description}</h3>
                      <code className="functions-challenge-code">int answer = add(4, 3);</code>
                      <form className="functions-challenge-form" onSubmit={checkPredictionChallenge}>
                        <label htmlFor="function-challenge-prediction">add 的回傳值</label>
                        <div>
                          <input
                            id="function-challenge-prediction"
                            type="number"
                            step={1}
                            value={challengePrediction}
                            onChange={(event) => setChallengePrediction(event.target.value)}
                          />
                          <button type="submit" className="button button-primary">檢查答案</button>
                        </div>
                      </form>
                      <ChallengeFeedback evaluation={feedback} />
                    </div>
                  )
                }

                if (activeChallenge.id === 'make-return-ten') {
                  const challengeSimulation = simulateFunctionProgram(challengeConfig)
                  return (
                    <div className="functions-challenge-card">
                      <span className="functions-challenge-kind"><SlidersHorizontal size={16} aria-hidden="true" /> 調參題</span>
                      <h3>{definition.description}</h3>
                      <code className="functions-challenge-code">
                        add({challengeConfig.x}, {challengeConfig.y}) → {challengeSimulation.returnValue}
                      </code>
                      <div className="functions-challenge-controls">
                        <NumberControl
                          id="function-challenge-x"
                          label="x 引數"
                          value={challengeConfig.x}
                          onChange={(x) => setChallengeConfig((current) => ({ ...current, x }))}
                        />
                        <NumberControl
                          id="function-challenge-y"
                          label="y 引數"
                          value={challengeConfig.y}
                          onChange={(y) => setChallengeConfig((current) => ({ ...current, y }))}
                        />
                      </div>
                      <button type="button" className="button button-primary" onClick={checkConfigurationChallenge}>
                        檢查回傳與輸出
                      </button>
                      <ChallengeFeedback evaluation={feedback} />
                    </div>
                  )
                }

                return (
                  <div className="functions-challenge-card">
                    <span className="functions-challenge-kind"><Layers3 size={16} aria-hidden="true" /> 作用域題</span>
                    <h3>{definition.description}</h3>
                    <code className="functions-challenge-code">printf("%d\n", ______);</code>
                    <form className="functions-challenge-form" onSubmit={checkScopeChallenge}>
                      <fieldset className="functions-scope-options">
                        <legend>選出 main 可以直接讀取的名稱</legend>
                        {FUNCTION_SCOPE_OPTIONS.map((option) => (
                          <label key={option.id}>
                            <input
                              type="radio"
                              name="function-scope-answer"
                              value={option.id}
                              checked={scopeAnswer === option.id}
                              onChange={() => setScopeAnswer(option.id)}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </fieldset>
                      <button type="submit" className="button button-primary">檢查作用域</button>
                    </form>
                    <ChallengeFeedback evaluation={feedback} />
                  </div>
                )
              }}
            </ChallengePanel>

            {lessonCompleted && (
              <div className="functions-completion-banner" role="status">
                <span><Trophy size={26} aria-hidden="true" /></span>
                <div>
                  <small>LESSON COMPLETE</small>
                  <h2>你已完成函式、參數與回傳值單元！</h2>
                  <p>你已能追蹤引數、區域作用域與 return 回到呼叫端的完整路徑。</p>
                </div>
                <Link className="button button-light" to="/learn">
                  回到課程地圖 <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="functions-recap" aria-labelledby="functions-recap-title">
          <div className="page-width functions-recap__layout">
            <div>
              <span className="section-kicker">KEY TAKEAWAYS</span>
              <h2 id="functions-recap-title">離開前，記住這四件事。</h2>
            </div>
            <ol>
              <li><span>01</span><p>函式定義說明工作內容；函式呼叫才會真正執行那份工作。</p></li>
              <li><span>02</span><p><code>x</code>、<code>y</code> 是引數；<code>a</code>、<code>b</code> 是接收值的參數。</p></li>
              <li><span>03</span><p>每個呼叫框架有自己的區域變數；add 不能直接共享 main 的區域名稱。</p></li>
              <li><span>04</span><p><code>return</code> 會結束目前函式，把值送回呼叫運算式所在的位置。</p></li>
            </ol>
          </div>
        </section>

        <section className="functions-progress-management">
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
                className="functions-clear-confirm"
                role="alertdialog"
                aria-labelledby="functions-clear-title"
                aria-describedby="functions-clear-description"
                onKeyDown={handleClearDialogKeyDown}
              >
                <div>
                  <strong id="functions-clear-title">確定清除全部進度？</strong>
                  <span id="functions-clear-description">所有單元、挑戰與參數紀錄都會被移除，且無法復原。</span>
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
