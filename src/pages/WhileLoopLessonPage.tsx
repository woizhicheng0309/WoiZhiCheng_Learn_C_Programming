import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Code2, Repeat2, Terminal, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { COMPARATORS } from '../domain/types'
import {
  DEFAULT_WHILE_CONFIG, WHILE_LIMITS, simulateWhileProgram, validateWhileConfig,
  type WhileConfig, type WhileFrame, type WhilePhase,
} from '../domain/whileLoops'
import {
  WHILE_CHALLENGES, evaluateDoOnce, evaluateWhileUpdate, evaluateWhileZero, type WhileChallengeId,
} from '../data/whileChallenges'

const LESSON_ID = 'loops-while-do-while' as const
type Feedback = { solved: boolean; message: string }
const phaseLabels: Record<WhilePhase, string> = {
  'enter-main': '進入 main', initialize: '建立 i', condition: '判斷條件', body: '執行迴圈本體',
  increment: '更新 i', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): WhileConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_WHILE_CONFIG }
  const candidate = value as WhileConfig
  return validateWhileConfig(candidate).length === 0
    ? { mode: candidate.mode, start: candidate.start, end: candidate.end, comparator: candidate.comparator, step: candidate.step }
    : { ...DEFAULT_WHILE_CONFIG }
}
function NumberControl({ field, value, onChange }: { field: 'start' | 'end' | 'step'; value: number; onChange: (value: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const labels = { start: '起始值 start', end: '比較值 end', step: '更新值 step' }
  const limits = WHILE_LIMITS[field]
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== String(value)) inputRef.current.value = String(value)
  }, [value])
  return <div className="functions-number-control"><div className="functions-control-label"><label htmlFor={`while-${field}`}>{labels[field]}</label><small>{limits.min} 到 {limits.max} 的整數</small></div>
    <input ref={inputRef} id={`while-${field}`} type="number" step={1} min={limits.min} max={limits.max} defaultValue={value}
      onChange={(event) => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) onChange(Number(event.target.value)) }}
      onBlur={(event) => { event.currentTarget.value = String(value) }} />
  </div>
}
function WhileExecution({ frame, config }: { frame: WhileFrame; config: WhileConfig }) {
  const order = config.mode === 'while' ? ['condition', 'body', 'increment'] as const : ['body', 'increment', 'condition'] as const
  const variableValue = frame.memory.i === null ? '尚未宣告' : !frame.memory.inScope ? '離開作用域' : String(frame.memory.i)
  return <section className="while-execution lab-panel" aria-labelledby="while-memory-title">
    <div className="pointers-panel-heading"><small>ORDER CHANGES THE FIRST STEP</small><h2 id="while-memory-title">追蹤 i，也追蹤執行順序。</h2></div>
    <ol className="while-flow" aria-label={`${config.mode} 的執行順序`}>{order.map((phase, index) => <li key={phase} className={frame.phase === phase ? 'is-active' : ''} aria-current={frame.phase === phase ? 'step' : undefined}><small>0{index + 1}</small><strong>{phaseLabels[phase]}</strong>{index < 2 && <ArrowRight size={15} aria-hidden="true" />}</li>)}</ol>
    <p className="while-flow-note">{config.mode === 'while' ? '先判斷條件；true 才執行本體並更新 i，再回來判斷。' : '先執行本體並更新 i；之後才判斷條件，true 才再次執行本體。'}</p>
    <div className="while-state-grid"><div aria-label={`目前 i，${variableValue}`}><small>目前變數</small><code>i</code><strong>{frame.memory.i !== null && frame.memory.inScope ? frame.memory.i : '—'}</strong></div><div aria-label={`本體已執行 ${frame.iteration} 次`}><small>本體執行次數</small><code>iterations</code><strong>{frame.iteration}</strong></div></div>
    <div className="while-condition" aria-label={`條件判斷，${frame.conditionResult === null ? '本步未判斷' : frame.conditionResult ? 'true' : 'false'}`}>
      <code>{frame.conditionResult === null ? `i ${config.comparator} ${config.end}` : frame.conditionExpression}</code><strong>{frame.conditionResult === null ? '—' : frame.conditionResult ? 'true' : 'false'}</strong><span>{frame.conditionResult === null ? '本步沒有判斷條件。' : frame.conditionResult ? `條件為 true，準備${frame.iteration > 0 ? '再次' : ''}執行本體。` : '條件為 false，迴圈結束。'}</span>
    </div>
    <div className="while-console"><div><Terminal size={16} aria-hidden="true" /><span>printf 輸出</span></div><ol aria-label="printf 輸出數列">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{frame.output.length === 0 && <p>{frame.phase === 'done' ? '（無輸出）' : '尚無輸出'}</p>}</div>
  </section>
}

export function WhileLoopLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lessonProgress.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(() => lessonProgress.guidedRunCompleted || simulateWhileProgram(config).status === 'blocked')
  const [prediction, setPrediction] = useState('')
  const [submittedPrediction, setSubmittedPrediction] = useState<number | null>(null)
  const [predictionError, setPredictionError] = useState('')
  const [activeChallenge, setActiveChallenge] = useState<WhileChallengeId>(() => WHILE_CHALLENGES.find((challenge) => !lessonProgress.completedChallengeIds.includes(challenge.id))?.id ?? WHILE_CHALLENGES[0].id)
  const [whileAnswer, setWhileAnswer] = useState('')
  const [doAnswer, setDoAnswer] = useState('')
  const [updateAnswer, setUpdateAnswer] = useState<'increment' | 'unchanged' | null>(null)
  const [feedback, setFeedback] = useState<Partial<Record<WhileChallengeId, Feedback>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const syncRef = useRef({ savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId })
  const resettingProgressRef = useRef(false)
  const simulation = useMemo(() => simulateWhileProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = useMemo(() => simulation.source.lines.map((line) => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] })), [simulation.source])
  const completedCount = WHILE_CHALLENGES.filter((challenge) => lessonProgress.completedChallengeIds.includes(challenge.id)).length
  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = syncRef.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    syncRef.current = { savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId }
    resettingProgressRef.current = previous.savedKey !== savedKey || cleared
    const savedConfig = readConfig(JSON.parse(savedKey))
    const savedBlocked = simulateWhileProgram(savedConfig).status === 'blocked'
    if (resettingProgressRef.current) {
      setConfig(savedConfig)
      setPrediction('')
      setSubmittedPrediction(null)
      setPredictionError('')
      setUnlocked(lessonProgress.guidedRunCompleted || savedBlocked)
      if (cleared) { resetPlayer(); setFeedback({}); setActiveChallenge(WHILE_CHALLENGES[0].id) }
    } else if (previous.guided !== lessonProgress.guidedRunCompleted) setUnlocked(lessonProgress.guidedRunCompleted || savedBlocked)
  }, [savedKey, lessonProgress.guidedRunCompleted, hasLesson, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resettingProgressRef.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: WhileConfig) => {
    setConfig(next)
    setPrediction('')
    setSubmittedPrediction(null)
    setPredictionError('')
    setUnlocked(lessonProgress.guidedRunCompleted || simulateWhileProgram(next).status === 'blocked')
    if (validateWhileConfig(next).length === 0) { syncRef.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const submitPrediction = (event: FormEvent) => {
    event.preventDefault()
    const answer = prediction.trim() === '' ? Number.NaN : Number(prediction)
    if (!Number.isInteger(answer) || answer < 0) { setPredictionError('請先輸入非負整數，預測本體執行次數。'); return }
    setPredictionError('')
    setSubmittedPrediction(answer)
    setUnlocked(true)
    player.reset()
  }
  const completeChallenge = (id: WhileChallengeId, evaluation: Feedback) => {
    setFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) markChallengeCompleted(LESSON_ID, id)
  }
  const controls = <div className="pointers-controls while-controls"><h2>比較兩種判斷時機</h2><fieldset><legend>迴圈形式</legend>
    <label><input type="radio" name="while-mode" checked={config.mode === 'while'} onChange={() => changeConfig({ ...config, mode: 'while' })} />while · 先判斷條件</label><label><input type="radio" name="while-mode" checked={config.mode === 'do-while'} onChange={() => changeConfig({ ...config, mode: 'do-while' })} />do…while · 先執行本體</label></fieldset>
    <NumberControl field="start" value={config.start} onChange={(start) => changeConfig({ ...config, start })} /><label htmlFor="while-comparator">比較運算子</label><select id="while-comparator" value={config.comparator} onChange={(event) => changeConfig({ ...config, comparator: event.target.value as WhileConfig['comparator'] })}>{COMPARATORS.map((comparator) => <option key={comparator} value={comparator}>{comparator}</option>)}</select>
    <NumberControl field="end" value={config.end} onChange={(end) => changeConfig({ ...config, end })} /><NumberControl field="step" value={config.step} onChange={(step) => changeConfig({ ...config, step })} />
    <div className="while-presets" aria-label="常見迴圈情境"><small>試一種情境</small><button type="button" onClick={() => changeConfig({ ...config, start: 5, end: 3, comparator: '<', step: 1 })}>一開始條件不成立</button><button type="button" onClick={() => changeConfig({ ...config, start: 3, end: 0, comparator: '>', step: -1 })}>倒數走訪</button><button type="button" onClick={() => changeConfig({ ...config, start: 0, end: 3, comparator: '<', step: 0 })}>更新值不變</button></div>
    <button className="functions-restore-button" type="button" onClick={() => changeConfig({ ...DEFAULT_WHILE_CONFIG })}>恢復預設值</button><p className="while-safety-note">模擬器會辨識更新值不變、方向錯誤與超過 {WHILE_LIMITS.maxIterations} 次本體執行的風險，在繼續重複前安全停止。</p>
  </div>
  const challengeItems = WHILE_CHALLENGES.map((challenge, index) => ({ id: challenge.id, label: challenge.title, eyebrow: `CHALLENGE 0${index + 1}`, completed: lessonProgress.completedChallengeIds.includes(challenge.id) }))
  return <div className="while-loops-page pointers-page functions-page lab-page">
    <section className="while-loops-hero pointers-hero functions-hero lab-hero"><div className="page-width"><nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" /><span>while 與 do…while</span></nav>
      <div className="functions-hero__layout"><div className="functions-hero__copy"><Link className="back-link" to="/learn"><ArrowLeft size={16} aria-hidden="true" />回到課程地圖</Link><span className="section-kicker">MODULE 03 · LESSON 02</span><h1><span className="while-clause">先問條件，</span><br /><span className="while-clause">或先做一次。</span></h1><p>把 while 換成 do…while，觀察第一步發生什麼事。跟著 i 的變化，看懂條件判斷的時機。</p></div>
      <aside className={`lesson-status-card${completedCount === 3 ? ' complete' : ''}`} aria-label="本單元學習進度"><div><Trophy size={21} aria-hidden="true" /><span>{completedCount === 3 ? '單元完成' : '學習進度'}</span></div><strong>{completedCount}<small>/3</small></strong><p>通過三題即可完成這個單元</p></aside></div>
    </div></section>
    <section className="functions-overview page-width" aria-labelledby="while-goals-title"><div className="functions-objectives"><span className="section-kicker">LEARNING GOALS</span><h2 id="while-goals-title"><span className="while-clause">條件在哪裡，</span><span className="while-clause">順序就不同。</span></h2><ul><li><Check size={17} aria-hidden="true" />分辨先判斷與後判斷的執行順序。</li><li><Check size={17} aria-hidden="true" />看懂更新 i 後，下一次條件的結果。</li><li><Check size={17} aria-hidden="true" />用方向正確的更新，讓條件有機會變成 false。</li></ul></div>
      <div className="functions-concepts"><article><span><Code2 size={20} aria-hidden="true" /></span><small>01 · while</small><h3>可能一次也不做</h3><p>先檢查條件。若第一次就是 false，本體不會執行。</p></article><article><span><Repeat2 size={20} aria-hidden="true" /></span><small>02 · do…while</small><h3>先做完第一次</h3><p>先執行本體與更新，再判斷條件。第一次比較用的是更新後的 i。</p></article><article><span><ArrowRight size={20} aria-hidden="true" /></span><small>03 · 更新變數</small><h3>讓條件有機會改變</h3><p>本體內的更新必須配合比較方向；i 不變時，原本為 true 的條件也可能一直為 true。</p></article></div>
    </section>
    <section className="functions-prediction-section" aria-labelledby="while-prediction-title"><div className="page-width functions-prediction-card"><div className="functions-prediction-card__copy"><span className="section-kicker">PREDICT BEFORE RUN</span><h2 id="while-prediction-title"><span className="while-clause">這段迴圈，</span><span className="while-clause">本體會做幾次？</span></h2><p>{simulation.status === 'blocked' ? '這組設定會觸發安全停止。直接逐步觀察，不把未完成的執行當成完整答案。' : `目前使用 ${config.mode}。先預測執行次數；等程式正常結束後再揭曉答案。`}</p></div>
      {simulation.status === 'completed' && <form className="functions-prediction-form" onSubmit={submitPrediction}><label htmlFor="while-prediction">預測本體執行次數</label><div><input id="while-prediction" type="number" min={0} step={1} value={prediction} onChange={(event) => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交迴圈預測 <ArrowRight size={17} aria-hidden="true" /></button></div>{predictionError && <p className="functions-form-error" role="alert">{predictionError}</p>}</form>}
      {submittedPrediction !== null && <p className="pointers-prediction-feedback" role="status">{frame.phase !== 'done' ? '預測已記錄。程式正常結束後再比對執行次數。' : `你預測 ${submittedPrediction} 次，實際執行 ${frame.iteration} 次。${submittedPrediction === frame.iteration ? '預測正確！' : '沿著條件與更新，再追蹤一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section" aria-labelledby="while-lab-title"><div className="page-width"><div className="functions-section-heading"><span className="section-kicker">FOLLOW THE ORDER</span><h2 id="while-lab-title"><span className="while-clause">先看順序，</span><span className="while-clause">再追蹤 i。</span></h2><p>執行條件判斷時才顯示 true 或 false。do…while 的第一次本體之前，還沒有判斷條件。</p></div>
      <LabShell className="functions-lab-shell pointers-lab-shell while-lab-shell" controls={controls} controlsLabel="while 迴圈控制"
        playback={unlocked ? <PlaybackControls controlName="while 執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p className="functions-player-lock" role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><div><small>STEP {player.frameIndex + 1} / {simulation.frames.length}</small><strong>{phaseLabels[frame.phase]}</strong></div><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p className="functions-blocked-message" role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} title={<><Code2 size={17} aria-hidden="true" />C 程式碼</>} status={phaseLabels[frame.phase]} /><WhileExecution frame={frame} config={config} />
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? `${phaseLabels[frame.phase]}。${frame.explanation}` : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width" aria-labelledby="while-challenges-title"><div className="functions-section-heading"><span className="section-kicker">TRY IT YOURSELF</span><h2 id="while-challenges-title"><span className="while-clause">三個挑戰，</span><span className="while-clause">讀懂兩種順序。</span></h2></div>
      <ChallengePanel challenges={challengeItems} activeId={activeChallenge} onSelect={setActiveChallenge} label="while 學習挑戰">{(challenge) => <div className="pointers-challenge-content"><h3>{challenge.label}</h3><p>{WHILE_CHALLENGES.find((item) => item.id === challenge.id)?.description}</p>
        {challenge.id === 'predict-while-zero' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateWhileZero(whileAnswer.trim() === '' ? null : Number(whileAnswer))) }}><pre className="functions-challenge-code">{'int i = 5;\nwhile (i < 3) {\n  printf("%d", i);\n  i++;\n}'}</pre><label htmlFor="while-challenge-zero">while 本體會執行幾次？</label><input id="while-challenge-zero" type="number" min={0} step={1} value={whileAnswer} onChange={(event) => setWhileAnswer(event.target.value)} /><button className="button button-primary" type="submit">檢查 while 答案</button></form>}
        {challenge.id === 'predict-do-once' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateDoOnce(doAnswer.trim() === '' ? null : Number(doAnswer))) }}><pre className="functions-challenge-code">{'int i = 5;\ndo {\n  printf("%d", i);\n  i++;\n} while (i < 3);'}</pre><label htmlFor="while-challenge-once">do…while 本體會執行幾次？</label><input id="while-challenge-once" type="number" min={0} step={1} value={doAnswer} onChange={(event) => setDoAnswer(event.target.value)} /><button className="button button-primary" type="submit">檢查 do…while 答案</button></form>}
        {challenge.id === 'identify-loop-update' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateWhileUpdate(updateAnswer)) }}><pre className="functions-challenge-code">{'int i = 0;\nwhile (i < 3) {\n  printf("%d", i);\n  /* 補上哪一種更新？ */\n}'}</pre><fieldset><legend>怎樣讓 i 有機會走到終止條件？</legend><label><input type="radio" name="while-update-answer" checked={updateAnswer === 'unchanged'} onChange={() => setUpdateAnswer('unchanged')} />i += 0; · 保持不變</label><label><input type="radio" name="while-update-answer" checked={updateAnswer === 'increment'} onChange={() => setUpdateAnswer('increment')} />i++; · 每次增加 1</label></fieldset><button className="button button-primary" type="submit">檢查更新方式</button></form>}
        {feedback[challenge.id] && <p className={`functions-challenge-feedback ${feedback[challenge.id]?.solved ? 'is-success' : 'is-hint'}`} role="status">{feedback[challenge.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2><span className="while-clause">判斷的時機，</span><span className="while-clause">決定第一步。</span></h2><p>while 先判斷，do…while 先做一次。每次更新後再比較目前的 i，用實際流程確認迴圈何時結束。</p><div><Link className="button button-secondary" to="/learn/loops/for"><ArrowLeft size={17} aria-hidden="true" />上一課：for 迴圈</Link><Link className="button button-primary" to="/learn/loops/break-continue">下一課：break 與 continue <ArrowRight size={17} aria-hidden="true" /></Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
