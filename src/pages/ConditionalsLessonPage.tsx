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
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  GitBranch,
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
  CONDITIONAL_LIMITS,
  CONDITIONAL_LOGICAL_OPERATORS,
  DEFAULT_CONDITIONAL_CONFIG,
  buildConditionalSource,
  normalizeConditionalConfig,
  simulateConditional,
  type ConditionalBranch,
  type ConditionalConfig,
  type ConditionalFrame,
  type ConditionalLogicalOperator,
  type ConditionalPhase,
  type ConditionalSourcePart,
  type GeneratedConditionalSource,
} from '../domain/conditionals'
import {
  CONDITIONAL_CHALLENGES,
  CONDITIONAL_DIAGNOSIS_OPTIONS,
  evaluateConditionalPrediction,
  evaluateConditionalRepair,
  evaluateMakeBothPass,
  type ConditionalChallengeEvaluation,
  type ConditionalChallengeId,
  type ConditionalDiagnosis,
} from '../data/conditionalChallenges'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { isConditionalSavedState } from '../state'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'

const LESSON_ID = 'conditionals-if-else' as const

const phaseLabels: Readonly<Record<ConditionalPhase, string>> = {
  main: '進入 main',
  'init-score': '初始化 score',
  'init-attendance': '初始化 attendance',
  'compare-score': '比較 score',
  'short-circuit': '短路判斷',
  'compare-attendance': '比較 attendance',
  combine: '合併條件',
  'if-branch': '進入 if',
  'else-branch': '進入 else',
  print: '輸出結果',
  return: '回傳',
  done: '完成',
}

type ConditionalCodePart = ConditionalSourcePart | 'plain'

function readSavedConfig(value: unknown): ConditionalConfig {
  return isConditionalSavedState(value)
    ? { ...value }
    : { ...DEFAULT_CONDITIONAL_CONFIG }
}

function configKey(config: ConditionalConfig): string {
  return `${config.score}:${config.attendance}:${config.logicalOperator}`
}

function sourceLinesFor(
  source: GeneratedConditionalSource,
): readonly SourceCodeLine<ConditionalCodePart>[] {
  return source.lines.map((line) => {
    switch (line.lineNumber) {
      case 3:
        return { lineNumber: 3, parts: [{ id: 'main-signature', text: line.code }] }
      case 4:
        return { lineNumber: 4, parts: [{ id: 'score-initializer', text: line.code }] }
      case 5:
        return { lineNumber: 5, parts: [{ id: 'attendance-initializer', text: line.code }] }
      case 7:
        return {
          lineNumber: 7,
          parts: [
            { id: 'if-keyword', text: '  if (' },
            { id: 'score-comparison', text: source.scoreExpression },
            { id: 'logical-operator', text: ` ${source.conditionExpression.split(' ')[3]} ` },
            { id: 'attendance-comparison', text: source.attendanceExpression },
            { id: 'if-brace', text: ') {' },
          ],
        }
      case 8:
        return { lineNumber: 8, parts: [{ id: 'printf-pass', text: line.code }] }
      case 9:
        return { lineNumber: 9, parts: [{ id: 'else-keyword', text: line.code }] }
      case 10:
        return { lineNumber: 10, parts: [{ id: 'printf-practice', text: line.code }] }
      case 12:
        return { lineNumber: 12, parts: [{ id: 'return', text: line.code }] }
      case 13:
        return { lineNumber: 13, parts: [{ id: 'exit', text: line.code }] }
      default:
        return { lineNumber: line.lineNumber, parts: [{ id: 'plain', text: line.code || ' ' }] }
    }
  })
}

interface NumberControlProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

function NumberControl({ id, label, value, min, max, onChange }: NumberControlProps) {
  const update = (rawValue: string) => {
    const next = Number(rawValue)
    if (Number.isFinite(next)) onChange(Math.trunc(next))
  }

  return (
    <div className="conditionals-number-control">
      <div className="conditionals-control-label">
        <label htmlFor={`${id}-number`}>{label}</label>
        <small>{min} 到 {max}</small>
      </div>
      <div className="conditionals-number-control__inputs">
        <input
          id={`${id}-range`}
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={`${label}滑桿`}
          onChange={(event) => update(event.target.value)}
        />
        <input
          id={`${id}-number`}
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          inputMode="numeric"
          onChange={(event) => update(event.target.value)}
        />
      </div>
    </div>
  )
}

function TruthValue({ value }: { value: boolean | null }) {
  return (
    <span className={`conditionals-truth-value${value === null ? ' is-unknown' : value ? ' is-true' : ' is-false'}`}>
      {value === null ? '尚未比較' : value ? '真 · true' : '假 · false'}
    </span>
  )
}

function DecisionPanel({ frame }: { frame: ConditionalFrame }) {
  const output = frame.output.length > 0 ? frame.output.join(' ') : '尚無輸出'
  return (
    <section className="lab-panel conditionals-decision-panel" aria-labelledby="conditionals-decision-title">
      <div className="conditionals-panel-heading">
        <div>
          <span className="conditionals-panel-icon"><GitBranch size={17} aria-hidden="true" /></span>
          <h2 id="conditionals-decision-title">條件與分支</h2>
        </div>
        <span className={`conditionals-status-chip is-${frame.phase}`}>{phaseLabels[frame.phase]}</span>
      </div>
      <p className="conditionals-panel-intro">每一步都只改變已經執行到的部分，讓你看清楚 C 如何做決定。</p>
      <div className="conditionals-comparison-list">
        <div className="conditionals-comparison-card">
          <div><code>score &gt;= 60</code><strong>{frame.score}</strong></div>
          <TruthValue value={frame.scorePasses} />
        </div>
        <div className="conditionals-operator">{frame.selectedBranch ? frame.selectedBranch === 'if' ? '→' : '↘' : frame.skippedComparison ? '短路' : frame.phase === 'combine' ? '合併' : '·'}</div>
        <div className="conditionals-comparison-card">
          <div><code>attendance &gt;= 70</code><strong>{frame.attendance}</strong></div>
          <TruthValue value={frame.attendancePasses} />
        </div>
      </div>
      <div className="conditionals-result-grid">
        <div>
          <small>整體條件</small>
          <strong><TruthValue value={frame.conditionResult} /></strong>
        </div>
        <div>
          <small>目前分支</small>
          <strong>{frame.selectedBranch === 'if' ? 'if · 通過' : frame.selectedBranch === 'else' ? 'else · 再練習' : '尚未選擇'}</strong>
        </div>
        <div>
          <small><Terminal size={14} aria-hidden="true" /> printf 輸出</small>
          <code>{output}</code>
        </div>
      </div>
      {frame.skippedComparison && (
        <div className="conditionals-short-circuit" role="status">
          <Info size={16} aria-hidden="true" />
          <span>短路：這次沒有再比較 attendance，因為 {frame.skippedComparison === 'attendance' ? '左側結果已足以決定整體條件' : '右側結果已足以決定整體條件'}。</span>
        </div>
      )}
    </section>
  )
}

function ChallengeFeedback({ evaluation }: { evaluation: ConditionalChallengeEvaluation | null }) {
  if (!evaluation) return null
  return (
    <div className={`conditionals-challenge-feedback ${evaluation.solved ? 'is-success' : 'is-hint'}`} role="status">
      {evaluation.solved ? <CheckCircle2 size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
      <span>{evaluation.message}</span>
    </div>
  )
}

export function ConditionalsLessonPage() {
  const {
    getLessonProgress,
    markGuidedRunCompleted,
    markChallengeCompleted,
    rememberLessonState,
    visitLesson,
    resetProgress,
  } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState<ConditionalConfig>(() => readSavedConfig(lessonProgress.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [playerUnlocked, setPlayerUnlocked] = useState(lessonProgress.guidedRunCompleted)
  const [prediction, setPrediction] = useState<ConditionalBranch>(null)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [predictionResult, setPredictionResult] = useState<{
    predicted: ConditionalBranch
    actual: Exclude<ConditionalBranch, null>
    matched: boolean
  } | null>(null)
  const [activeChallengeId, setActiveChallengeId] = useState<ConditionalChallengeId>(() => CONDITIONAL_CHALLENGES.find((challenge) => !lessonProgress.completedChallengeIds.includes(challenge.id))?.id ?? CONDITIONAL_CHALLENGES[0].id)
  const [challengePrediction, setChallengePrediction] = useState<ConditionalBranch>(null)
  const [challengeConfig, setChallengeConfig] = useState<ConditionalConfig>({ ...DEFAULT_CONDITIONAL_CONFIG })
  const [repairOperator, setRepairOperator] = useState<ConditionalLogicalOperator>('||')
  const [diagnosis, setDiagnosis] = useState<ConditionalDiagnosis | null>(null)
  const [challengeFeedback, setChallengeFeedback] = useState<Partial<Record<ConditionalChallengeId, ConditionalChallengeEvaluation>>>({})
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const clearTriggerRef = useRef<HTMLButtonElement>(null)
  const clearConfirmRef = useRef<HTMLButtonElement>(null)

  const simulation = useMemo(() => simulateConditional(config), [config])
  const sourceLines = useMemo(() => sourceLinesFor(buildConditionalSource(config)), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: configKey(config) })
  const frame = player.frame ?? simulation.frames[0]
  const completedCount = CONDITIONAL_CHALLENGES.filter((challenge) => lessonProgress.completedChallengeIds.includes(challenge.id)).length
  const lessonCompleted = completedCount === CONDITIONAL_CHALLENGES.length

  useEffect(() => {
    visitLesson(LESSON_ID)
  }, [visitLesson])

  useEffect(() => {
    if (playerUnlocked && player.atEnd && frame.phase === 'done') markGuidedRunCompleted(LESSON_ID)
  }, [frame.phase, markGuidedRunCompleted, player.atEnd, playerUnlocked])

  useEffect(() => {
    if (showClearConfirm) clearConfirmRef.current?.focus()
  }, [showClearConfirm])

  const saveConfig = (next: ConditionalConfig) => {
    const stable = normalizeConditionalConfig(next)
    setConfig(stable)
    setPrediction(null)
    setPredictionResult(null)
    setPredictionError(null)
    rememberLessonState(LESSON_ID, stable)
  }

  const changeConfig = <Key extends keyof ConditionalConfig>(key: Key, value: ConditionalConfig[Key]) => {
    saveConfig({ ...config, [key]: value })
  }

  const restoreDefaults = () => saveConfig({ ...DEFAULT_CONDITIONAL_CONFIG })

  const submitPrediction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prediction) {
      setPredictionError('請先選擇你猜測的分支。')
      return
    }
    setPredictionResult({ predicted: prediction, actual: simulation.selectedBranch, matched: prediction === simulation.selectedBranch })
    setPredictionError(null)
    setPlayerUnlocked(true)
    player.reset()
  }

  const completeChallenge = (id: ConditionalChallengeId, evaluation: ConditionalChallengeEvaluation) => {
    setChallengeFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) markChallengeCompleted(LESSON_ID, id)
  }

  const checkPredictionChallenge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    completeChallenge('predict-mixed-condition', evaluateConditionalPrediction(challengePrediction))
  }

  const checkConfigurationChallenge = () => completeChallenge('make-both-pass', evaluateMakeBothPass(challengeConfig))

  const checkRepairChallenge = () => completeChallenge('repair-loose-rule', evaluateConditionalRepair(diagnosis, repairOperator))

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
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
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
    setConfig({ ...DEFAULT_CONDITIONAL_CONFIG })
    setPlayerUnlocked(false)
    setPrediction(null)
    setPredictionError(null)
    setPredictionResult(null)
    setActiveChallengeId(CONDITIONAL_CHALLENGES[0].id)
    setChallengePrediction(null)
    setChallengeConfig({ ...DEFAULT_CONDITIONAL_CONFIG })
    setRepairOperator('||')
    setDiagnosis(null)
    setChallengeFeedback({})
    setShowClearConfirm(false)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const challengeItems: readonly ChallengePanelItem<ConditionalChallengeId>[] = CONDITIONAL_CHALLENGES.map((challenge) => ({
    id: challenge.id,
    label: challenge.title,
    eyebrow: `CHALLENGE ${String(challenge.order).padStart(2, '0')}`,
    completed: lessonProgress.completedChallengeIds.includes(challenge.id),
  }))

  const controls = (
    <details className="conditionals-controls" open>
      <summary>
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span><small>CONTROL PANEL</small>調整條件</span>
      </summary>
      <div className="conditionals-controls__body">
        <NumberControl id="conditional-score" label="score 分數" min={CONDITIONAL_LIMITS.score.min} max={CONDITIONAL_LIMITS.score.max} value={config.score} onChange={(value) => changeConfig('score', value)} />
        <NumberControl id="conditional-attendance" label="attendance 出席率" min={CONDITIONAL_LIMITS.attendance.min} max={CONDITIONAL_LIMITS.attendance.max} value={config.attendance} onChange={(value) => changeConfig('attendance', value)} />
        <fieldset className="conditionals-operator-control">
          <legend>邏輯運算子</legend>
          <div role="radiogroup" aria-label="邏輯運算子">
            {CONDITIONAL_LOGICAL_OPERATORS.map((operator) => (
              <button type="button" role="radio" aria-checked={config.logicalOperator === operator} className={config.logicalOperator === operator ? 'is-active' : ''} key={operator} onClick={() => changeConfig('logicalOperator', operator)}>
                <code>{operator}</code>
                <small>{operator === '&&' ? '兩邊都要真' : '一邊為真即可'}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" className="conditionals-restore-button" onClick={restoreDefaults}><RotateCcw size={16} aria-hidden="true" /> 恢復預設參數</button>
        <div className="conditionals-safety-note"><ShieldAlert size={18} aria-hidden="true" /><p>只模擬這組受限參數，不會編譯或執行任意 C 程式碼。</p></div>
      </div>
    </details>
  )

  const liveAnnouncement = frame.phase === 'print'
    ? `程式輸出 ${frame.output.join(' ')}`
    : frame.phase === 'done' ? frame.explanation : ''

  return (
    <div className="conditionals-page lab-page">
      <section className="conditionals-hero lab-hero">
        <div className="page-width">
          <nav className="breadcrumbs" aria-label="麵包屑">
            <Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" /><span>條件判斷</span>
          </nav>
          <div className="conditionals-hero__layout">
            <div className="conditionals-hero__copy">
              <Link className="back-link" to="/learn"><ArrowLeft size={16} aria-hidden="true" /> 回到課程地圖</Link>
              <span className="section-kicker">MODULE 02 · LESSON 01</span>
              <h1>讓程式學會選擇，<br />看懂 if 與 else。</h1>
              <p>先判斷，再走進其中一條路。你會看到比較運算、邏輯運算與短路，如何一起決定最後的輸出。</p>
            </div>
            <aside className={`lesson-status-card${lessonCompleted ? ' complete' : ''}`} aria-label="本單元學習進度">
              <div>{lessonCompleted ? <Trophy size={21} aria-hidden="true" /> : <GitBranch size={21} aria-hidden="true" />}<span>{lessonCompleted ? '單元完成' : '學習進度'}</span></div>
              <strong>{completedCount}<small>/3</small></strong>
              <p>{lessonCompleted ? '三個挑戰全部完成！' : '通過三題即可完成這個單元'}</p>
            </aside>
          </div>
        </div>
      </section>

      <div className="conditionals-page__content">
        <section className="conditionals-overview page-width" aria-labelledby="conditionals-objectives-title">
          <div className="conditionals-objectives">
            <span className="section-kicker">LEARNING GOALS</span>
            <h2 id="conditionals-objectives-title">這一課，你會學會什麼？</h2>
            <ul>
              <li><Check size={17} aria-hidden="true" />讀懂比較運算子的真與假。</li>
              <li><Check size={17} aria-hidden="true" />分清楚 <code>if</code>、<code>else</code> 與 <code>=</code>、<code>==</code>。</li>
              <li><Check size={17} aria-hidden="true" />用 <code>&amp;&amp;</code>、<code>||</code> 組合條件，理解短路。</li>
            </ul>
          </div>
          <div className="conditionals-concepts" aria-label="概念短講">
            <article><span><Code2 size={18} aria-hidden="true" /></span><small>01 · 比較</small><h3>先得到真或假</h3><p><code>score &gt;= 60</code> 會先產生一個布林結果，再交給 <code>if</code>。</p></article>
            <article><span><GitBranch size={18} aria-hidden="true" /></span><small>02 · 分支</small><h3>只走其中一條路</h3><p>條件為真進入 <code>if</code>，否則跳到 <code>else</code>。</p></article>
            <article><span><Sparkles size={18} aria-hidden="true" /></span><small>03 · 邏輯</small><h3><code>&amp;&amp;</code> 與 <code>||</code></h3><p>C 以 0 表示假、非 0 表示真；短路會省略不必執行的比較。</p></article>
          </div>
        </section>

        <section className="conditionals-prediction-section" aria-labelledby="conditionals-prediction-title">
          <div className="page-width conditionals-prediction-card">
            <div className="conditionals-prediction-card__copy">
              <span className="section-kicker">PREDICT BEFORE RUN</span>
              <h2 id="conditionals-prediction-title">先別按播放。你猜會走哪一條？</h2>
              <p>提交後才會解鎖逐步播放器；答錯也沒關係，沿著每個比較找出差異。</p>
              <code className="conditionals-prediction-expression">if (score &gt;= 60 &amp;&amp; attendance &gt;= 70)</code>
            </div>
            <form className="conditionals-prediction-form" aria-label="課程預測" onSubmit={submitPrediction}>
              <fieldset><legend>我預測程式會進入</legend><div className="conditionals-choice-group">
                <label><input type="radio" name="guided-branch" checked={prediction === 'if'} onChange={() => setPrediction('if')} /><span><strong>if</strong><small>輸出「通過」</small></span></label>
                <label><input type="radio" name="guided-branch" checked={prediction === 'else'} onChange={() => setPrediction('else')} /><span><strong>else</strong><small>輸出「再練習」</small></span></label>
              </div></fieldset>
              <button type="submit" className="button button-primary">提交預測 <ArrowRight size={17} aria-hidden="true" /></button>
              {predictionError && <p className="conditionals-form-error" role="alert">{predictionError}</p>}
            </form>
            {predictionResult && <div className={`conditionals-prediction-result ${predictionResult.matched ? 'is-match' : 'is-different'}`} role="status">
              {predictionResult.matched ? <CheckCircle2 size={20} aria-hidden="true" /> : <Lightbulb size={20} aria-hidden="true" />}
              <div><strong>{predictionResult.matched ? '預測正確！' : '結果不一樣，來看看原因。'}</strong><span>你猜 <code>{predictionResult.predicted}</code>，實際進入 <code>{predictionResult.actual}</code>。</span></div>
            </div>}
          </div>
        </section>

        <section className="conditionals-lab-section" aria-labelledby="conditionals-lab-title">
          <div className="page-width">
            <div className="conditionals-section-heading"><span className="section-kicker">STEP THROUGH THE PROGRAM</span><h2 id="conditionals-lab-title">逐步執行，看見條件怎麼分流。</h2><p>修改分數、出席率或邏輯運算子，會立即產生一份新的安全軌跡。</p></div>
            <LabShell className="conditionals-lab-shell" controls={controls} controlsLabel="條件判斷控制參數" playback={playerUnlocked ? <PlaybackControls playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <div className="conditionals-player-lock" role="status"><Circle size={15} aria-hidden="true" /> 提交上方預測後解鎖播放與單步控制</div>}>
              <div className="conditionals-execution-grid">
                <SourceCodePanel<ConditionalCodePart> className="conditionals-source-panel" lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} title="C 程式碼" status={phaseLabels[frame.phase]} explanation={frame.explanation} />
                <DecisionPanel frame={frame} />
              </div>
            </LabShell>
          </div>
        </section>

        <section className="conditionals-challenges" aria-labelledby="conditionals-challenges-title">
          <div className="page-width">
            <div className="conditionals-section-heading conditionals-challenges__heading"><span className="section-kicker">PUT IT INTO PRACTICE</span><h2 id="conditionals-challenges-title">預測、調參數、找錯：三種方式驗證理解。</h2><p>每題都依程式實際模擬結果判定；全部通過後，這個單元才會完成。</p></div>
            <ChallengePanel className="conditionals-challenge-panel" challenges={challengeItems} activeId={activeChallengeId} onSelect={setActiveChallengeId} label="條件判斷挑戰">
              {(item) => {
                const definition = CONDITIONAL_CHALLENGES.find((challenge) => challenge.id === item.id)!
                const feedback = challengeFeedback[item.id] ?? null
                if (item.id === 'predict-mixed-condition') return <div className="conditionals-challenge-card"><span className="conditionals-challenge-kind"><Sparkles size={16} /> 預測題</span><h3>{definition.description}</h3><code className="conditionals-challenge-code">int score = 72; int attendance = 65; if (score &gt;= 60 &amp;&amp; attendance &gt;= 70)</code><form aria-label="挑戰一預測" onSubmit={checkPredictionChallenge}><fieldset><legend>我預測會進入</legend><div className="conditionals-choice-group"><label><input type="radio" name="challenge-branch" checked={challengePrediction === 'if'} onChange={() => setChallengePrediction('if')} /><span><strong>if</strong><small>通過</small></span></label><label><input type="radio" name="challenge-branch" checked={challengePrediction === 'else'} onChange={() => setChallengePrediction('else')} /><span><strong>else</strong><small>再練習</small></span></label></div></fieldset><button type="submit" className="button button-primary">提交並揭曉</button></form>{feedback && <div className="conditionals-challenge-actual">實際分支：<code>{feedback.simulation.selectedBranch}</code> · 輸出：<code>{feedback.simulation.output.join(' ')}</code></div>}<ChallengeFeedback evaluation={feedback} /></div>
                if (item.id === 'make-both-pass') return <div className="conditionals-challenge-card"><span className="conditionals-challenge-kind"><SlidersHorizontal size={16} /> 調參數</span><h3>{definition.description}</h3><div className="conditionals-fixed-program"><span>固定條件</span><code>score &gt;= 60 &amp;&amp; attendance &gt;= 70</code></div><div className="conditionals-challenge-controls"><NumberControl id="challenge-conditional-score" label="score" min={CONDITIONAL_LIMITS.score.min} max={CONDITIONAL_LIMITS.score.max} value={challengeConfig.score} onChange={(score) => setChallengeConfig((current) => ({ ...current, score }))} /><NumberControl id="challenge-conditional-attendance" label="attendance" min={CONDITIONAL_LIMITS.attendance.min} max={CONDITIONAL_LIMITS.attendance.max} value={challengeConfig.attendance} onChange={(attendance) => setChallengeConfig((current) => ({ ...current, attendance }))} /></div><div className="conditionals-challenge-preview">目前結果：<code>{evaluateMakeBothPass(challengeConfig).simulation.output.join(' ')}</code></div><button type="button" className="button button-primary" onClick={checkConfigurationChallenge}>檢查實際輸出</button><ChallengeFeedback evaluation={feedback} /></div>
                return <div className="conditionals-challenge-card"><span className="conditionals-challenge-kind"><ShieldAlert size={16} /> 找錯題</span><h3>{definition.description}</h3><code className="conditionals-challenge-code is-warning">if (score &gt;= 60 || attendance &gt;= 70)</code><fieldset className="conditionals-diagnosis-options"><legend>第一步：為什麼這條規則太寬？</legend>{CONDITIONAL_DIAGNOSIS_OPTIONS.map((option) => <label key={option.id}><input type="radio" name="conditional-diagnosis" value={option.id} checked={diagnosis === option.id} onChange={() => setDiagnosis(option.id)} /><span>{option.label}</span></label>)}</fieldset><fieldset className="conditionals-repair-control"><legend>第二步：把運算子修成</legend><div role="radiogroup" aria-label="修正後的邏輯運算子">{CONDITIONAL_LOGICAL_OPERATORS.map((operator) => <label key={operator}><input type="radio" name="repair-operator" checked={repairOperator === operator} onChange={() => setRepairOperator(operator)} /><code>{operator}</code></label>)}</div></fieldset><button type="button" className="button button-primary" onClick={checkRepairChallenge}>檢查診斷與修正</button><ChallengeFeedback evaluation={feedback} /></div>
              }}
            </ChallengePanel>
            {lessonCompleted && <div className="conditionals-completion-banner" role="status"><span><Trophy size={26} aria-hidden="true" /></span><div><small>LESSON COMPLETE</small><h2>做得很好，你已完成條件判斷單元！</h2><p>你已能比較條件、選擇分支，並解釋邏輯運算如何影響流程。</p></div><Link className="button button-light" to="/learn">回到課程地圖 <ChevronRight size={17} aria-hidden="true" /></Link></div>}
          </div>
        </section>

        <section className="conditionals-recap" aria-labelledby="conditionals-recap-title"><div className="page-width conditionals-recap__layout"><div><span className="section-kicker">KEY TAKEAWAYS</span><h2 id="conditionals-recap-title">離開前，記住這四件事。</h2></div><ol><li><span>01</span><p>比較運算會先產生真或假，再交給 <code>if</code>。</p></li><li><span>02</span><p><code>=</code> 是賦值；<code>==</code> 才是比較是否相等。</p></li><li><span>03</span><p><code>if</code> 走真分支，否則由 <code>else</code> 接手。</p></li><li><span>04</span><p><code>&amp;&amp;</code> 要兩邊都真；<code>||</code> 一邊真就足夠，並且可能短路。</p></li></ol></div></section>

        <section className="progress-management conditionals-progress-management"><div className="page-width">{!showClearConfirm ? <button ref={clearTriggerRef} type="button" onClick={() => setShowClearConfirm(true)}><Trash2 size={16} aria-hidden="true" /> 清除這台裝置的學習進度</button> : <div className="clear-confirm conditionals-clear-confirm" role="alertdialog" aria-modal="true" aria-labelledby="conditionals-clear-progress-title" aria-describedby="conditionals-clear-progress-description" onKeyDown={handleClearDialogKeyDown}><div><strong id="conditionals-clear-progress-title">確定清除全部進度？</strong><span id="conditionals-clear-progress-description">所有單元、挑戰與參數紀錄都會被移除，且無法復原。</span></div><button ref={clearConfirmRef} type="button" onClick={clearAllProgress}>確定清除</button><button type="button" onClick={cancelClear}>取消</button></div>}</div></section>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{liveAnnouncement}</p>
      </div>
    </div>
  )
}
