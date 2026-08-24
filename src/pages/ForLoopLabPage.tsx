import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Gauge,
  Info,
  ListTree,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  Trophy,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
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
  COMPARATORS,
  DEFAULT_LOOP_CONFIG,
  LOOP_LIMITS,
  simulateForLoop,
  type Comparator,
  type GeneratedLoopSource,
  type LoopConfig,
  type LoopFrame,
  type LoopPhase,
} from '../domain'
import {
  FOR_LOOP_CHALLENGES,
  isChallengeSolved,
  type ChallengeId,
} from '../data'
import { useLearningProgress } from '../hooks/useLearningProgress'
import {
  useTracePlayer,
  type PlaybackSpeed,
} from '../hooks/useTracePlayer'
import { isForLoopLessonCompleted } from '../state'

const phaseLabels: Record<LoopPhase, string> = {
  init: '初始化',
  condition: '檢查條件',
  body: '執行內容',
  increment: '更新 i',
  done: '正常完成',
  blocked: '安全停止',
}

const workingPhaseOrder: LoopPhase[] = [
  'init',
  'condition',
  'body',
  'increment',
]

const comparatorDescriptions: Record<Comparator, string> = {
  '<': '小於',
  '<=': '小於或等於',
  '>': '大於',
  '>=': '大於或等於',
}

type ChallengeFeedback = {
  kind: 'success' | 'try-again' | 'blocked'
  text: string
} | null

function NumericControl({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="numeric-control">
      <div className="control-label-row">
        <label htmlFor={`${id}-number`}><span>{label}</span><code>{id}</code></label>
        <small>{hint}</small>
      </div>
      <div className="number-input-row">
        <input
          id={`${id}-number`}
          className="number-input"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
          }}
        />
        <input
          aria-label={`${label}滑桿`}
          className="range-input"
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="range-bounds" aria-hidden="true"><i>{min}</i><i>{max}</i></span>
      </div>
    </div>
  )
}

function toSourceCodeLines(source: GeneratedLoopSource): readonly SourceCodeLine[] {
  return source.lines.map((line) => {
    if (line.lineNumber === 4) {
      const open = line.code.indexOf('(')
      const firstSeparator = line.code.indexOf(';', open + 1)
      const secondSeparator = line.code.indexOf(';', firstSeparator + 1)
      const close = line.code.lastIndexOf(')')

      if (
        open >= 0 &&
        firstSeparator > open &&
        secondSeparator > firstSeparator &&
        close > secondSeparator
      ) {
        return {
          lineNumber: line.lineNumber,
          parts: [
            { id: 'syntax-open', text: line.code.slice(0, open + 1) },
            { id: 'initializer', text: line.code.slice(open + 1, firstSeparator) },
            { id: 'syntax-condition', text: line.code.slice(firstSeparator, firstSeparator + 2) },
            { id: 'condition', text: line.code.slice(firstSeparator + 2, secondSeparator) },
            { id: 'syntax-increment', text: line.code.slice(secondSeparator, secondSeparator + 2) },
            { id: 'increment', text: line.code.slice(secondSeparator + 2, close) },
            { id: 'exit', text: line.code.slice(close) },
          ],
        }
      }
    }

    return {
      lineNumber: line.lineNumber,
      parts: [{
        id: line.lineNumber === 5 ? 'body' : `static-line-${line.lineNumber}`,
        text: line.code || ' ',
      }],
    }
  })
}

function RuntimePanel({
  frame,
  lastCondition,
}: {
  frame: LoopFrame
  lastCondition: boolean | null
}) {
  const nearbyValues = Array.from(
    { length: 5 },
    (_, index) => frame.currentValue + index - 2,
  )
  const conditionState = frame.phase === 'blocked'
    ? 'blocked'
    : lastCondition === null
      ? 'waiting'
      : lastCondition
        ? 'true'
        : 'false'

  return (
    <section className="lab-panel runtime-panel" aria-labelledby="runtime-panel-title">
      <div className="panel-heading">
        <div>
          <span className="panel-icon"><Gauge size={17} aria-hidden="true" /></span>
          <h2 id="runtime-panel-title">執行狀態</h2>
        </div>
        <span className={`condition-chip ${conditionState}`}>
          {conditionState === 'waiting' && '等待判斷'}
          {conditionState === 'true' && <><Check size={14} aria-hidden="true" /> TRUE</>}
          {conditionState === 'false' && <><Circle size={12} aria-hidden="true" /> FALSE</>}
          {conditionState === 'blocked' && <><ShieldAlert size={14} aria-hidden="true" /> 已停止</>}
        </span>
      </div>

      <div className="condition-readout">
        <span>目前條件</span>
        <code>{frame.conditionExpression}</code>
      </div>

      <div className="variable-stage">
        <span className="variable-label">目前的 i</span>
        <AnimatePresence mode="popLayout">
          <motion.strong
            key={frame.currentValue}
            initial={{ opacity: 0, y: 16, scale: 0.82 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 330, damping: 24 }}
          >
            {frame.currentValue}
          </motion.strong>
        </AnimatePresence>
        <div className="number-line" aria-hidden="true">
          {nearbyValues.map((value) => (
            <span className={value === frame.currentValue ? 'current' : ''} key={value}>
              <i />{value}
            </span>
          ))}
        </div>
      </div>

      <div className="console-output">
        <div><Terminal size={14} aria-hidden="true" /><span>printf 輸出</span></div>
        <code>{frame.output.length > 0 ? frame.output.join(' ') : <i>尚無輸出</i>}</code>
      </div>
    </section>
  )
}

function getSavedLoopConfig(savedState: unknown): LoopConfig {
  if (!savedState || typeof savedState !== 'object') {
    return { ...DEFAULT_LOOP_CONFIG }
  }

  return { ...(savedState as LoopConfig) }
}

export function ForLoopLabPage() {
  const {
    progress,
    getLessonProgress,
    markGuidedRunCompleted,
    markChallengeCompleted,
    rememberLessonState,
    visitLesson,
    resetProgress,
  } = useLearningProgress()
  const lessonProgress = getLessonProgress('loops-for')
  const [config, setConfig] = useState<LoopConfig>(() => (
    getSavedLoopConfig(lessonProgress.savedState)
  ))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [activeChallengeId, setActiveChallengeId] = useState<ChallengeId>(() => (
    FOR_LOOP_CHALLENGES.find((challenge) => (
      !lessonProgress.completedChallengeIds.includes(challenge.id)
    ))?.id ?? FOR_LOOP_CHALLENGES[0].id
  ))
  const [feedback, setFeedback] = useState<ChallengeFeedback>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const clearTriggerRef = useRef<HTMLButtonElement>(null)
  const clearConfirmRef = useRef<HTMLButtonElement>(null)
  const clearCancelRef = useRef<HTMLButtonElement>(null)

  const simulation = useMemo(() => simulateForLoop(config), [config])
  const visiblePhaseOrder: LoopPhase[] = [
    ...workingPhaseOrder,
    simulation.status === 'blocked' ? 'blocked' : 'done',
  ]
  const sourceLines = useMemo(
    () => toSourceCodeLines(simulation.source),
    [simulation.source],
  )
  const player = useTracePlayer({
    frames: simulation.frames,
    speed,
    config,
  })
  const frame = player.frame ?? simulation.frames[0]
  const lessonCompleted = isForLoopLessonCompleted(progress)

  const lastCondition = useMemo(() => {
    for (let index = player.frameIndex; index >= 0; index -= 1) {
      const value = simulation.frames[index]?.conditionResult
      if (value !== null && value !== undefined) return value
    }
    return null
  }, [player.frameIndex, simulation.frames])

  const visibleTraceRows = useMemo(
    () => simulation.traceRows.filter((row) => {
      if (row.kind === 'blocked-check') return frame.phase === 'blocked'
      if (row.kind === 'exit-check') {
        return row.conditionFrameIndex <= player.frameIndex
      }
      return row.bodyFrameIndex !== null && row.bodyFrameIndex <= player.frameIndex
    }),
    [frame.phase, player.frameIndex, simulation.traceRows],
  )

  const challengeItems = useMemo<readonly ChallengePanelItem<ChallengeId>[]>(
    () => FOR_LOOP_CHALLENGES.map((challenge) => ({
      id: challenge.id,
      label: challenge.title,
      eyebrow: `CHALLENGE ${String(challenge.order).padStart(2, '0')}`,
      completed: lessonProgress.completedChallengeIds.includes(challenge.id),
    })),
    [lessonProgress.completedChallengeIds],
  )

  useEffect(() => {
    visitLesson('loops-for')
  }, [visitLesson])

  useEffect(() => {
    if (player.atEnd && frame.phase === 'done') {
      markGuidedRunCompleted('loops-for')
    }
  }, [frame.phase, markGuidedRunCompleted, player.atEnd])

  useEffect(() => {
    if (showClearConfirm) clearConfirmRef.current?.focus()
  }, [showClearConfirm])

  const changeConfig = <K extends keyof LoopConfig>(
    key: K,
    value: LoopConfig[K],
  ) => {
    const next = { ...config, [key]: value }
    setFeedback(null)
    setConfig(next)
    rememberLessonState('loops-for', next)
  }

  const restoreDefaults = () => {
    const next = { ...DEFAULT_LOOP_CONFIG }
    setConfig(next)
    setFeedback(null)
    rememberLessonState('loops-for', next)
  }

  const checkChallenge = () => {
    if (simulation.status === 'blocked') {
      setFeedback({
        kind: 'blocked',
        text: `這組參數無法安全完成：${simulation.message}`,
      })
      return
    }
    if (isChallengeSolved(activeChallengeId, simulation.output)) {
      markChallengeCompleted('loops-for', activeChallengeId)
      setFeedback({
        kind: 'success',
        text: '輸出完全正確！你找到一組可行的迴圈參數。',
      })
      return
    }
    setFeedback({
      kind: 'try-again',
      text: `目前輸出是「${simulation.output.join(' ') || '沒有輸出'}」，再比較一次目標序列。`,
    })
  }

  const closeClearConfirm = () => {
    setShowClearConfirm(false)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const handleClearDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeClearConfirm()
      return
    }

    if (event.key !== 'Tab') return
    const first = clearConfirmRef.current
    const last = clearCancelRef.current
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
    setConfig({ ...DEFAULT_LOOP_CONFIG })
    setFeedback(null)
    setShowClearConfirm(false)
    setActiveChallengeId(FOR_LOOP_CHALLENGES[0].id)
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus())
  }

  const activeChallenge = FOR_LOOP_CHALLENGES.find(
    (challenge) => challenge.id === activeChallengeId,
  ) ?? FOR_LOOP_CHALLENGES[0]
  const liveMessage = player.playing && frame.phase !== 'done' && frame.phase !== 'blocked'
    ? '正在自動播放迴圈執行軌跡。'
    : `${frame.explanation}，目前輸出 ${frame.output.join(' ') || '尚無輸出'}`

  const controls = (
    <details className="loop-controls-details" open>
      <summary className="controls-heading loop-controls-summary">
        <span><SlidersHorizontal size={18} aria-hidden="true" /></span>
        <div><small>CONTROL PANEL</small><h2>調整參數</h2></div>
        <span className="loop-controls-summary__hint" aria-hidden="true">
          展開／收合
        </span>
      </summary>
      <div className="controls-panel">
        <NumericControl
          id="start"
          label="起始值"
          hint="i 一開始是多少？"
          value={config.start}
          min={LOOP_LIMITS.start.min}
          max={LOOP_LIMITS.start.max}
          onChange={(value) => changeConfig('start', value)}
        />

        <div className="comparator-control">
          <div className="control-label-row">
            <label htmlFor="comparator"><span>比較方式</span><code>condition</code></label>
            <small>什麼情況繼續？</small>
          </div>
          <select
            id="comparator"
            value={config.comparator}
            onChange={(event) => (
              changeConfig('comparator', event.target.value as Comparator)
            )}
          >
            {COMPARATORS.map((comparator) => (
              <option key={comparator} value={comparator}>
                {comparator} — {comparatorDescriptions[comparator]}
              </option>
            ))}
          </select>
        </div>

        <NumericControl
          id="end"
          label="終止值"
          hint="拿 i 跟誰比較？"
          value={config.end}
          min={LOOP_LIMITS.end.min}
          max={LOOP_LIMITS.end.max}
          onChange={(value) => changeConfig('end', value)}
        />
        <NumericControl
          id="step"
          label="步進值"
          hint="每一輪改變多少？"
          value={config.step}
          min={LOOP_LIMITS.step.min}
          max={LOOP_LIMITS.step.max}
          onChange={(value) => changeConfig('step', value)}
        />

        <button type="button" className="restore-button" onClick={restoreDefaults}>
          <RotateCcw size={15} aria-hidden="true" /> 恢復預設參數
        </button>

        <div className="safety-note">
          <ShieldAlert size={17} aria-hidden="true" />
          <p><strong>安全模擬</strong>最多執行 {LOOP_LIMITS.maxIterations} 次，無窮迴圈會自動停止。</p>
        </div>
      </div>
    </details>
  )

  const playback = (
    <div className="playback-bar">
      <div className="phase-strip" aria-label="執行階段">
        {visiblePhaseOrder.map((phase, index) => (
          <div
            className={frame.phase === phase ? 'phase-item active' : 'phase-item'}
            key={phase}
            aria-current={frame.phase === phase ? 'step' : undefined}
          >
            <span>{index + 1}</span><small>{phaseLabels[phase]}</small>
          </div>
        ))}
      </div>
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
    </div>
  )

  return (
    <div className="lab-page">
      <section className="lab-hero">
        <div className="page-width">
          <div className="breadcrumbs">
            <Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" />
            <span>for 迴圈</span>
          </div>
          <div className="lab-title-row">
            <motion.div
              className="lab-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link className="back-link" to="/learn">
                <ArrowLeft size={16} aria-hidden="true" /> 回到課程地圖
              </Link>
              <span className="section-kicker">MODULE 03 · LESSON 01</span>
              <h1>看見 <em>for</em> 迴圈<br />一步一步執行。</h1>
              <p>調整四個參數，再用播放或單步控制，跟著電腦走過初始化、判斷、執行與更新。</p>
            </motion.div>
            <motion.div
              className={lessonCompleted
                ? 'lesson-status-card complete'
                : 'lesson-status-card'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div>
                {lessonCompleted
                  ? <Trophy size={21} aria-hidden="true" />
                  : <BookOpenCheck size={21} aria-hidden="true" />}
                <span>{lessonCompleted ? '單元完成' : '學習進度'}</span>
              </div>
              <strong>{lessonProgress.completedChallengeIds.length}<small>/3</small></strong>
              <p>{lessonCompleted ? '三個挑戰全部完成！' : '完成全部挑戰即可通過單元'}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="lab-workspace-section">
        <div className="page-width">
          <LabShell
            className="loop-lab-shell"
            controls={controls}
            controlsLabel="迴圈控制參數"
            playback={playback}
          >
            <div className="execution-area">
              {simulation.status === 'blocked' && frame.phase === 'blocked' && (
                <motion.div
                  className="blocked-banner"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                >
                  <ShieldAlert size={19} aria-hidden="true" />
                  <div>
                    <strong>已安全停止可能的無窮迴圈</strong>
                    <span>{simulation.message}</span>
                  </div>
                </motion.div>
              )}

              <div className="execution-grid">
                <SourceCodePanel
                  lines={sourceLines}
                  activeLine={frame.activeLine}
                  activePart={frame.activePart}
                  title={<><Terminal size={17} aria-hidden="true" /> C 程式碼</>}
                  status={(
                    <span className={`phase-badge phase-${frame.phase}`}>
                      {phaseLabels[frame.phase]}
                    </span>
                  )}
                  explanation={(
                    <>
                      <span className="explanation-step">
                        STEP {String(frame.index + 1).padStart(2, '0')}
                      </span>
                      <p>{frame.explanation}</p>
                    </>
                  )}
                  codeLabel={`C 程式碼，目前執行第 ${frame.activeLine} 行`}
                />
                <RuntimePanel frame={frame} lastCondition={lastCondition} />
              </div>

              <section className="lab-panel trace-panel" aria-labelledby="trace-panel-title">
                <div className="panel-heading">
                  <div>
                    <span className="panel-icon"><ListTree size={17} aria-hidden="true" /></span>
                    <h2 id="trace-panel-title">迭代追蹤表</h2>
                  </div>
                  <span className="row-count">{visibleTraceRows.length} ROWS</span>
                </div>
                <div className="trace-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>第幾輪</th>
                        <th>判斷前 i</th>
                        <th>條件結果</th>
                        <th>printf 輸出</th>
                        <th>更新後 i</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTraceRows.map((row) => {
                        const updateHasRun = row.incrementFrameIndex !== null && (
                          row.incrementFrameIndex <= player.frameIndex
                        )
                        return (
                          <tr key={`${row.kind}-${row.conditionFrameIndex}`} data-trace-kind={row.kind}>
                            <td>
                              {row.iteration === null
                                ? <span>{row.kind === 'exit-check' ? '離開' : '停止'}</span>
                                : <span className="iteration-number">{row.iteration}</span>}
                            </td>
                            <td><code>{row.conditionValue}</code></td>
                            <td>
                              <span className={row.conditionResult ? 'true-tag' : 'false-tag'}>
                                {row.conditionResult
                                  ? <Check size={12} aria-hidden="true" />
                                  : <Circle size={12} aria-hidden="true" />}
                                {row.conditionResult ? 'TRUE' : 'FALSE'}
                              </span>
                            </td>
                            <td><code>{row.printedValue ?? '—'}</code></td>
                            <td>
                              <code>
                                {row.kind === 'iteration' && !updateHasRun
                                  ? '尚未更新'
                                  : row.afterValue ?? '—'}
                              </code>
                            </td>
                          </tr>
                        )
                      })}
                      {visibleTraceRows.length === 0 && (
                        <tr className="empty-row">
                          <td colSpan={5}>
                            執行條件判斷後，這裡會記下每一輪與最後一次判斷。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </LabShell>
        </div>
      </section>

      <section className="challenge-section">
        <div className="page-width">
          <div className="challenge-heading">
            <div>
              <span className="section-kicker">PUT IT INTO PRACTICE</span>
              <h2>用三個挑戰，確認你真的看懂了。</h2>
            </div>
            <p>不用找到唯一的參數組合。只要程式實際輸出與目標完全相同，就算挑戰成功。</p>
          </div>

          <ChallengePanel
            className="loop-challenge-panel"
            challenges={challengeItems}
            activeId={activeChallengeId}
            onSelect={(id) => {
              setActiveChallengeId(id)
              setFeedback(null)
            }}
            label="for 迴圈挑戰"
            orientation="vertical"
            renderTab={(challenge) => {
              const definition = FOR_LOOP_CHALLENGES.find(
                (item) => item.id === challenge.id,
              )!
              return (
                <>
                  <span className={challenge.completed ? 'challenge-check done' : 'challenge-check'}>
                    {challenge.completed
                      ? <Check size={16} aria-hidden="true" />
                      : definition.order}
                  </span>
                  <span>
                    <small>CHALLENGE {String(definition.order).padStart(2, '0')}</small>
                    <strong>{definition.title}</strong>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </>
              )
            }}
          >
            {() => (
              <motion.div
                className="challenge-card"
                key={activeChallenge.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="challenge-card-top">
                  <span><Sparkles size={17} aria-hidden="true" /> 目標輸出</span>
                  {lessonProgress.completedChallengeIds.includes(activeChallenge.id) && (
                    <span className="completed-stamp">
                      <CheckCircle2 size={15} aria-hidden="true" /> 已完成
                    </span>
                  )}
                </div>
                <h3>{activeChallenge.description}</h3>
                <div
                  className="target-output"
                  aria-label={`目標輸出：${activeChallenge.targetOutput.join(' ')}`}
                >
                  {activeChallenge.targetOutput.map((value, index) => (
                    <span key={`${value}-${index}`}>{value}</span>
                  ))}
                </div>
                <div className="current-output-compare">
                  <span>你目前的完整輸出</span>
                  <code>
                    {simulation.status === 'blocked'
                      ? '無法完成執行'
                      : simulation.output.join(' ') || '（沒有輸出）'}
                  </code>
                </div>
                <AnimatePresence mode="wait">
                  {feedback && (
                    <motion.div
                      className={`challenge-feedback ${feedback.kind}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      role="status"
                    >
                      {feedback.kind === 'success'
                        ? <CheckCircle2 size={18} aria-hidden="true" />
                        : feedback.kind === 'blocked'
                          ? <ShieldAlert size={18} aria-hidden="true" />
                          : <Info size={18} aria-hidden="true" />}
                      <span>{feedback.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  className="button button-primary check-answer-button"
                  onClick={checkChallenge}
                >
                  檢查這組輸出 <ArrowLeft className="check-arrow" size={17} aria-hidden="true" />
                </button>
              </motion.div>
            )}
          </ChallengePanel>

          {lessonCompleted && (
            <motion.div
              className="completion-banner"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span><Trophy size={25} aria-hidden="true" /></span>
              <div>
                <small>LESSON COMPLETE</small>
                <h2>做得很好，你已完成 for 迴圈單元！</h2>
                <p>你已能控制起點、條件與步進方向，並預測迴圈會產生的輸出。</p>
              </div>
              <Link className="button button-light" to="/learn">
                回到課程地圖 <ChevronRight size={17} aria-hidden="true" />
              </Link>
            </motion.div>
          )}

          <div className="progress-management">
            {!showClearConfirm ? (
              <button
                type="button"
                ref={clearTriggerRef}
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 size={15} aria-hidden="true" /> 清除這台裝置的學習進度
              </button>
            ) : (
              <div
                className="clear-confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="clear-progress-prompt"
                onKeyDown={handleClearDialogKeyDown}
              >
                <span id="clear-progress-prompt">
                  確定要清除所有挑戰與參數紀錄嗎？這個動作無法復原。
                </span>
                <button type="button" ref={clearConfirmRef} onClick={clearAllProgress}>
                  確定清除
                </button>
                <button type="button" ref={clearCancelRef} onClick={closeClearConfirm}>
                  取消
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">{liveMessage}</p>
    </div>
  )
}
