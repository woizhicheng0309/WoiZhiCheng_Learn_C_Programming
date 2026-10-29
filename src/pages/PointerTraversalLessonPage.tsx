import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Code2, Footprints, ShieldAlert, Terminal, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import {
  DEFAULT_TRAVERSAL_CONFIG, TRAVERSAL_LIMITS, TRAVERSAL_VALUES, simulateTraversalProgram, validateTraversalConfig,
  type TraversalConfig, type TraversalFrame, type TraversalPhase,
} from '../domain/traversal'
import {
  TRAVERSAL_CHALLENGES, evaluateOnePast, evaluateTraversalOffset, evaluateTraversalStep,
  type TraversalChallengeId,
} from '../data/traversalChallenges'

const LESSON_ID = 'pointers-traversal' as const
type Feedback = { solved: boolean; message: string }
const phaseLabels: Record<TraversalPhase, string> = {
  'enter-main': '進入 main', 'initialize-array': '建立陣列', 'bind-pointer': '指向第一格',
  'init-index': '建立 i', condition: '檢查迴圈條件', 'read-element': '讀取並輸出',
  'advance-pointer': '指標向前一格', 'increment-index': '遞增 i', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}

function readConfig(value: unknown): TraversalConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_TRAVERSAL_CONFIG }
  const candidate = value as TraversalConfig
  return validateTraversalConfig(candidate).length === 0 ? { count: candidate.count, mode: candidate.mode } : { ...DEFAULT_TRAVERSAL_CONFIG }
}

function CountControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== String(value)) inputRef.current.value = String(value)
  }, [value])
  return <div className="functions-number-control">
    <div className="functions-control-label"><label htmlFor="traversal-count">要讀取的元素數量 count</label><small>0 到 5 可完成；6 用來觀察越界停止</small></div>
    <input ref={inputRef} id="traversal-count" type="number" step={1} min={TRAVERSAL_LIMITS.min} max={TRAVERSAL_LIMITS.max} defaultValue={value}
      onChange={(event) => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) onChange(Number(event.target.value)) }}
      onBlur={(event) => { event.currentTarget.value = String(value) }} />
  </div>
}

function TraversalMemory({ frame, config }: { frame: TraversalFrame; config: TraversalConfig }) {
  const memory = frame.memory
  const stripRef = useRef<HTMLDivElement>(null)
  const pointerExists = memory.pointerIndex !== null
  const iValue = memory.i === null ? '尚未宣告' : !memory.inScope ? '離開作用域' : !memory.indexInScope ? '離開迴圈作用域' : String(memory.i)
  const pointerValue = !pointerExists ? '尚未宣告' : !memory.inScope ? '離開作用域' : `scores + ${memory.pointerIndex}`
  const atBoundary = memory.inScope && (memory.pointerIndex === 5 || (config.mode === 'index' && memory.indexInScope && memory.i === 5))
  const activePosition = !memory.inScope ? null : config.mode === 'pointer' ? memory.pointerIndex : memory.indexInScope ? memory.i : null
  const startingFrame = frame.phase === 'enter-main' ? frame : null
  useEffect(() => {
    const revealPosition = () => {
      const strip = stripRef.current
      if (!strip) return
      if (startingFrame) { strip.scrollLeft = 0; return }
      if (activePosition === null) return
      const cell = strip.querySelector<HTMLElement>(`[data-position="${activePosition}"]`)
      if (!cell) return
      const stripBounds = strip.getBoundingClientRect()
      const cellBounds = cell.getBoundingClientRect()
      const left = stripBounds.left + strip.clientLeft + 3
      const right = stripBounds.left + strip.clientLeft + strip.clientWidth - 3
      // Only move this horizontal strip; keep the document's scroll position.
      if (cellBounds.left < left) strip.scrollLeft -= left - cellBounds.left
      else if (cellBounds.right > right) strip.scrollLeft += cellBounds.right - right
    }
    revealPosition()
    window.addEventListener('resize', revealPosition)
    return () => window.removeEventListener('resize', revealPosition)
  }, [activePosition, startingFrame])
  return <section className="traversal-memory lab-panel" aria-labelledby="traversal-memory-title">
    <div className="pointers-panel-heading"><small>ONE ELEMENT AT A TIME</small><h2 id="traversal-memory-title">沿著陣列，逐格讀取。</h2></div>
    <p className="pointers-address-note">{config.mode === 'pointer' ? 'scores 在這個運算式中轉換為第一個元素的指標；陣列本身不是指標。p + 1 向前一個元素，也就是 sizeof(*p) bytes；int 的實際大小依環境而異。' : 'scores[i] 用索引選取元素。五個元素的合法索引是 0 到 4，索引 5 不可讀取。'}</p>
    <div ref={stripRef} className="traversal-strip-scroll" tabIndex={0} aria-label="scores 五個元素與尾後位置；窄螢幕可水平捲動">
      <div className="traversal-strip" role="list" aria-label="scores 的五個元素">
        {TRAVERSAL_VALUES.map((_, index) => {
          const reading = frame.phase === 'read-element' && frame.highlightedIndex === index && memory.inScope
          const targeted = frame.highlightedIndex === index && memory.inScope
          const pointed = config.mode === 'pointer' && memory.pointerIndex === index && memory.inScope
          const value = !memory.scores ? '尚未建立' : !memory.inScope ? '離開作用域' : String(memory.scores[index])
          return <div className={`traversal-cell${reading ? ' is-reading' : ''}${pointed || targeted ? ' is-pointed' : ''}`} key={index} role="listitem" data-position={index}
            aria-label={`scores[${index}]，${value}${reading ? '，目前讀取' : pointed ? '，p 指向這格' : targeted ? '，定位' : ''}`}>
            <span>{reading ? '讀取' : pointed ? 'p 在這裡' : targeted ? '定位' : 'int'}</span><strong>{memory.scores && memory.inScope ? memory.scores[index] : '—'}</strong><code>[{index}]</code>
          </div>
        })}
        <div className={`traversal-one-past${atBoundary ? ' is-pointed' : ''}`} data-position={5} aria-label="scores + 5，尾後位置，不是陣列元素，不可解參照">
          <span>尾後位置</span><strong>—</strong><code>+ 5</code><small>不可解參照</small>
        </div>
      </div>
    </div>
    <div className="traversal-state-grid">
      <div aria-label={`迴圈變數 i，${iValue}`}><small>迴圈變數</small><code>i</code><strong>{iValue}</strong></div>
      <div aria-label={`條件 i 小於 ${config.count}，${frame.conditionResult === null ? '本步未判斷' : frame.conditionResult ? 'true' : 'false'}`}>
        <small>迴圈條件</small><code>i &lt; {config.count}</code><strong>{frame.conditionResult === null ? '—' : frame.conditionResult ? 'true' : 'false'}</strong>
      </div>
    </div>
    {config.mode === 'pointer' && <div className={`traversal-pointer${memory.pointerIndex === 5 && memory.inScope ? ' is-one-past' : ''}`} aria-label={`指標 p，${pointerValue}`}>
      <Footprints size={20} aria-hidden="true" /><div><small>{!memory.inScope ? 'p 已離開作用域' : memory.pointerIndex === 5 ? 'p 保存尾後位置的位址' : 'p 保存目前元素的位址'}</small><code>{pointerValue}</code></div>
    </div>}
    <div className="pointers-console" aria-label="走訪程式輸出"><span><Terminal size={16} aria-hidden="true" /> 累積 printf 輸出</span><code>{frame.outputText || (frame.phase === 'done' ? '（無輸出）' : '尚無輸出')}</code></div>
  </section>
}

export function PointerTraversalLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lessonProgress.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lessonProgress.guidedRunCompleted || readConfig(lessonProgress.savedState).count === 6)
  const [prediction, setPrediction] = useState('')
  const [submittedPrediction, setSubmittedPrediction] = useState<readonly number[] | null>(null)
  const [predictionError, setPredictionError] = useState('')
  const [activeChallenge, setActiveChallenge] = useState<TraversalChallengeId>(() => TRAVERSAL_CHALLENGES.find((challenge) => !lessonProgress.completedChallengeIds.includes(challenge.id))?.id ?? TRAVERSAL_CHALLENGES[0].id)
  const [offsetAnswer, setOffsetAnswer] = useState('')
  const [stepAnswer, setStepAnswer] = useState<'one-element' | 'one-byte' | null>(null)
  const [onePastAnswer, setOnePastAnswer] = useState<'form-only' | 'dereference' | null>(null)
  const [feedback, setFeedback] = useState<Partial<Record<TraversalChallengeId, Feedback>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const syncRef = useRef({ savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId })
  const resettingProgressRef = useRef(false)
  const simulation = useMemo(() => simulateTraversalProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = useMemo(() => simulation.source.lines.map((line) => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] })), [simulation.source])
  const completedCount = TRAVERSAL_CHALLENGES.filter((challenge) => lessonProgress.completedChallengeIds.includes(challenge.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = syncRef.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    syncRef.current = { savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId }
    resettingProgressRef.current = previous.savedKey !== savedKey || cleared
    const savedConfig = readConfig(JSON.parse(savedKey))
    if (resettingProgressRef.current) {
      setConfig(savedConfig)
      setPrediction('')
      setSubmittedPrediction(null)
      setPredictionError('')
      setUnlocked(lessonProgress.guidedRunCompleted || savedConfig.count === 6)
      if (cleared) { resetPlayer(); setFeedback({}); setActiveChallenge(TRAVERSAL_CHALLENGES[0].id) }
    } else if (previous.guided !== lessonProgress.guidedRunCompleted) setUnlocked(lessonProgress.guidedRunCompleted || savedConfig.count === 6)
  }, [savedKey, lessonProgress.guidedRunCompleted, hasLesson, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resettingProgressRef.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: TraversalConfig) => {
    setConfig(next)
    setPrediction('')
    setSubmittedPrediction(null)
    setPredictionError('')
    const valid = validateTraversalConfig(next).length === 0
    setUnlocked(lessonProgress.guidedRunCompleted || next.count === 6 || !valid)
    if (valid) { syncRef.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const submitPrediction = (event: FormEvent) => {
    event.preventDefault()
    const text = prediction.trim()
    if ((!text && config.count !== 0) || (text && !/^[+-]?\d+(?:\s+[+-]?\d+)*$/.test(text))) {
      setPredictionError('請以空白分隔整數；count 為 0 時可留空，代表沒有輸出。'); return
    }
    const values = text ? text.split(/\s+/).map(Number) : []
    if (values.some((value) => !Number.isFinite(value) || !Number.isInteger(value))) { setPredictionError('請輸入有限整數。'); return }
    setPredictionError('')
    setSubmittedPrediction(values)
    setUnlocked(true)
    player.reset()
  }
  const completeChallenge = (id: TraversalChallengeId, evaluation: Feedback) => {
    setFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) markChallengeCompleted(LESSON_ID, id)
  }
  const controls = <div className="pointers-controls traversal-controls"><h2>換一種方式，走過同一排資料。</h2>
    <fieldset><legend>走訪方式</legend>
      <label><input type="radio" name="traversal-mode" checked={config.mode === 'pointer'} onChange={() => changeConfig({ ...config, mode: 'pointer' })} />指標走訪：*p 與 p++</label>
      <label><input type="radio" name="traversal-mode" checked={config.mode === 'index'} onChange={() => changeConfig({ ...config, mode: 'index' })} />索引走訪：scores[i]</label>
    </fieldset><CountControl value={config.count} onChange={(count) => changeConfig({ ...config, count })} />
    <button className="functions-restore-button" type="button" onClick={() => changeConfig({ ...DEFAULT_TRAVERSAL_CONFIG })}>恢復預設值</button>
    <p className="traversal-safety-note">固定陣列共有 5 格。count = 6 由模擬器在第六次讀取前停止。這是模擬器的保護；真實 C 的越界解參照屬於未定義行為，語言本身不提供自動邊界檢查。</p>
  </div>
  const challengeItems = TRAVERSAL_CHALLENGES.map((challenge, index) => ({ id: challenge.id, label: challenge.title, eyebrow: `CHALLENGE 0${index + 1}`, completed: lessonProgress.completedChallengeIds.includes(challenge.id) }))
  const atTerminal = frame.phase === 'done' || frame.phase === 'blocked'

  return <div className="traversal-page pointers-page functions-page lab-page">
    <section className="traversal-hero pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" /><span>陣列與指標走訪</span></nav>
      <div className="functions-hero__layout"><div className="functions-hero__copy"><Link className="back-link" to="/learn"><ArrowLeft size={16} aria-hidden="true" />回到課程地圖</Link><span className="section-kicker">MODULE 06 · LESSON 03</span>
        <h1>同一排資料，<br />讓指標帶你走一遍。</h1><p>從 scores[i] 到 *p，追蹤每次讀取與 p++，分清楚最後一格與尾後位置。</p>
      </div><aside className={`lesson-status-card${completedCount === 3 ? ' complete' : ''}`} aria-label="本單元學習進度"><div><Trophy size={21} aria-hidden="true" /><span>{completedCount === 3 ? '單元完成' : '學習進度'}</span></div><strong>{completedCount}<small>/3</small></strong><p>通過三題即可完成這個單元</p></aside></div>
    </div></section>
    <section className="functions-overview page-width" aria-labelledby="traversal-goals-title"><div className="functions-objectives"><span className="section-kicker">LEARNING GOALS</span><h2 id="traversal-goals-title">移動一格，讀對一格。</h2>
      <ul><li><Check size={17} aria-hidden="true" />比較索引與指標如何讀取同一元素。</li><li><Check size={17} aria-hidden="true" />理解 p++ 前進一個元素，而非固定一個 byte。</li><li><Check size={17} aria-hidden="true" />辨識尾後指標可以形成，卻不可解參照。</li></ul>
    </div><div className="functions-concepts">
      <article><span><Code2 size={20} aria-hidden="true" /></span><small>01 · 指向起點</small><h3>陣列不等於指標</h3><p><code>int *p = scores;</code> 這裡 scores 轉換為第一個元素的指標，讓 p 從索引 0 開始。</p></article>
      <article><span><Footprints size={20} aria-hidden="true" /></span><small>02 · 前進一格</small><h3>以元素為單位移動</h3><p><code>p++</code> 跨過一個 int 元素。<code>*(p + 2)</code> 則讀取往後兩個元素的位置。</p></article>
      <article><span><ShieldAlert size={20} aria-hidden="true" /></span><small>03 · 尾後邊界</small><h3>可以到達，不能讀取</h3><p><code>scores + 5</code> 是五格陣列的尾後位置；它不是第六個可讀取的元素。</p></article>
    </div></section>
    <section className="functions-prediction-section" aria-labelledby="traversal-prediction-title"><div className="page-width functions-prediction-card">
      <div className="functions-prediction-card__copy"><span className="section-kicker">PREDICT BEFORE RUN</span><h2 id="traversal-prediction-title">走過 {config.count} 格，會輸出什麼？</h2><p>{config.count === 6 ? '這次要求超過陣列長度，直接觀察安全停止。越界讀取沒有可預測的完整結果。' : `陣列是 {${TRAVERSAL_VALUES.join(', ')}}。用空白分隔預測值；count = 0 時留空並提交，代表沒有輸出。`}</p></div>
      {config.count !== 6 && simulation.validationIssues.length === 0 && <form className="functions-prediction-form" onSubmit={submitPrediction}><label htmlFor="traversal-prediction">預測 printf 的完整輸出</label>
        <div><input id="traversal-prediction" type="text" value={prediction} aria-describedby="traversal-prediction-hint" onChange={(event) => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">{config.count === 0 ? '提交空輸出或預測' : '提交走訪預測'} <ArrowRight size={17} aria-hidden="true" /></button></div>
        <small id="traversal-prediction-hint">以空白分隔整數；count 為 0 時可留空。</small>{predictionError && <p role="alert" className="functions-form-error">{predictionError}</p>}
      </form>}
      {submittedPrediction !== null && <p className="pointers-prediction-feedback" role="status">{!atTerminal ? '預測已記錄。走訪結束後再比對完整輸出。' : frame.phase === 'blocked' ? '模擬器已安全停止；越界讀取沒有可預測的完整結果。' : `你預測「${submittedPrediction.join(' ') || '無輸出'}」，實際「${frame.outputText || '無輸出'}」。${submittedPrediction.join(' ') === frame.outputText ? '預測正確！' : '逐格對照讀取位置，再試一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section" aria-labelledby="traversal-lab-title"><div className="page-width"><div className="functions-section-heading"><span className="section-kicker">FOLLOW THE TRAVERSAL</span><h2 id="traversal-lab-title">讀取、前進、再判斷。</h2><p>追蹤 i、目前元素與累積輸出；條件為 false 時，不再進入讀取步驟。</p></div>
      <LabShell className="functions-lab-shell pointers-lab-shell traversal-lab-shell" controls={controls} controlsLabel="陣列走訪控制"
        playback={unlocked ? <PlaybackControls controlName="走訪執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p className="functions-player-lock" role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><div><small>STEP {player.frameIndex + 1} / {simulation.frames.length}</small><strong>{phaseLabels[frame.phase]}</strong></div><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p className="functions-blocked-message" role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} title={<><Code2 size={17} aria-hidden="true" />C 程式碼</>} status={phaseLabels[frame.phase]} />
        <TraversalMemory frame={frame} config={config} />
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? `${phaseLabels[frame.phase]}。${frame.explanation}` : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width" aria-labelledby="traversal-challenges-title"><div className="functions-section-heading"><span className="section-kicker">TRY IT YOURSELF</span><h2 id="traversal-challenges-title">三個挑戰，走到邊界也看得清楚。</h2></div>
      <ChallengePanel challenges={challengeItems} activeId={activeChallenge} onSelect={setActiveChallenge} label="走訪學習挑戰">{(challenge) => <div className="pointers-challenge-content"><h3>{challenge.label}</h3><p>{TRAVERSAL_CHALLENGES.find((item) => item.id === challenge.id)?.description}</p>
        {challenge.id === 'predict-pointer-offset' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateTraversalOffset(offsetAnswer.trim() === '' ? null : Number(offsetAnswer))) }}><pre className="functions-challenge-code">{'int scores[5] = {4, 7, 2, 9, 5};\nint *p = scores;\nprintf("%d", *(p + 2));'}</pre><label htmlFor="traversal-offset">預測 *(p + 2) 的值</label><input id="traversal-offset" type="number" step={1} value={offsetAnswer} onChange={(event) => setOffsetAnswer(event.target.value)} /><button className="button button-primary" type="submit">檢查位移答案</button></form>}
        {challenge.id === 'choose-pointer-step' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateTraversalStep(stepAnswer)) }}><pre className="functions-challenge-code">{'int *p = scores;\np++;'}</pre><fieldset><legend>p++ 前進多少？</legend><label><input type="radio" name="traversal-step-answer" checked={stepAnswer === 'one-byte'} onChange={() => setStepAnswer('one-byte')} />固定一個 byte</label><label><input type="radio" name="traversal-step-answer" checked={stepAnswer === 'one-element'} onChange={() => setStepAnswer('one-element')} />一個 int 元素，也就是 sizeof(*p) bytes</label></fieldset><button className="button button-primary" type="submit">檢查前進單位</button></form>}
        {challenge.id === 'identify-one-past' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateOnePast(onePastAnswer)) }}><pre className="functions-challenge-code">{'int *p = scores + 5;\n/* scores 共有 5 個元素 */'}</pre><fieldset><legend>這個尾後指標可以怎麼使用？</legend><label><input type="radio" name="traversal-one-past-answer" checked={onePastAnswer === 'dereference'} onChange={() => setOnePastAnswer('dereference')} />可以用 *p 讀取第六格</label><label><input type="radio" name="traversal-one-past-answer" checked={onePastAnswer === 'form-only'} onChange={() => setOnePastAnswer('form-only')} />可以形成這個指標，但不可解參照</label></fieldset><button className="button button-primary" type="submit">檢查尾後邊界</button></form>}
        {feedback[challenge.id] && <p className={`functions-challenge-feedback ${feedback[challenge.id]?.solved ? 'is-success' : 'is-hint'}`} role="status">{feedback[challenge.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>最後一格在 [4]，尾後位置在 + 5。</h2><p>索引與指標可以走過同一排資料。每次只讀取合法元素，讓 p++ 在元素之間移動，並在尾後位置停下。</p><div><Link className="button button-secondary" to="/learn/pointers/swap"><ArrowLeft size={17} aria-hidden="true" />上一課：指標參數與交換變數</Link><Link className="button button-primary" to="/learn">回到課程地圖 <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
  </div>
}
