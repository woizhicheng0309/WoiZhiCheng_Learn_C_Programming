import { useEffect, useMemo, useState } from 'react'
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
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  StepForward,
  Terminal,
  Trash2,
  Trophy,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  COMPARATORS,
  DEFAULT_LOOP_CONFIG,
  LOOP_LIMITS,
  simulateForLoop,
  type Comparator,
  type LoopConfig,
  type LoopFrame,
  type LoopPhase,
} from '../domain'
import {
  FOR_LOOP_CHALLENGES,
  isChallengeSolved,
  type ChallengeId,
} from '../data'
import { isForLoopLessonCompleted } from '../state'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { NestedLoopLab } from '../components/NestedLoopLab'

const phaseLabels: Record<LoopPhase, string> = {
  init: '初始化',
  condition: '檢查條件',
  body: '執行內容',
  increment: '更新 i',
  done: '完成',
  blocked: '安全停止',
}

const phaseOrder: LoopPhase[] = ['init', 'condition', 'body', 'increment', 'done']

const comparatorDescriptions: Record<Comparator, string> = {
  '<': '小於',
  '<=': '小於或等於',
  '>': '大於',
  '>=': '大於或等於',
}

const speedOptions = [
  { value: 0.5, label: '0.5×', delay: 1300 },
  { value: 1, label: '1×', delay: 760 },
  { value: 2, label: '2×', delay: 380 },
] as const

type Speed = (typeof speedOptions)[number]['value']
type ChallengeFeedback = { kind: 'success' | 'try-again' | 'blocked'; text: string } | null

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

function CodePanel({ frame, source }: { frame: LoopFrame; source: ReturnType<typeof simulateForLoop>['source'] }) {
  return (
    <section className="lab-panel code-panel" aria-labelledby="code-panel-title">
      <div className="panel-heading">
        <div>
          <span className="panel-icon"><Terminal size={17} aria-hidden="true" /></span>
          <h2 id="code-panel-title">C 程式碼</h2>
        </div>
        <span className={`phase-badge phase-${frame.phase}`}>{phaseLabels[frame.phase]}</span>
      </div>
      <div className="code-editor" aria-label={`C 程式碼，目前執行第 ${frame.activeLine} 行`}>
        {source.lines.map((line) => {
          const active = line.lineNumber === frame.activeLine
          return (
            <motion.div
              className={active ? 'source-line active' : 'source-line'}
              key={line.lineNumber}
              animate={{ backgroundColor: active ? 'rgba(214, 107, 74, 0.14)' : 'rgba(0,0,0,0)' }}
            >
              <span className="source-line-number">{line.lineNumber}</span>
              <code>{line.code || ' '}</code>
              {active && <motion.span layoutId="active-code-marker" className="active-code-marker" />}
            </motion.div>
          )
        })}
      </div>
      <div className="code-explanation">
        <span className="explanation-step">STEP {String(frame.index + 1).padStart(2, '0')}</span>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${frame.index}-${frame.explanation}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {frame.explanation}
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  )
}

function RuntimePanel({ frame, lastCondition }: { frame: LoopFrame; lastCondition: boolean | null }) {
  const nearbyValues = Array.from({ length: 5 }, (_, index) => frame.currentValue + index - 2)
  const conditionState = frame.phase === 'blocked'
    ? 'blocked'
    : lastCondition === null ? 'waiting' : lastCondition ? 'true' : 'false'

  return (
    <section className="lab-panel runtime-panel" aria-labelledby="runtime-panel-title">
      <div className="panel-heading">
        <div>
          <span className="panel-icon"><Gauge size={17} aria-hidden="true" /></span>
          <h2 id="runtime-panel-title">執行狀態</h2>
        </div>
        <span className={`condition-chip ${conditionState}`}>
          {conditionState === 'waiting' && '等待判斷'}
          {conditionState === 'true' && <><Check size={14} /> TRUE</>}
          {conditionState === 'false' && <><Circle size={12} /> FALSE</>}
          {conditionState === 'blocked' && <><ShieldAlert size={14} /> 已停止</>}
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

export function ForLoopLabPage() {
  const {
    progress,
    markGuidedRunCompleted,
    markChallengeCompleted,
    rememberConfig,
    resetProgress,
  } = useLearningProgress()
  const [config, setConfig] = useState<LoopConfig>(() => ({ ...progress.lastConfig }))
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [activeChallengeId, setActiveChallengeId] = useState<ChallengeId>(() => (
    FOR_LOOP_CHALLENGES.find((challenge) => !progress.completedChallengeIds.includes(challenge.id))?.id
      ?? FOR_LOOP_CHALLENGES[0].id
  ))
  const [feedback, setFeedback] = useState<ChallengeFeedback>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const simulation = useMemo(() => simulateForLoop(config), [config])
  const boundedIndex = Math.min(frameIndex, simulation.frames.length - 1)
  const frame = simulation.frames[boundedIndex]
  const atEnd = boundedIndex >= simulation.frames.length - 1
  const selectedChallenge = FOR_LOOP_CHALLENGES.find((challenge) => challenge.id === activeChallengeId)!
  const lessonCompleted = isForLoopLessonCompleted(progress)

  const lastCondition = useMemo(() => {
    for (let index = boundedIndex; index >= 0; index -= 1) {
      const value = simulation.frames[index].conditionResult
      if (value !== null) return value
    }
    return null
  }, [boundedIndex, simulation.frames])

  const traceRows = useMemo(
    () => simulation.frames.slice(0, boundedIndex + 1).filter((item) => item.phase === 'body'),
    [boundedIndex, simulation.frames],
  )

  useEffect(() => {
    if (!playing) return
    if (atEnd) return
    const delay = speedOptions.find((option) => option.value === speed)?.delay ?? 760
    const nextIndex = Math.min(boundedIndex + 1, simulation.frames.length - 1)
    const timer = window.setTimeout(() => {
      setFrameIndex(nextIndex)
      if (nextIndex >= simulation.frames.length - 1) setPlaying(false)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [atEnd, playing, speed, boundedIndex, simulation.frames.length])

  useEffect(() => {
    if (atEnd && frame.phase === 'done') markGuidedRunCompleted()
  }, [atEnd, frame.phase, markGuidedRunCompleted])

  const changeConfig = <K extends keyof LoopConfig>(key: K, value: LoopConfig[K]) => {
    const next = { ...config, [key]: value }
    setPlaying(false)
    setFrameIndex(0)
    setFeedback(null)
    setConfig(next)
    rememberConfig(next)
  }

  const restartTrace = () => {
    setPlaying(false)
    setFrameIndex(0)
  }

  const restoreDefaults = () => {
    const next = { ...DEFAULT_LOOP_CONFIG }
    setConfig(next)
    setFrameIndex(0)
    setPlaying(false)
    setFeedback(null)
    rememberConfig(next)
  }

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (atEnd) setFrameIndex(0)
    setPlaying(true)
  }

  const nextFrame = () => {
    setPlaying(false)
    setFrameIndex((current) => Math.min(current + 1, simulation.frames.length - 1))
  }

  const checkChallenge = () => {
    if (simulation.status === 'blocked') {
      setFeedback({ kind: 'blocked', text: `這組參數無法安全完成：${simulation.message}` })
      return
    }
    if (isChallengeSolved(activeChallengeId, simulation.output)) {
      markChallengeCompleted(activeChallengeId)
      setFeedback({ kind: 'success', text: '輸出完全正確！你找到一組可行的迴圈參數。' })
      return
    }
    setFeedback({
      kind: 'try-again',
      text: `目前輸出是「${simulation.output.join(' ') || '沒有輸出'}」，再比較一次目標序列。`,
    })
  }

  const clearAllProgress = () => {
    const fresh = resetProgress()
    setConfig({ ...fresh.lastConfig })
    setFrameIndex(0)
    setPlaying(false)
    setFeedback(null)
    setShowClearConfirm(false)
    setActiveChallengeId(FOR_LOOP_CHALLENGES[0].id)
  }

  const visiblePhase = frame.phase === 'blocked' ? 'done' : frame.phase

  return (
    <div className="lab-page">
      <section className="lab-hero">
        <div className="page-width">
          <div className="breadcrumbs">
            <Link to="/">首頁</Link><ChevronRight size={14} />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} />
            <span>for 迴圈</span>
          </div>
          <div className="lab-title-row">
            <motion.div
              className="lab-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link className="back-link" to="/learn"><ArrowLeft size={16} /> 回到課程地圖</Link>
              <span className="section-kicker">LESSON 03 · LOOPS</span>
              <h1>看見 <em>for</em> 迴圈<br />一步一步執行。</h1>
              <p>先調整參數看懂單層 for，再用可變尺寸的乘法表，觀察兩層迴圈如何一起執行。</p>
            </motion.div>
            <motion.div
              className={lessonCompleted ? 'lesson-status-card complete' : 'lesson-status-card'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div>
                {lessonCompleted ? <Trophy size={21} /> : <BookOpenCheck size={21} />}
                <span>{lessonCompleted ? '單元完成' : '學習進度'}</span>
              </div>
              <strong>{progress.completedChallengeIds.length}<small>/3</small></strong>
              <p>{lessonCompleted ? '三個挑戰全部完成！' : '完成全部挑戰即可通過單元'}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="lab-workspace-section">
        <div className="page-width lab-workspace">
          <aside className="controls-panel" aria-label="迴圈控制參數">
            <div className="controls-heading">
              <span><SlidersHorizontal size={18} /></span>
              <div><small>CONTROL PANEL</small><h2>調整參數</h2></div>
            </div>
            <NumericControl id="start" label="起始值" hint="i 一開始是多少？" value={config.start} min={LOOP_LIMITS.start.min} max={LOOP_LIMITS.start.max} onChange={(value) => changeConfig('start', value)} />

            <div className="comparator-control">
              <div className="control-label-row">
                <label htmlFor="comparator"><span>比較方式</span><code>condition</code></label>
                <small>什麼情況繼續？</small>
              </div>
              <select id="comparator" value={config.comparator} onChange={(event) => changeConfig('comparator', event.target.value as Comparator)}>
                {COMPARATORS.map((comparator) => (
                  <option key={comparator} value={comparator}>{comparator} — {comparatorDescriptions[comparator]}</option>
                ))}
              </select>
            </div>

            <NumericControl id="end" label="終止值" hint="拿 i 跟誰比較？" value={config.end} min={LOOP_LIMITS.end.min} max={LOOP_LIMITS.end.max} onChange={(value) => changeConfig('end', value)} />
            <NumericControl id="step" label="步進值" hint="每一輪改變多少？" value={config.step} min={LOOP_LIMITS.step.min} max={LOOP_LIMITS.step.max} onChange={(value) => changeConfig('step', value)} />

            <button type="button" className="restore-button" onClick={restoreDefaults}><RotateCcw size={15} /> 恢復預設參數</button>

            <div className="safety-note">
              <ShieldAlert size={17} aria-hidden="true" />
              <p><strong>安全模擬</strong>最多執行 {LOOP_LIMITS.maxIterations} 次，無窮迴圈會自動停止。</p>
            </div>
          </aside>

          <div className="execution-area">
            <div className="playback-bar">
              <div className="phase-strip" aria-label="執行階段">
                {phaseOrder.map((phase, index) => (
                  <div className={visiblePhase === phase ? 'phase-item active' : 'phase-item'} key={phase} aria-current={visiblePhase === phase ? 'step' : undefined}>
                    <span>{index + 1}</span><small>{phaseLabels[phase]}</small>
                  </div>
                ))}
              </div>
              <div className="playback-controls">
                <button type="button" onClick={restartTrace} aria-label="回到第一步"><RotateCcw size={18} /></button>
                <button type="button" className="play-button" onClick={togglePlayback} aria-label={playing ? '暫停播放' : '開始播放'}>
                  {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
                </button>
                <button type="button" onClick={nextFrame} disabled={atEnd} aria-label="執行下一步"><StepForward size={18} /></button>
                <div className="speed-control" aria-label="播放速度">
                  {speedOptions.map((option) => (
                    <button type="button" className={speed === option.value ? 'active' : ''} key={option.value} onClick={() => setSpeed(option.value)}>{option.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {simulation.status === 'blocked' && frame.phase === 'blocked' && (
              <motion.div className="blocked-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="alert">
                <ShieldAlert size={19} />
                <div><strong>已安全停止可能的無窮迴圈</strong><span>{simulation.message}</span></div>
              </motion.div>
            )}

            <div className="execution-grid">
              <CodePanel frame={frame} source={simulation.source} />
              <RuntimePanel frame={frame} lastCondition={lastCondition} />
            </div>

            <section className="lab-panel trace-panel" aria-labelledby="trace-panel-title">
              <div className="panel-heading">
                <div><span className="panel-icon"><ListTree size={17} /></span><h2 id="trace-panel-title">迭代追蹤表</h2></div>
                <span className="row-count">{traceRows.length} ROWS</span>
              </div>
              <div className="trace-scroll">
                <table>
                  <thead><tr><th>第幾輪</th><th>判斷前 i</th><th>條件結果</th><th>printf 輸出</th><th>更新後 i</th></tr></thead>
                  <tbody>
                    {traceRows.map((row) => (
                      <tr key={row.index}>
                        <td><span className="iteration-number">{row.iteration}</span></td>
                        <td><code>{row.currentValue}</code></td>
                        <td><span className="true-tag"><Check size={12} /> TRUE</span></td>
                        <td><code>{row.currentValue}</code></td>
                        <td><code>{row.currentValue + config.step}</code></td>
                      </tr>
                    ))}
                    {traceRows.length === 0 && (
                      <tr className="empty-row"><td colSpan={5}>{frame.phase === 'done' ? '條件一開始就是 false，所以迴圈執行 0 次。' : '執行到迴圈內容後，這裡會記下每一輪的變化。'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </section>

      <NestedLoopLab />

      <section className="challenge-section">
        <div className="page-width">
          <div className="challenge-heading">
            <div><span className="section-kicker">PUT IT INTO PRACTICE</span><h2>用三個挑戰，確認你真的看懂了。</h2></div>
            <p>不用找到唯一的參數組合。只要程式實際輸出與目標完全相同，就算挑戰成功。</p>
          </div>

          <div className="challenge-layout">
            <div className="challenge-list" role="tablist" aria-label="for 迴圈挑戰">
              {FOR_LOOP_CHALLENGES.map((challenge) => {
                const completed = progress.completedChallengeIds.includes(challenge.id)
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeChallengeId === challenge.id}
                    className={activeChallengeId === challenge.id ? 'challenge-tab active' : 'challenge-tab'}
                    key={challenge.id}
                    onClick={() => { setActiveChallengeId(challenge.id); setFeedback(null) }}
                  >
                    <span className={completed ? 'challenge-check done' : 'challenge-check'}>
                      {completed ? <Check size={16} /> : challenge.order}
                    </span>
                    <span><small>CHALLENGE {String(challenge.order).padStart(2, '0')}</small><strong>{challenge.title}</strong></span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                )
              })}
            </div>

            <motion.div className="challenge-card" key={selectedChallenge.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} role="tabpanel">
              <div className="challenge-card-top">
                <span><Sparkles size={17} /> 目標輸出</span>
                {progress.completedChallengeIds.includes(selectedChallenge.id) && <span className="completed-stamp"><CheckCircle2 size={15} /> 已完成</span>}
              </div>
              <h3>{selectedChallenge.description}</h3>
              <div className="target-output" aria-label={`目標輸出：${selectedChallenge.targetOutput.join(' ')}`}>
                {selectedChallenge.targetOutput.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}
              </div>
              <div className="current-output-compare">
                <span>你目前的完整輸出</span>
                <code>{simulation.status === 'blocked' ? '無法完成執行' : simulation.output.join(' ') || '（沒有輸出）'}</code>
              </div>
              <AnimatePresence mode="wait">
                {feedback && (
                  <motion.div className={`challenge-feedback ${feedback.kind}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status">
                    {feedback.kind === 'success' ? <CheckCircle2 size={18} /> : feedback.kind === 'blocked' ? <ShieldAlert size={18} /> : <Info size={18} />}
                    <span>{feedback.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <button type="button" className="button button-primary check-answer-button" onClick={checkChallenge}>
                檢查這組輸出 <ArrowLeft className="check-arrow" size={17} />
              </button>
            </motion.div>
          </div>

          {lessonCompleted && (
            <motion.div className="completion-banner" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <span><Trophy size={25} /></span>
              <div><small>LESSON COMPLETE</small><h2>做得很好，你已完成 for 迴圈單元！</h2><p>你已能控制起點、條件與步進方向，並預測迴圈會產生的輸出。</p></div>
              <Link className="button button-light" to="/learn">回到課程地圖 <ChevronRight size={17} /></Link>
            </motion.div>
          )}

          <div className="progress-management">
            {!showClearConfirm ? (
              <button type="button" onClick={() => setShowClearConfirm(true)}><Trash2 size={15} /> 清除這台裝置的學習進度</button>
            ) : (
              <div className="clear-confirm" role="alert">
                <span>確定要清除所有單元、挑戰與參數紀錄嗎？這個動作無法復原。</span>
                <button type="button" onClick={clearAllProgress}>確定清除</button>
                <button type="button" onClick={() => setShowClearConfirm(false)}>取消</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">{frame.explanation}，目前輸出 {frame.output.join(' ') || '尚無輸出'}</p>
    </div>
  )
}
