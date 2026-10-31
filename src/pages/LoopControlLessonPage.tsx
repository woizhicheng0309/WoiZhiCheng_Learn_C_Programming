import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Code2, CornerDownRight, LogOut, Terminal, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import {
  DEFAULT_LOOP_CONTROL_CONFIG,
  LOOP_CONTROL_LIMITS,
  simulateLoopControlProgram,
  validateLoopControlConfig,
  type LoopControlConfig,
  type LoopControlFrame,
  type LoopControlPhase,
} from '../domain/loopControl'
import {
  LOOP_CONTROL_CHALLENGES,
  evaluateBreakOutput,
  evaluateContinueSum,
  evaluateContinueUpdate,
  type LoopControlChallengeId,
} from '../data/loopControlChallenges'

const LESSON_ID = 'loops-break-continue' as const
type Feedback = { solved: boolean; message: string }
type NextStep = 'increment' | 'condition' | 'exit'
const phaseLabels: Record<LoopControlPhase, string> = {
  'enter-main': '進入 main',
  'init-sum': '建立 sum',
  initialize: '建立 i',
  condition: '判斷迴圈條件',
  branch: '判斷是否命中',
  break: '跳出迴圈',
  continue: '跳過本次剩餘工作',
  accumulate: '累加 sum',
  'print-value': '輸出目前 i',
  increment: '更新 i',
  'print-summary': '輸出總和',
  'return-main': 'main 回傳',
  done: '執行完成',
  blocked: '安全停止',
}

function readConfig(value: unknown): LoopControlConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_LOOP_CONTROL_CONFIG }
  const candidate = value as LoopControlConfig
  return validateLoopControlConfig(candidate).length === 0
    ? { mode: candidate.mode, end: candidate.end, trigger: candidate.trigger }
    : { ...DEFAULT_LOOP_CONTROL_CONFIG }
}

function NumberControl({ field, value, onChange }: {
  field: 'end' | 'trigger'
  value: number
  onChange: (value: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = field === 'end' ? '迴圈上限 end' : '命中值 trigger'
  const limits = LOOP_CONTROL_LIMITS[field]
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== String(value)) inputRef.current.value = String(value)
  }, [value])
  return <div className="functions-number-control">
    <div className="functions-control-label"><label htmlFor={`loop-control-${field}`}>{label}</label><small>{limits.min} 到 {limits.max} 的整數</small></div>
    <input ref={inputRef} id={`loop-control-${field}`} type="number" min={limits.min} max={limits.max} step={1} defaultValue={value}
      onChange={(event) => {
        const draft = event.target.value
        if (draft.trim() !== '' && Number.isFinite(Number(draft))) onChange(Number(draft))
      }}
      onBlur={(event) => { event.currentTarget.value = String(value) }} />
  </div>
}

function LoopExecution({ frame, config }: { frame: LoopControlFrame; config: LoopControlConfig }) {
  const iState = frame.memory.i === null ? '尚未宣告' : frame.memory.iInScope ? String(frame.memory.i) : '離開作用域'
  const sumState = frame.memory.sum === null ? '尚未宣告' : frame.memory.inScope ? String(frame.memory.sum) : '離開作用域'
  const branchText = frame.branchResult === null ? '本步未判斷' : String(frame.branchResult)
  const steps = [
    { id: 'branch', label: 'if 命中判斷', active: frame.phase === 'branch' },
    { id: 'jump', label: config.mode, active: frame.phase === config.mode },
    { id: 'next', label: config.mode === 'break' ? '迴圈後的程式' : 'for 更新 i++', active: config.mode === 'break' ? frame.phase === 'print-summary' : frame.phase === 'increment' },
  ]
  return <section className="loop-control-execution lab-panel" aria-labelledby="loop-control-memory-title">
    <div className="pointers-panel-heading"><small>FOLLOW THE JUMP</small><h2 id="loop-control-memory-title">同一個命中值，兩條不同路徑。</h2></div>
    <ol className="loop-control-flow" aria-label={`${config.mode} 命中時的跳轉路徑`}>
      {steps.map((step, index) => <li key={step.id} className={step.active ? 'is-active' : ''} aria-current={step.active ? 'step' : undefined}>
        <small>0{index + 1}</small><strong>{step.label}</strong>{index < steps.length - 1 && <ArrowRight size={16} aria-hidden="true" />}
      </li>)}
    </ol>
    <p className="loop-control-path-note">{config.mode === 'break'
      ? '命中後直接離開這一層迴圈：不累加、不輸出，也不執行 i++。'
      : '命中後跳過這次的累加與輸出，接著執行 for 的 i++，再判斷迴圈條件。'}</p>
    <div className="loop-control-state-grid">
      <div aria-label={`目前 i，${iState}`}><small>迴圈變數</small><code>i</code><strong>{frame.memory.i !== null && frame.memory.iInScope ? frame.memory.i : '—'}</strong></div>
      <div aria-label={`目前 sum，${sumState}`}><small>已累加總和</small><code>sum</code><strong>{frame.memory.sum !== null && frame.memory.inScope ? frame.memory.sum : '—'}</strong></div>
    </div>
    <div className="loop-control-comparison" aria-label={`命中判斷，${branchText}`}>
      <code>{frame.branchResult === null ? `i == ${config.trigger}` : `${frame.memory.i} == ${config.trigger}`}</code>
      <strong>{frame.branchResult === null ? '—' : String(frame.branchResult)}</strong>
      <span>{frame.branchResult === null ? '執行到 if 時才判斷是否命中。' : frame.branchResult ? `命中！下一步執行 ${config.mode}。` : '沒有命中，繼續累加與輸出。'}</span>
    </div>
    <div className="loop-control-console">
      <div><Terminal size={16} aria-hidden="true" /><span>printf 輸出</span></div>
      <ol aria-label="迴圈內 printf 輸出數列">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>
      {frame.output.length === 0 && <p>{frame.summary === null ? '尚無迴圈內輸出' : '（迴圈內無輸出）'}</p>}
      {frame.summary !== null && <p className="loop-control-summary" aria-label="迴圈後的總和輸出">{frame.summary}</p>}
    </div>
  </section>
}

export function LoopControlLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lessonProgress.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lessonProgress.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submittedPrediction, setSubmittedPrediction] = useState<number | null>(null)
  const [predictionError, setPredictionError] = useState('')
  const [activeChallenge, setActiveChallenge] = useState<LoopControlChallengeId>(() => LOOP_CONTROL_CHALLENGES.find((challenge) => !lessonProgress.completedChallengeIds.includes(challenge.id))?.id ?? LOOP_CONTROL_CHALLENGES[0].id)
  const [breakAnswer, setBreakAnswer] = useState('')
  const [sumAnswer, setSumAnswer] = useState('')
  const [nextAnswer, setNextAnswer] = useState<NextStep | null>(null)
  const [feedback, setFeedback] = useState<Partial<Record<LoopControlChallengeId, Feedback>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const syncRef = useRef({ savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId })
  const resettingProgressRef = useRef(false)
  const simulation = useMemo(() => simulateLoopControlProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = useMemo(() => simulation.source.lines.map((line) => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] })), [simulation.source])
  const completedCount = LOOP_CONTROL_CHALLENGES.filter((challenge) => lessonProgress.completedChallengeIds.includes(challenge.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = syncRef.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    const guidedReset = previous.guided && !lessonProgress.guidedRunCompleted
    syncRef.current = { savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId }
    resettingProgressRef.current = previous.savedKey !== savedKey || cleared || guidedReset
    if (resettingProgressRef.current) {
      setConfig(readConfig(JSON.parse(savedKey)))
      setPrediction('')
      setSubmittedPrediction(null)
      setPredictionError('')
      setUnlocked(lessonProgress.guidedRunCompleted)
      resetPlayer()
      if (cleared) {
        setFeedback({})
        setBreakAnswer('')
        setSumAnswer('')
        setNextAnswer(null)
        setActiveChallenge(LOOP_CONTROL_CHALLENGES[0].id)
      }
    } else if (previous.guided !== lessonProgress.guidedRunCompleted) setUnlocked(lessonProgress.guidedRunCompleted)
  }, [savedKey, lessonProgress.guidedRunCompleted, hasLesson, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resettingProgressRef.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: LoopControlConfig) => {
    const valid = validateLoopControlConfig(next).length === 0
    setConfig(next)
    setPrediction('')
    setSubmittedPrediction(null)
    setPredictionError('')
    setUnlocked(lessonProgress.guidedRunCompleted || !valid)
    if (valid) {
      syncRef.current.savedKey = JSON.stringify(next)
      rememberLessonState(LESSON_ID, next)
    }
  }
  const submitPrediction = (event: FormEvent) => {
    event.preventDefault()
    const answer = prediction.trim() === '' ? Number.NaN : Number(prediction)
    if (!Number.isInteger(answer) || answer < 0) {
      setPredictionError('請先輸入非負整數，預測最後的 sum。')
      return
    }
    setPredictionError('')
    setSubmittedPrediction(answer)
    setUnlocked(true)
    player.reset()
  }
  const completeChallenge = (id: LoopControlChallengeId, result: Feedback) => {
    setFeedback((current) => ({ ...current, [id]: result }))
    if (result.solved) markChallengeCompleted(LESSON_ID, id)
  }
  const controls = <div className="pointers-controls loop-control-controls">
    <h2>選擇命中後的動作</h2>
    <fieldset><legend>流程控制</legend>
      <label><input type="radio" name="loop-control-mode" checked={config.mode === 'break'} onChange={() => changeConfig({ ...config, mode: 'break' })} />break · 跳出這一層迴圈</label>
      <label><input type="radio" name="loop-control-mode" checked={config.mode === 'continue'} onChange={() => changeConfig({ ...config, mode: 'continue' })} />continue · 跳過本次剩餘工作</label>
    </fieldset>
    <NumberControl field="end" value={config.end} onChange={(end) => changeConfig({ ...config, end })} />
    <NumberControl field="trigger" value={config.trigger} onChange={(trigger) => changeConfig({ ...config, trigger })} />
    <div className="loop-control-presets" aria-label="命中情境">
      <small>試一種情境</small>
      <button type="button" onClick={() => changeConfig({ ...config, end: 5, trigger: 1 })}>第一輪就命中</button>
      <button type="button" onClick={() => changeConfig({ ...config, end: 5, trigger: 5 })}>最後一輪命中</button>
      <button type="button" onClick={() => changeConfig({ ...config, end: 5, trigger: 6 })}>沒有命中的值</button>
    </div>
    <button className="functions-restore-button" type="button" onClick={() => changeConfig({ ...DEFAULT_LOOP_CONTROL_CONFIG })}>恢復預設值</button>
    <p className="loop-control-note">這裡使用 for 迴圈。continue 會接著執行表頭的 i++；若改寫成 while，必須另外確認更新不會被跳過。</p>
  </div>
  const challengeItems = LOOP_CONTROL_CHALLENGES.map((challenge, index) => ({ id: challenge.id, label: challenge.title, eyebrow: `CHALLENGE 0${index + 1}`, completed: lessonProgress.completedChallengeIds.includes(challenge.id) }))

  return <div className="loop-control-page pointers-page functions-page lab-page">
    <section className="loop-control-hero pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" /><span>break 與 continue</span></nav>
      <div className="functions-hero__layout"><div className="functions-hero__copy"><Link className="back-link" to="/learn"><ArrowLeft size={16} aria-hidden="true" />回到課程地圖</Link><span className="section-kicker">MODULE 03 · LESSON 03</span><h1>離開這個迴圈，<br />或跳過這一輪。</h1><p>遇到同一個值，break 與 continue 會走向不同的下一步。逐步追蹤 i、sum 和輸出，看懂跳轉如何改變結果。</p></div>
        <aside className={`lesson-status-card${completedCount === 3 ? ' complete' : ''}`} aria-label="本單元學習進度"><div><Trophy size={21} aria-hidden="true" /><span>{completedCount === 3 ? '單元完成' : '學習進度'}</span></div><strong>{completedCount}<small>/3</small></strong><p>通過三題即可完成這個單元</p></aside></div>
    </div></section>

    <section className="functions-overview page-width" aria-labelledby="loop-control-goals-title">
      <div className="functions-objectives"><span className="section-kicker">LEARNING GOALS</span><h2 id="loop-control-goals-title">看懂跳轉，也找到下一步。</h2><ul><li><Check size={17} aria-hidden="true" />比較跳出整層迴圈與跳過本次剩餘工作。</li><li><Check size={17} aria-hidden="true" />追蹤未被跳過的累加與輸出。</li><li><Check size={17} aria-hidden="true" />確認 continue 之後仍執行 for 的更新。</li></ul></div>
      <div className="functions-concepts"><article><span><LogOut size={20} aria-hidden="true" /></span><small>01 · break</small><h3>直接離開這一層</h3><p>跳到迴圈後的程式；不再更新 i，也不再判斷這個迴圈條件。</p></article><article><span><CornerDownRight size={20} aria-hidden="true" /></span><small>02 · continue</small><h3>這輪先到這裡</h3><p>跳過本體剩餘工作。在 for 裡，下一步是更新，再判斷條件。</p></article><article><span><Code2 size={20} aria-hidden="true" /></span><small>03 · 命中之前</small><h3>順序影響結果</h3><p>本例先判斷，再累加與輸出。因此命中那一個 i 不會加入 sum。</p></article></div>
    </section>

    <section className="functions-prediction-section" aria-labelledby="loop-control-prediction-title"><div className="page-width functions-prediction-card">
      <div className="functions-prediction-card__copy"><span className="section-kicker">PREDICT BEFORE RUN</span><h2 id="loop-control-prediction-title">最後的 sum 會是多少？</h2><p>{simulation.status === 'blocked' ? '這組設定超出練習範圍。直接播放安全停止流程，調回合法值後再預測。' : `目前使用 ${config.mode}，i 從 1 走到 ${config.end}，命中 ${config.trigger} 時跳轉。先預測總和，再觀察流程。`}</p></div>
      {simulation.status === 'completed' && <form className="functions-prediction-form" onSubmit={submitPrediction}><label htmlFor="loop-control-prediction">預測最後的 sum</label><div><input id="loop-control-prediction" type="number" min={0} step={1} value={prediction} onChange={(event) => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交總和預測 <ArrowRight size={17} aria-hidden="true" /></button></div>{predictionError && <p className="functions-form-error" role="alert">{predictionError}</p>}</form>}
      {submittedPrediction !== null && <p className="pointers-prediction-feedback" role="status">{frame.summary === null ? '預測已記錄。執行到最後的總和輸出時揭曉。' : `你預測 ${submittedPrediction}，實際 sum = ${simulation.sum}。${submittedPrediction === simulation.sum ? '預測正確！' : '沿著跳轉路徑，再檢查哪些值被略過。'}`}</p>}
    </div></section>

    <section className="functions-lab-section" aria-labelledby="loop-control-lab-title"><div className="page-width">
      <div className="functions-section-heading"><span className="section-kicker">FOLLOW THE JUMP</span><h2 id="loop-control-lab-title">命中之後，下一行在哪裡？</h2><p>把 break 換成 continue，比較同一個命中值如何影響總和。程式碼高亮會指出真正執行的下一步。</p></div>
      <LabShell className="functions-lab-shell pointers-lab-shell loop-control-lab-shell" controls={controls} controlsLabel="break 與 continue 控制"
        playback={unlocked ? <PlaybackControls controlName="流程控制執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p className="functions-player-lock" role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><div><small>STEP {player.frameIndex + 1} / {simulation.frames.length}</small><strong>{phaseLabels[frame.phase]}</strong></div><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p className="functions-blocked-message" role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={`line-${frame.activeLine}`} title={<><Code2 size={17} aria-hidden="true" />C 程式碼</>} status={phaseLabels[frame.phase]} />
        <LoopExecution frame={frame} config={config} />
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? `${phaseLabels[frame.phase]}。${frame.explanation}` : ''}</p>
    </div></section>

    <section className="pointers-challenges page-width" aria-labelledby="loop-control-challenges-title"><div className="functions-section-heading"><span className="section-kicker">TRY IT YOURSELF</span><h2 id="loop-control-challenges-title">三個挑戰，確認下一步。</h2></div>
      <ChallengePanel challenges={challengeItems} activeId={activeChallenge} onSelect={setActiveChallenge} label="流程控制學習挑戰">{(challenge) => <div className="pointers-challenge-content"><h3>{challenge.label}</h3><p>{LOOP_CONTROL_CHALLENGES.find((item) => item.id === challenge.id)?.description}</p>
        {challenge.id === 'predict-break-output' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateBreakOutput(breakAnswer)) }}>
          <pre className="functions-challenge-code">{'for (int i = 1; i <= 5; i++) {\n  if (i == 3) { break; }\n  printf("%d\\n", i);\n}'}</pre><label htmlFor="loop-control-break-answer">迴圈內會依序輸出哪些數字？</label><input id="loop-control-break-answer" type="text" value={breakAnswer} onChange={(event) => setBreakAnswer(event.target.value)} placeholder="用空白或逗號分隔" /><button className="button button-primary" type="submit">檢查 break 輸出</button>
        </form>}
        {challenge.id === 'predict-continue-sum' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateContinueSum(sumAnswer.trim() === '' ? null : Number(sumAnswer))) }}>
          <pre className="functions-challenge-code">{'int sum = 0;\nfor (int i = 1; i <= 5; i++) {\n  if (i == 3) { continue; }\n  sum += i;\n}'}</pre><label htmlFor="loop-control-sum-answer">continue 範例最後的 sum 是多少？</label><input id="loop-control-sum-answer" type="number" min={0} step={1} value={sumAnswer} onChange={(event) => setSumAnswer(event.target.value)} /><button className="button button-primary" type="submit">檢查 continue 總和</button>
        </form>}
        {challenge.id === 'identify-continue-update' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateContinueUpdate(nextAnswer)) }}>
          <pre className="functions-challenge-code">{'for (int i = 1; i <= 5; i++) {\n  if (i == 3) { continue; }\n  sum += i;\n}'}</pre><fieldset><legend>i = 3 執行 continue 後，下一步是什麼？</legend>
            <label><input type="radio" name="loop-control-next-answer" checked={nextAnswer === 'increment'} onChange={() => setNextAnswer('increment')} />執行更新 i++</label><label><input type="radio" name="loop-control-next-answer" checked={nextAnswer === 'condition'} onChange={() => setNextAnswer('condition')} />直接判斷 i &lt;= 5，略過更新</label><label><input type="radio" name="loop-control-next-answer" checked={nextAnswer === 'exit'} onChange={() => setNextAnswer('exit')} />直接離開迴圈</label>
          </fieldset><button className="button button-primary" type="submit">檢查下一步</button>
        </form>}
        {feedback[challenge.id] && <p className={`functions-challenge-feedback ${feedback[challenge.id]?.solved ? 'is-success' : 'is-hint'}`} role="status">{feedback[challenge.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>

    <section className="pointers-recap page-width"><h2>跳轉之後，更新還會執行嗎？</h2><p>break 離開最近的一層迴圈；continue 只略過本次剩餘工作，在 for 裡仍會執行更新。換成 while 時，更新若放在 continue 後面就可能被略過，必須重新檢查終止條件。</p>{completedCount === 3 && <p className="loop-control-complete" role="status">你已完成 break 與 continue。</p>}<div><Link className="button button-secondary" to="/learn/loops/while-do-while"><ArrowLeft size={17} aria-hidden="true" />上一課：while 與 do…while</Link><Link className="button button-primary" to="/learn/functions/basics">下一課：函式 <ArrowRight size={17} aria-hidden="true" /></Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
