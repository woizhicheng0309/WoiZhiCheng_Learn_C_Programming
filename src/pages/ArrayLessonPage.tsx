import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  Brackets,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  Info,
  Lightbulb,
  MoveRight,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  Trophy,
  Type,
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
  ARRAY_LIMITS,
  DEFAULT_ARRAY_CONFIG,
  INITIAL_SCORES,
  buildArraySource,
  simulateArrayProgram,
  validateArrayConfig,
  type ArrayConfig,
  type ArrayFrame,
  type ArrayMemoryCell,
  type ArrayPhase,
  type ArrayScalarState,
  type GeneratedArraySource,
} from '../domain'
import {
  ARRAY_BOUNDS_INDEX,
  ARRAY_CHALLENGES,
  ARRAY_INDEX_CLASSIFICATION_OPTIONS,
  ARRAY_MODIFICATION_INDEX,
  evaluateArrayElementModification,
  evaluateArrayIndexClassification,
  evaluateArrayIndexPrediction,
  type ArrayChallengeEvaluation,
  type ArrayChallengeId,
  type ArrayIndexClassification,
} from '../data'
import { useLearningProgress } from '../hooks/useLearningProgress'
import {
  useTracePlayer,
  type PlaybackSpeed,
} from '../hooks/useTracePlayer'

const LESSON_ID = 'arrays-basics' as const

const phaseLabels: Record<ArrayPhase, string> = {
  'enter-main': '進入 main',
  'declare-array': '宣告 scores',
  'initialize-array': '初始化陣列',
  'init-index': '設定 index',
  'read-element': '讀取元素',
  'write-element': '改寫元素',
  print: '輸出前後值',
  'return-main': 'main 回傳',
  done: '執行完成',
  blocked: '安全停止',
}

function readSavedConfig(value: unknown): ArrayConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_ARRAY_CONFIG }
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.index !== 'number'
    || typeof candidate.newValue !== 'number'
  ) return { ...DEFAULT_ARRAY_CONFIG }

  const config = { index: candidate.index, newValue: candidate.newValue }
  return validateArrayConfig(config).length === 0
    ? config
    : { ...DEFAULT_ARRAY_CONFIG }
}

function arrayConfigKey(config: ArrayConfig): string {
  return `${config.index}:${config.newValue}`
}

function sourceLinesFor(
  source: GeneratedArraySource,
): readonly SourceCodeLine<string>[] {
  return source.lines.map((line) => {
    switch (line.lineNumber) {
      case 3:
        return {
          lineNumber: 3,
          parts: [{ id: 'main-signature', text: line.code }],
        }
      case 4: {
        const initializerStart = line.code.indexOf('{')
        return {
          lineNumber: 4,
          parts: [
            {
              id: 'array-declaration',
              text: line.code.slice(0, initializerStart),
            },
            {
              id: 'array-initializer',
              text: line.code.slice(initializerStart),
            },
          ],
        }
      }
      case 5:
        return { lineNumber: 5, parts: [{ id: 'index-initializer', text: line.code }] }
      case 6:
        return { lineNumber: 6, parts: [{ id: 'array-read', text: line.code }] }
      case 7:
        return { lineNumber: 7, parts: [{ id: 'array-write', text: line.code }] }
      case 8:
        return { lineNumber: 8, parts: [{ id: 'printf', text: line.code }] }
      case 9:
        return { lineNumber: 9, parts: [{ id: 'return', text: line.code }] }
      case 10:
        return { lineNumber: 10, parts: [{ id: 'exit', text: line.code }] }
      default:
        return {
          lineNumber: line.lineNumber,
          parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }],
        }
    }
  })
}

function NumberControl({
  id,
  label,
  description,
  value,
  onChange,
  min,
  max,
}: {
  id: string
  label: string
  description: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}) {
  const numberInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = numberInputRef.current
    if (input && input.value !== String(value)) input.value = String(value)
  }, [value])

  const updateDraft = (draft: string) => {
    if (draft.trim() === '' || draft === '-' || draft === '+') return
    const nextValue = Number(draft)
    if (Number.isInteger(nextValue)) onChange(nextValue)
  }

  const valueInRange = value >= min && value <= max

  return (
    <div className="functions-number-control">
      <div className="functions-control-label">
        <label htmlFor={`${id}-number`}>{label}</label>
        <small>{description}</small>
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
        {valueInRange ? (
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            aria-label={`${label}滑桿`}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        ) : (
          <span className="arrays-range-unavailable" role="status">
            已保留 {value}；超出滑桿範圍 {min}–{max}，執行時會安全停止。
          </span>
        )}
      </div>
    </div>
  )
}

function memoryCellChanged(
  before: Readonly<ArrayMemoryCell>,
  after: Readonly<ArrayMemoryCell>,
): boolean {
  return before.declared !== after.declared
    || before.initialized !== after.initialized
    || before.inScope !== after.inScope
    || !Object.is(before.value, after.value)
}

function scalarValue(state: Readonly<ArrayScalarState>): string {
  if (!state.declared) return '尚未宣告'
  if (!state.initialized) return '尚未賦值'
  if (!state.inScope) return '離開作用域'
  return String(state.value)
}

function ArrayMemoryPanel({ frame }: { frame: ArrayFrame }) {
  const selectedIndex = frame.highlightedIndex
  const accessLabel = frame.accessKind === 'read'
    ? 'READ · 讀取'
    : frame.accessKind === 'write'
      ? 'WRITE · 寫入'
      : selectedIndex !== null
        ? 'INDEX · 定位'
        : null

  const flowText = frame.accessKind === 'read' && frame.readValue !== null
    ? frame.phase === 'print'
      ? `selected = ${frame.readValue}，scores[${selectedIndex}] = ${frame.writtenValue}`
      : `scores[${selectedIndex}] → selected = ${frame.readValue}`
    : frame.accessKind === 'write'
      ? `${frame.readValue} → ${frame.writtenValue}，寫入 scores[${selectedIndex}]`
      : selectedIndex !== null
        ? `index = ${selectedIndex}，定位到 scores[${selectedIndex}]`
        : '設定 index 後，方括號會定位到對應的元素。'

  return (
    <section className="arrays-memory-panel lab-panel" aria-labelledby="arrays-memory-title">
      <div className="arrays-memory-panel__heading">
        <div>
          <small>CONTIGUOUS MEMORY</small>
          <h2 id="arrays-memory-title">scores 的連續記憶格</h2>
        </div>
        {accessLabel && (
          <span className={`arrays-access-badge is-${frame.accessKind}`}>
            {frame.accessKind === 'write'
              ? <ArrowRight size={14} aria-hidden="true" />
              : <MoveRight size={14} aria-hidden="true" />}
            {accessLabel}
          </span>
        )}
      </div>

      <div
        className="arrays-memory-scroll"
        tabIndex={0}
        aria-label="scores 陣列，共五個連續元素；窄螢幕可水平捲動查看"
      >
        <div className="arrays-memory-row" role="list" aria-label="scores 的五個元素">
          {frame.scores.map((cell) => {
            const highlighted = selectedIndex === cell.index
            const reading = highlighted && frame.accessKind === 'read'
            const writing = highlighted && frame.accessKind === 'write'
            const changed = memoryCellChanged(
              frame.memoryBefore.scores[cell.index],
              frame.memoryAfter.scores[cell.index],
            )
            const state = !cell.declared
              ? '尚未宣告'
              : !cell.initialized
                ? '尚未初始化'
                : !cell.inScope
                  ? '已離開作用域'
                  : writing
                    ? '目前寫入'
                    : reading
                      ? '目前讀取'
                      : highlighted
                        ? 'index 指向這格'
                        : '已初始化'
            const visibleValue = !cell.declared
              ? '—'
              : !cell.inScope
                ? '—'
              : !cell.initialized
                ? '?'
                : String(cell.value)
            const accessibleValue = !cell.declared
              || !cell.initialized
              || !cell.inScope
              ? state
              : `值 ${cell.value}，${state}`

            return (
              <div
                role="listitem"
                className={[
                  'arrays-memory-cell',
                  cell.declared && 'is-declared',
                  cell.initialized && 'is-initialized',
                  highlighted && 'is-highlighted',
                  reading && 'is-reading',
                  writing && 'is-writing',
                  changed && 'is-changed',
                  !cell.inScope && cell.declared && 'is-out-of-scope',
                ].filter(Boolean).join(' ')}
                aria-label={`scores 索引 ${cell.index}，${accessibleValue}`}
                key={cell.index}
              >
                <span className="arrays-cell-state">
                  {reading ? '讀取' : writing ? '寫入' : highlighted ? '定位' : state}
                </span>
                <strong className="arrays-cell-value">{visibleValue}</strong>
                <code className="arrays-cell-index">[{cell.index}]</code>
              </div>
            )
          })}
        </div>
      </div>

      <div className="arrays-scalar-grid" aria-label="目前的純量變數">
        <div className="arrays-scalar-cell">
          <small>索引變數</small><code>index</code>
          <strong>{scalarValue(frame.memoryAfter.indexVariable)}</strong>
        </div>
        <div className="arrays-scalar-cell">
          <small>讀取結果的副本</small><code>selected</code>
          <strong>{scalarValue(frame.memoryAfter.selected)}</strong>
        </div>
      </div>

      <div className={`arrays-access-flow is-${frame.accessKind}`}>
        {frame.accessKind === 'write'
          ? <ArrowRight size={18} aria-hidden="true" />
          : <MoveRight size={18} aria-hidden="true" />}
        <span>{flowText}</span>
      </div>

      <div className="arrays-console">
        <div><Terminal size={15} aria-hidden="true" /><span>printf 輸出</span></div>
        <code>{frame.outputText ?? '尚無輸出'}</code>
      </div>
    </section>
  )
}

function MiniArray({
  values,
  highlightedIndex = null,
  outOfBoundsIndex = null,
  label,
}: {
  values: readonly number[]
  highlightedIndex?: number | null
  outOfBoundsIndex?: number | null
  label: string
}) {
  return (
    <div className="arrays-challenge-array" role="img" aria-label={label}>
      {values.map((value, index) => (
        <span className={index === highlightedIndex ? 'is-highlighted' : ''} key={index}>
          <strong>{value}</strong><code>[{index}]</code>
        </span>
      ))}
      {outOfBoundsIndex !== null && (
        <span className="is-out-of-bounds">
          <strong>?</strong><code>[{outOfBoundsIndex}]</code>
        </span>
      )}
    </div>
  )
}

function ChallengeFeedback({
  evaluation,
}: {
  evaluation: ArrayChallengeEvaluation | null
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
      <p>{evaluation.message}</p>
    </div>
  )
}

export function ArrayLessonPage() {
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
  const persistedConfig = readSavedConfig(persistedLessonProgress?.savedState ?? null)
  const persistedConfigKey = arrayConfigKey(persistedConfig)
  const hasPersistedLesson = persistedLessonProgress !== undefined
  const persistedGuidedRunCompleted =
    persistedLessonProgress?.guidedRunCompleted ?? false

  const [config, setConfig] = useState<ArrayConfig>(() =>
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
  const [activeChallengeId, setActiveChallengeId] = useState<ArrayChallengeId>(
    () => ARRAY_CHALLENGES.find((challenge) =>
      !lessonProgress.completedChallengeIds.includes(challenge.id),
    )?.id ?? ARRAY_CHALLENGES[0].id,
  )
  const [challengePrediction, setChallengePrediction] = useState('')
  const [challengeNewValue, setChallengeNewValue] = useState(9)
  const [boundsAnswer, setBoundsAnswer] =
    useState<ArrayIndexClassification | null>(null)
  const [challengeFeedback, setChallengeFeedback] = useState<
    Partial<Record<ArrayChallengeId, ArrayChallengeEvaluation>>
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

  const simulation = useMemo(() => simulateArrayProgram(config), [config])
  const sourceLines = useMemo(
    () => sourceLinesFor(buildArraySource(config)),
    [config],
  )
  const player = useTracePlayer({
    frames: simulation.frames,
    speed,
    config: arrayConfigKey(config),
  })
  const frame = player.frame ?? simulation.frames[0]
  const completedCount = ARRAY_CHALLENGES.filter((challenge) =>
    lessonProgress.completedChallengeIds.includes(challenge.id),
  ).length
  const lessonCompleted = completedCount === ARRAY_CHALLENGES.length
  const predictionRevealed = predictionResult !== null && frame.readValue !== null

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
      setConfig({
        index: persistedConfig.index,
        newValue: persistedConfig.newValue,
      })
      setPrediction('')
      setPredictionError(null)
      setPredictionResult(null)
      setPlayerUnlocked(persistedGuidedRunCompleted)
      return
    }

    if (previous.guidedRunCompleted !== persistedGuidedRunCompleted) {
      setPlayerUnlocked(persistedGuidedRunCompleted)
    }
  }, [
    hasPersistedLesson,
    persistedConfig.index,
    persistedConfig.newValue,
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

  const saveConfig = (next: ArrayConfig) => {
    const valid = validateArrayConfig(next).length === 0
    setConfig(next)
    setPrediction('')
    setPredictionError(null)
    setPredictionResult(null)
    setPlayerUnlocked(valid ? lessonProgress.guidedRunCompleted : true)
    if (valid) rememberLessonState(LESSON_ID, next)
  }

  const changeConfig = (field: keyof ArrayConfig, value: number) => {
    saveConfig({ ...config, [field]: value })
  }

  const submitPrediction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const predicted = prediction.trim() === '' ? Number.NaN : Number(prediction)
    if (!Number.isFinite(predicted) || !Number.isInteger(predicted)) {
      setPredictionError('請先輸入一個整數作為你的預測。')
      return
    }
    if (simulation.selectedValue === null) {
      setPredictionError(simulation.message)
      return
    }

    setPredictionResult({
      predicted,
      actual: simulation.selectedValue,
      matched: Object.is(predicted, simulation.selectedValue),
    })
    setPredictionError(null)
    setPlayerUnlocked(true)
    player.reset()
  }

  const completeChallenge = (
    id: ArrayChallengeId,
    evaluation: ArrayChallengeEvaluation,
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
      'predict-index-read',
      evaluateArrayIndexPrediction(
        value !== null && Number.isFinite(value) ? value : null,
      ),
    )
  }

  const checkModificationChallenge = () => {
    completeChallenge(
      'modify-element-to-target',
      evaluateArrayElementModification({
        index: ARRAY_MODIFICATION_INDEX,
        newValue: challengeNewValue,
      }),
    )
  }

  const checkBoundsChallenge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    completeChallenge(
      'identify-valid-index',
      evaluateArrayIndexClassification(boundsAnswer),
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
    }
  }

  const clearAllProgress = () => {
    resetProgress()
    setConfig({ ...DEFAULT_ARRAY_CONFIG })
    setPlayerUnlocked(false)
    setPrediction('')
    setPredictionError(null)
    setPredictionResult(null)
    setActiveChallengeId(ARRAY_CHALLENGES[0].id)
    setChallengePrediction('')
    setChallengeNewValue(9)
    setBoundsAnswer(null)
    setChallengeFeedback({})
    setShowClearConfirm(false)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const challengeItems: readonly ChallengePanelItem<ArrayChallengeId>[] =
    ARRAY_CHALLENGES.map((challenge) => ({
      id: challenge.id,
      label: challenge.title,
      eyebrow: `CHALLENGE ${String(challenge.order).padStart(2, '0')}`,
      completed: lessonProgress.completedChallengeIds.includes(challenge.id),
    }))

  const controls = (
    <details className="functions-controls" open>
      <summary>
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span><small>CONTROL PANEL</small>調整索引與新值</span>
      </summary>
      <div className="functions-controls__body">
        <NumberControl
          id="array-index"
          label="index 的值"
          description="合法範圍 0 到 4"
          value={config.index}
          min={ARRAY_LIMITS.index.min}
          max={ARRAY_LIMITS.index.max}
          onChange={(value) => changeConfig('index', value)}
        />
        <NumberControl
          id="array-new-value"
          label="newValue 的值"
          description="-20 到 100 的整數"
          value={config.newValue}
          min={ARRAY_LIMITS.newValue.min}
          max={ARRAY_LIMITS.newValue.max}
          onChange={(value) => changeConfig('newValue', value)}
        />
        <div className="functions-call-preview arrays-write-preview">
          <small>這次改寫</small>
          <code>scores[{config.index}] = {config.newValue}</code>
        </div>
        <button
          type="button"
          className="functions-restore-button"
          onClick={() => saveConfig({ ...DEFAULT_ARRAY_CONFIG })}
        >
          <RotateCcw size={16} aria-hidden="true" /> 恢復預設值
        </button>
        <div className="functions-safety-note">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>只模擬固定的五格陣列；不會編譯或執行任意 C 程式碼。</p>
        </div>
      </div>
    </details>
  )

  const liveAnnouncement = playerUnlocked
    ? `${phaseLabels[frame.phase]}。${frame.explanation}`
    : ''

  return (
    <div className="arrays-page functions-page lab-page">
      <section className="arrays-hero functions-hero lab-hero">
        <div className="page-width">
          <nav className="breadcrumbs" aria-label="麵包屑">
            <Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" />
            <span>陣列與字串</span>
          </nav>
          <div className="functions-hero__layout">
            <div className="functions-hero__copy">
              <Link className="back-link" to="/learn">
                <ArrowLeft size={16} aria-hidden="true" /> 回到課程地圖
              </Link>
              <span className="section-kicker">MODULE 05 · LESSON 01</span>
              <h1>把一排資料放進陣列，<br />從 index 0 找到每一格。</h1>
              <p>
                逐步追蹤 <code>scores[index]</code>：看見同一個索引如何先讀後寫，以及為什麼長度 5 的最後索引是 4。
              </p>
            </div>
            <aside
              className={`lesson-status-card${lessonCompleted ? ' complete' : ''}`}
              aria-label="本單元學習進度"
            >
              <div>
                {lessonCompleted
                  ? <Trophy size={21} aria-hidden="true" />
                  : <Boxes size={21} aria-hidden="true" />}
                <span>{lessonCompleted ? '單元完成' : '學習進度'}</span>
              </div>
              <strong>{completedCount}<small>/3</small></strong>
              <p>{lessonCompleted ? '三個挑戰全部完成！' : '通過三題即可完成這個單元'}</p>
            </aside>
          </div>
        </div>
      </section>

      <div className="functions-page__content">
        <section className="functions-overview page-width" aria-labelledby="arrays-objectives-title">
          <div className="functions-objectives">
            <span className="section-kicker">LEARNING GOALS</span>
            <h2 id="arrays-objectives-title">這一課，你會學會什麼？</h2>
            <ul>
              <li><Check size={17} aria-hidden="true" />讀懂陣列宣告、長度與大括號裡的初始值。</li>
              <li><Check size={17} aria-hidden="true" />從 0 起算，將索引對應到正確的元素。</li>
              <li><Check size={17} aria-hidden="true" />分清楚讀取會複製值，寫入才會改變原本的格子。</li>
            </ul>
          </div>
          <div className="functions-concepts" aria-label="陣列概念短講">
            <article>
              <span><Boxes size={18} aria-hidden="true" /></span>
              <small>01 · 一組資料</small>
              <h3>同型別元素排在一起</h3>
              <p><code>int scores[5]</code> 一次建立五個 int 元素，用同一個名稱管理。</p>
            </article>
            <article>
              <span><Brackets size={18} aria-hidden="true" /></span>
              <small>02 · 索引</small>
              <h3>第一格不是 1，而是 0</h3>
              <p>五格陣列的合法索引是 0、1、2、3、4；索引 5 已經越界。</p>
            </article>
            <article>
              <span><ArrowRight size={18} aria-hidden="true" /></span>
              <small>03 · 讀與寫</small>
              <h3>同一對方括號，兩種方向</h3>
              <p>右側的 <code>scores[index]</code> 讀值；放在等號左側時則改寫該格。</p>
            </article>
          </div>
        </section>

        <section className="functions-prediction-section" aria-labelledby="arrays-prediction-title">
          <div className="page-width functions-prediction-card">
            <div className="functions-prediction-card__copy">
              <span className="section-kicker">PREDICT BEFORE RUN</span>
              <h2 id="arrays-prediction-title">
                先別按播放。scores[{config.index}] 在改寫前是多少？
              </h2>
              <p>先留下預測；答案會等執行走到讀取那一步才揭曉。</p>
              <code className="functions-prediction-expression">
                {'{'}{INITIAL_SCORES.join(', ')}{'}'} → scores[{config.index}]
              </code>
            </div>
            <form className="functions-prediction-form" onSubmit={submitPrediction}>
              <label htmlFor="array-guided-prediction">我預測 selected 會收到</label>
              <div>
                <input
                  id="array-guided-prediction"
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
            {predictionResult && !predictionRevealed && (
              <div className="functions-prediction-result is-pending" role="status">
                <Circle size={20} aria-hidden="true" />
                <div><strong>預測已記錄。</strong><span>走到「讀取元素」時才會揭曉。</span></div>
              </div>
            )}
            {predictionResult && predictionRevealed && (
              <div className={`functions-prediction-result ${predictionResult.matched ? 'is-match' : 'is-different'}`} role="status">
                {predictionResult.matched
                  ? <CheckCircle2 size={20} aria-hidden="true" />
                  : <Lightbulb size={20} aria-hidden="true" />}
                <div>
                  <strong>{predictionResult.matched ? '預測正確！' : '結果不一樣，再從索引 0 數一次。'}</strong>
                  <span>你猜 {predictionResult.predicted}，實際讀到 {predictionResult.actual}。</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="functions-lab-section" aria-labelledby="arrays-lab-title">
          <div className="page-width">
            <div className="functions-section-heading">
              <span className="section-kicker">FOLLOW THE INDEX</span>
              <h2 id="arrays-lab-title">逐步執行，看見值從哪一格進出。</h2>
              <p>改變 index 會換一個目標格；改變 newValue 則會改寫同一格，但 selected 仍保留先前讀到的舊值。</p>
            </div>

            <LabShell
              className="functions-lab-shell arrays-lab-shell"
              controls={controls}
              controlsLabel="陣列索引控制"
              playback={playerUnlocked ? (
                <PlaybackControls
                  playing={player.playing}
                  atStart={player.atStart}
                  atEnd={player.atEnd}
                  speed={speed}
                  controlName="陣列執行"
                  onPlay={player.play}
                  onPause={player.pause}
                  onNext={player.next}
                  onReset={player.reset}
                  onReplay={player.replay}
                  onSpeedChange={setSpeed}
                />
              ) : (
                <div className="functions-player-lock" role="status">
                  <ShieldAlert size={18} aria-hidden="true" />
                  提交上方預測後解鎖播放與單步控制。
                </div>
              )}
              footer={(
                <div className="functions-trace-footer">
                  <div>
                    <small>STEP {player.frameIndex + 1} / {simulation.frames.length}</small>
                    <strong>{phaseLabels[frame.phase]}</strong>
                  </div>
                  <p>{frame.explanation}</p>
                  {simulation.status === 'blocked' && frame.phase === 'blocked' && (
                    <p className="functions-blocked-message" role="alert">{simulation.message}</p>
                  )}
                </div>
              )}
            >
              <SourceCodePanel
                lines={sourceLines}
                activeLine={frame.activeLine}
                activePart={frame.activePart}
                title={<><Code2 size={17} aria-hidden="true" /> C 程式碼</>}
                status={<span>{phaseLabels[frame.phase]}</span>}
                explanation={<span>{frame.explanation}</span>}
              />
              <ArrayMemoryPanel frame={frame} />
            </LabShell>
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveAnnouncement}
            </p>
          </div>
        </section>

        <section className="arrays-string-section" aria-labelledby="arrays-string-title">
          <div className="page-width arrays-string-layout">
            <div>
              <span className="section-kicker">ARRAYS BECOME STRINGS</span>
              <h2 id="arrays-string-title">字串，其實是以 <code>'\0'</code> 結尾的 char 陣列。</h2>
              <p>
                C 沒有獨立的字串型別。<code>char word[] = "CODE";</code> 會多留一格空字元，讓函式知道文字在哪裡結束。
              </p>
              <div className="arrays-string-note">
                <Type size={18} aria-hidden="true" />
                <span><code>printf("%s", word)</code> 會從第一格一路讀到 <code>'\0'</code>。</span>
              </div>
            </div>
            <div
              className="arrays-string-strip"
              role="img"
              tabIndex={0}
              aria-label="字串 CODE 的五個字元格：索引 0 是 C、1 是 O、2 是 D、3 是 E、4 是字串終止空字元"
            >
              {['C', 'O', 'D', 'E', '\\0'].map((character, index) => (
                <span className={character === '\\0' ? 'is-terminator' : ''} key={index}>
                  <strong>{character}</strong><code>[{index}]</code>
                  {character === '\\0' && <small>結尾</small>}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="functions-challenges" aria-labelledby="arrays-challenges-title">
          <div className="page-width">
            <div className="functions-challenges__heading">
              <div>
                <span className="section-kicker">CHECK YOUR MODEL</span>
                <h2 id="arrays-challenges-title">三個挑戰，確認你真的找對格子。</h2>
              </div>
              <p><Sparkles size={16} aria-hidden="true" /> 已完成 {completedCount} / 3</p>
            </div>

            <ChallengePanel
              className="functions-challenge-panel"
              challenges={challengeItems}
              activeId={activeChallengeId}
              onSelect={setActiveChallengeId}
              label="陣列學習挑戰"
            >
              {(activeChallenge) => (
                <article className="functions-challenge-card">
                  {activeChallenge.id === 'predict-index-read' && (
                    <>
                      <span className="functions-challenge-kind"><BookOpen size={16} aria-hidden="true" /> 索引預測</span>
                      <h3>scores[2] 會讀到哪個值？</h3>
                      <MiniArray
                        values={INITIAL_SCORES}
                        highlightedIndex={2}
                        label="陣列值依序為 4、7、2、9、5，目前詢問索引 2"
                      />
                      <form className="functions-challenge-form" onSubmit={checkPredictionChallenge}>
                        <label htmlFor="array-challenge-prediction">你的答案</label>
                        <div>
                          <input
                            id="array-challenge-prediction"
                            type="number"
                            step={1}
                            value={challengePrediction}
                            onChange={(event) => setChallengePrediction(event.target.value)}
                          />
                          <button className="button button-primary" type="submit">檢查答案</button>
                        </div>
                      </form>
                      <ChallengeFeedback evaluation={challengeFeedback['predict-index-read'] ?? null} />
                    </>
                  )}

                  {activeChallenge.id === 'modify-element-to-target' && (
                    <>
                      <span className="functions-challenge-kind"><ArrowRight size={16} aria-hidden="true" /> 元素改寫</span>
                      <h3>只改 newValue，讓 scores[3] 從 9 變成 10。</h3>
                      <div className="arrays-challenge-before-after">
                        <MiniArray
                          values={INITIAL_SCORES}
                          highlightedIndex={ARRAY_MODIFICATION_INDEX}
                          label="改寫前的 scores，索引 3 的值是 9"
                        />
                        <span className="arrays-challenge-arrow"><ArrowRight size={18} aria-hidden="true" />寫入</span>
                        <MiniArray
                          values={INITIAL_SCORES.map((value, index) =>
                            index === ARRAY_MODIFICATION_INDEX ? challengeNewValue : value,
                          )}
                          highlightedIndex={ARRAY_MODIFICATION_INDEX}
                          label={`改寫後的 scores，索引 3 的值是 ${challengeNewValue}`}
                        />
                      </div>
                      <div className="functions-challenge-controls arrays-challenge-controls">
                        <NumberControl
                          id="array-challenge-new-value"
                          label="寫入 scores[3] 的新值"
                          description="目標是 10"
                          value={challengeNewValue}
                          min={ARRAY_LIMITS.newValue.min}
                          max={ARRAY_LIMITS.newValue.max}
                          onChange={setChallengeNewValue}
                        />
                      </div>
                      <button className="button button-primary" type="button" onClick={checkModificationChallenge}>
                        執行改寫並檢查
                      </button>
                      <ChallengeFeedback evaluation={challengeFeedback['modify-element-to-target'] ?? null} />
                    </>
                  )}

                  {activeChallenge.id === 'identify-valid-index' && (
                    <>
                      <span className="functions-challenge-kind"><AlertTriangle size={16} aria-hidden="true" /> 邊界判斷</span>
                      <h3>scores 有五格，scores[{ARRAY_BOUNDS_INDEX}] 合法嗎？</h3>
                      <div
                        className="arrays-bounds-strip"
                        tabIndex={0}
                        aria-label="索引邊界示意，可水平捲動查看"
                      >
                        <MiniArray
                          values={INITIAL_SCORES}
                          outOfBoundsIndex={ARRAY_BOUNDS_INDEX}
                          label="scores 的合法索引是 0 到 4，虛線位置是索引 5"
                        />
                      </div>
                      <form className="functions-challenge-form" onSubmit={checkBoundsChallenge}>
                        <fieldset className="functions-scope-options">
                          <legend>選擇你的判斷</legend>
                          {ARRAY_INDEX_CLASSIFICATION_OPTIONS.map((option) => (
                            <label key={option.id}>
                              <input
                                type="radio"
                                name="array-bounds-answer"
                                value={option.id}
                                checked={boundsAnswer === option.id}
                                onChange={() => setBoundsAnswer(option.id)}
                              />
                              {option.label}
                            </label>
                          ))}
                        </fieldset>
                        <button className="button button-primary" type="submit">檢查邊界</button>
                      </form>
                      <div className="arrays-undefined-note">
                        <ShieldAlert size={18} aria-hidden="true" />
                        <p>C 不會自動替陣列做邊界檢查；越界存取是未定義行為，不能假定會得到某個值，也不能假定一定立刻崩潰。本網站的模擬器會先阻止它，方便你安全學習。</p>
                      </div>
                      <ChallengeFeedback evaluation={challengeFeedback['identify-valid-index'] ?? null} />
                    </>
                  )}
                </article>
              )}
            </ChallengePanel>

            {lessonCompleted && (
              <div className="functions-completion-banner" role="status">
                <span><Trophy size={24} aria-hidden="true" /></span>
                <div>
                  <small>MODULE 05 COMPLETE</small>
                  <h2>你已完成陣列、索引與字串。</h2>
                  <p>你能追蹤元素讀寫、辨識合法索引，也知道 C 字串為什麼需要 <code>'\0'</code>。</p>
                </div>
                <Link className="button button-light" to="/learn">回到課程地圖</Link>
              </div>
            )}
          </div>
        </section>

        <section className="functions-recap">
          <div className="page-width functions-recap__layout">
            <div>
              <span className="section-kicker">KEEP THESE THREE IDEAS</span>
              <h2>離開第五章前，記住三件事。</h2>
            </div>
            <ol>
              <li><span>01</span><p>長度為 N 的陣列，合法索引是 <code>0</code> 到 <code>N - 1</code>。</p></li>
              <li><span>02</span><p>讀取元素會複製出一個值；之後改寫原陣列，不會回頭改掉那份副本。</p></li>
              <li><span>03</span><p>C 字串是 char 陣列，最後用 <code>'\0'</code> 標記文字結束。</p></li>
            </ol>
          </div>
        </section>

        <section className="functions-progress-management" aria-label="學習進度管理">
          <div className="page-width">
            {!showClearConfirm ? (
              <button
                ref={clearTriggerRef}
                type="button"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 size={16} aria-hidden="true" /> 清除全部學習進度
              </button>
            ) : (
              <div
                className="functions-clear-confirm"
                role="alertdialog"
                aria-labelledby="arrays-clear-title"
                aria-describedby="arrays-clear-description"
                onKeyDown={handleClearDialogKeyDown}
              >
                <div>
                  <strong id="arrays-clear-title">確定清除全部進度？</strong>
                  <span id="arrays-clear-description">這會清除所有章節的挑戰與已儲存設定。</span>
                </div>
                <button ref={clearConfirmRef} type="button" onClick={clearAllProgress}>確定清除</button>
                <button type="button" onClick={cancelClear}>取消</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
