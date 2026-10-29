import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowRightLeft, Check, ChevronRight, Code2, Terminal, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import {
  DEFAULT_SWAP_CONFIG, SWAP_LIMITS, simulateSwapProgram, validateSwapConfig,
  type SwapConfig, type SwapFrame, type SwapMode, type SwapPhase,
} from '../domain/swap'
import {
  SWAP_CHALLENGES, evaluatePointerCall, evaluateSwapTemp, evaluateValueSwap, type SwapChallengeId,
} from '../data/swapChallenges'

const LESSON_ID = 'pointers-swap' as const
type Feedback = { solved: boolean; message: string }
const phaseLabels: Record<SwapPhase, string> = {
  'enter-main': '進入 main', 'init-x': '建立 x', 'init-y': '建立 y', 'call-swap': '呼叫 swap',
  'bind-parameters': '複製引數到參數', 'save-temp': '保存原值', 'write-first': '第一次改寫',
  'write-second': '第二次改寫', 'return-swap': '回到 main', print: '輸出 main 的值',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}

function readConfig(value: unknown): SwapConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SWAP_CONFIG }
  const candidate = value as SwapConfig
  return validateSwapConfig(candidate).length === 0
    ? { x: candidate.x, y: candidate.y, mode: candidate.mode } : { ...DEFAULT_SWAP_CONFIG }
}

function NumberControl({ name, value, onChange }: { name: 'x' | 'y'; value: number; onChange: (value: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== String(value)) inputRef.current.value = String(value)
  }, [value])
  return <div className="functions-number-control">
    <div className="functions-control-label"><label htmlFor={`swap-${name}`}>{name} 的初始值</label><small>{SWAP_LIMITS.min} 到 {SWAP_LIMITS.max} 的整數</small></div>
    <input ref={inputRef} id={`swap-${name}`} type="number" step={1} min={SWAP_LIMITS.min} max={SWAP_LIMITS.max} defaultValue={value}
      onChange={(event) => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) onChange(Number(event.target.value)) }}
      onBlur={(event) => { event.currentTarget.value = String(value) }} />
  </div>
}

function SwapMemory({ frame, mode }: { frame: SwapFrame; mode: SwapMode }) {
  const mainStatus = frame.memory.main.status
  const swapStatus = frame.memory.swap.status
  const callerLabel = mainStatus === 'suspended' ? '暫停，等待 swap 回來' : mainStatus === 'returned' ? '已結束，變數離開作用域' : '執行中'
  const calleeLabel = swapStatus === 'not-created' ? '尚未呼叫' : swapStatus === 'returned' ? '已回傳，區域變數離開作用域' : '執行中'
  return <section className="swap-memory lab-panel" aria-labelledby="swap-memory-title">
    <div className="pointers-panel-heading"><small>CALLER & CALLEE</small><h2 id="swap-memory-title">兩個函式，各有自己的記憶格。</h2></div>
    <p className="pointers-address-note">{mode === 'pointer' ? '參數中的 &x、&y 是複製的位址，以符號示意。a、b 是 swap 的區域指標，解參照後存取 main 的 x、y。' : '參數 a、b 收到整數值的副本。改變副本，main 的 x、y 仍保留原本的值。'}</p>
    <div className={`swap-scope${mainStatus === 'active' ? ' is-active' : ''}`} aria-label={`main 記憶體，${callerLabel}`}>
      <header><code>main</code><span>{callerLabel}</span></header>
      <div className="swap-cells">
        {(['x', 'y'] as const).map((name) => {
          const value = mainStatus === 'returned' ? '離開作用域' : frame.memory.main[name] === null ? '尚未建立' : String(frame.memory.main[name])
          return <div key={name} className={`swap-cell${frame.changedVariable === name ? ' is-changed' : ''}`} aria-label={`main 的 ${name}，${value}`}>
            <code>{name}</code><strong>{mainStatus !== 'returned' ? frame.memory.main[name] ?? '—' : '—'}</strong>
            <small>{mode === 'pointer' ? `${name} 的位址：&${name}` : '呼叫端變數'}</small>
          </div>
        })}
      </div>
    </div>
    <div className={`swap-scope${swapStatus === 'active' ? ' is-active' : ''}${swapStatus === 'returned' ? ' is-returned' : ''}`} aria-label={`swap 記憶體，${calleeLabel}`}>
      <header><code>swap</code><span>{calleeLabel}</span></header>
      <div className="swap-cells swap-cells--three">
        {(['a', 'b', 'temp'] as const).map((name) => {
          const rawValue = frame.memory.swap[name]
          const value = swapStatus === 'not-created' ? '尚未建立' : swapStatus === 'returned' ? '離開作用域' : rawValue === null ? '尚未賦值' : String(rawValue)
          const address = mode === 'pointer' && name !== 'temp'
          return <div key={name} className={`swap-cell${frame.changedVariable === name ? ' is-changed' : ''}${address ? ' is-address' : ''}`} aria-label={`swap 的 ${name}，${value}`}>
            <code>{name}</code><strong>{swapStatus === 'active' ? rawValue ?? '—' : '—'}</strong>
            <small>{name === 'temp' ? '保存原值' : address ? '位址的副本' : '整數值的副本'}</small>
          </div>
        })}
      </div>
    </div>
    <div className="pointers-console" aria-label="交換程式輸出"><span><Terminal size={16} aria-hidden="true" /> main 的 printf 輸出</span><code>{frame.outputText ?? '尚無輸出'}</code></div>
  </section>
}

export function PointerSwapLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lessonProgress.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lessonProgress.guidedRunCompleted)
  const [predictionX, setPredictionX] = useState('')
  const [predictionY, setPredictionY] = useState('')
  const [prediction, setPrediction] = useState<{ x: number; y: number } | null>(null)
  const [predictionError, setPredictionError] = useState('')
  const [activeChallenge, setActiveChallenge] = useState<SwapChallengeId>(() => SWAP_CHALLENGES.find((challenge) => !lessonProgress.completedChallengeIds.includes(challenge.id))?.id ?? SWAP_CHALLENGES[0].id)
  const [challengeX, setChallengeX] = useState('')
  const [challengeY, setChallengeY] = useState('')
  const [callAnswer, setCallAnswer] = useState<'addresses' | 'values' | null>(null)
  const [tempAnswer, setTempAnswer] = useState<'both-nine' | 'swapped' | null>(null)
  const [feedback, setFeedback] = useState<Partial<Record<SwapChallengeId, Feedback>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const syncRef = useRef({ savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId })
  const resettingProgressRef = useRef(false)
  const simulation = useMemo(() => simulateSwapProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = useMemo(() => simulation.source.lines.map((line) => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] })), [simulation.source])
  const completedCount = SWAP_CHALLENGES.filter((challenge) => lessonProgress.completedChallengeIds.includes(challenge.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = syncRef.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    syncRef.current = { savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId }
    resettingProgressRef.current = previous.savedKey !== savedKey || cleared
    if (resettingProgressRef.current) {
      setConfig(readConfig(JSON.parse(savedKey)))
      setPredictionX('')
      setPredictionY('')
      setPrediction(null)
      setPredictionError('')
      setUnlocked(lessonProgress.guidedRunCompleted)
      if (cleared) { resetPlayer(); setFeedback({}); setActiveChallenge(SWAP_CHALLENGES[0].id) }
    } else if (previous.guided !== lessonProgress.guidedRunCompleted) setUnlocked(lessonProgress.guidedRunCompleted)
  }, [savedKey, lessonProgress.guidedRunCompleted, hasLesson, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resettingProgressRef.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: SwapConfig) => {
    setConfig(next)
    setPredictionX('')
    setPredictionY('')
    setPrediction(null)
    setPredictionError('')
    const valid = validateSwapConfig(next).length === 0
    setUnlocked(lessonProgress.guidedRunCompleted || !valid)
    if (valid) { syncRef.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const numericAnswer = (value: string) => value.trim() === '' ? null : Number(value)
  const submitPrediction = (event: FormEvent) => {
    event.preventDefault()
    const x = numericAnswer(predictionX)
    const y = numericAnswer(predictionY)
    if (x === null || y === null || !Number.isInteger(x) || !Number.isInteger(y)) {
      setPredictionError('請先輸入兩個整數作為預測。'); return
    }
    setPredictionError('')
    setPrediction({ x, y })
    setUnlocked(true)
    player.reset()
  }
  const completeChallenge = (id: SwapChallengeId, evaluation: Feedback) => {
    setFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) markChallengeCompleted(LESSON_ID, id)
  }
  const controls = <div className="pointers-controls swap-controls">
    <h2>比較兩種呼叫方式</h2>
    <fieldset><legend>交換方式</legend>
      <label><input type="radio" name="swap-mode" checked={config.mode === 'value'} onChange={() => changeConfig({ ...config, mode: 'value' })} />傳入整數值：swap(x, y)</label>
      <label><input type="radio" name="swap-mode" checked={config.mode === 'pointer'} onChange={() => changeConfig({ ...config, mode: 'pointer' })} />傳入位址：swap(&amp;x, &amp;y)</label>
    </fieldset>
    {(['x', 'y'] as const).map((name) => <NumberControl key={name} name={name} value={config[name]} onChange={(value) => changeConfig({ ...config, [name]: value })} />)}
    <button className="functions-restore-button" type="button" onClick={() => changeConfig({ ...DEFAULT_SWAP_CONFIG })}>恢復預設值</button>
    <p className="swap-copy-note">C 一律以值傳遞。傳入位址時，參數收到的是位址的副本，仍可藉此存取原本的變數。</p>
  </div>
  const challengeItems = SWAP_CHALLENGES.map((challenge, index) => ({ id: challenge.id, label: challenge.title, eyebrow: `CHALLENGE 0${index + 1}`, completed: lessonProgress.completedChallengeIds.includes(challenge.id) }))

  return <div className="swap-page pointers-page functions-page lab-page">
    <section className="swap-hero pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" /><span>指標參數與交換變數</span></nav>
      <div className="functions-hero__layout"><div className="functions-hero__copy">
        <Link className="back-link" to="/learn"><ArrowLeft size={16} aria-hidden="true" />回到課程地圖</Link><span className="section-kicker">MODULE 06 · LESSON 02</span>
        <h1>交換的是副本，<br />還是原本的變數？</h1><p>同樣呼叫 swap，為什麼結果不同？從複製整數到複製位址，逐步看懂指標參數與交換變數。</p>
      </div><aside className={`lesson-status-card${completedCount === 3 ? ' complete' : ''}`} aria-label="本單元學習進度">
        <div><Trophy size={21} aria-hidden="true" /><span>{completedCount === 3 ? '單元完成' : '學習進度'}</span></div><strong>{completedCount}<small>/3</small></strong><p>通過三題即可完成這個單元</p>
      </aside></div>
    </div></section>
    <section className="functions-overview page-width" aria-labelledby="swap-goals-title"><div className="functions-objectives">
      <span className="section-kicker">LEARNING GOALS</span><h2 id="swap-goals-title">值會複製，指向可以相同。</h2>
      <ul><li><Check size={17} aria-hidden="true" />追蹤呼叫端與被呼叫端的不同記憶格。</li><li><Check size={17} aria-hidden="true" />看懂指標參數收到位址的副本。</li><li><Check size={17} aria-hidden="true" />理解 temp 為什麼需要先保存原值。</li></ul>
    </div><div className="functions-concepts">
      <article><span><Code2 size={20} aria-hidden="true" /></span><small>01 · 整數值的副本</small><h3>a、b 不是 x、y</h3><p><code>swap(x, y)</code> 把值複製給參數。交換區域變數 a、b，不會改變呼叫端的 x、y。</p></article>
      <article><span><ArrowRight size={20} aria-hidden="true" /></span><small>02 · 位址的副本</small><h3>*a、*b 找到原變數</h3><p><code>swap(&amp;x, &amp;y)</code> 搭配指標參數，透過解參照改寫 main 的記憶格。</p></article>
      <article><span><ArrowRightLeft size={20} aria-hidden="true" /></span><small>03 · 暫存原值</small><h3>先保存，再覆寫</h3><p>先用 temp 保存第一個值，才不會在第一次賦值後遺失原本的資料。</p></article>
    </div></section>
    <section className="functions-prediction-section" aria-labelledby="swap-prediction-title"><div className="page-width functions-prediction-card">
      <div className="functions-prediction-card__copy"><span className="section-kicker">PREDICT BEFORE RUN</span><h2 id="swap-prediction-title">回到 main 後，x、y 會是多少？</h2><p>目前 x = {config.x}、y = {config.y}，{config.mode === 'value' ? '傳入整數值' : '傳入位址'}。答案會等 main 的 printf 執行後才揭曉。</p></div>
      {simulation.validationIssues.length === 0 && <form className="functions-prediction-form swap-prediction-form" onSubmit={submitPrediction}>
        <div><label htmlFor="swap-prediction-x">預測 main 最後的 x</label><input id="swap-prediction-x" type="number" step={1} value={predictionX} onChange={(event) => setPredictionX(event.target.value)} /></div>
        <div><label htmlFor="swap-prediction-y">預測 main 最後的 y</label><input id="swap-prediction-y" type="number" step={1} value={predictionY} onChange={(event) => setPredictionY(event.target.value)} /></div>
        <button className="button button-primary" type="submit">提交交換預測 <ArrowRight size={17} aria-hidden="true" /></button>
        {predictionError && <p role="alert" className="functions-form-error">{predictionError}</p>}
      </form>}
      {prediction && <p className="pointers-prediction-feedback" role="status">{frame.outputText === null ? '預測已記錄。等 main 執行 printf 後揭曉。' : `你預測 x = ${prediction.x}、y = ${prediction.y}；main 實際 x = ${frame.memory.main.x}、y = ${frame.memory.main.y}。${prediction.x === frame.memory.main.x && prediction.y === frame.memory.main.y ? '預測正確！' : '比較 a、b 與 x、y 的變化，再試一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section" aria-labelledby="swap-lab-title"><div className="page-width">
      <div className="functions-section-heading"><span className="section-kicker">FOLLOW THE CALL</span><h2 id="swap-lab-title">進入 swap，再帶著理解回來。</h2><p>亮框代表本步改變的變數；swap 執行時，main 暫停等待。觀察交換後哪一組記憶格真的變了。</p></div>
      <LabShell className="functions-lab-shell pointers-lab-shell swap-lab-shell" controls={controls} controlsLabel="交換實驗控制"
        playback={unlocked ? <PlaybackControls controlName="交換執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p className="functions-player-lock" role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><div><small>STEP {player.frameIndex + 1} / {simulation.frames.length}</small><strong>{phaseLabels[frame.phase]}</strong></div><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p className="functions-blocked-message" role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} title={<><Code2 size={17} aria-hidden="true" />C 程式碼</>} status={phaseLabels[frame.phase]} />
        <SwapMemory frame={frame} mode={config.mode} />
      </LabShell>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? `${phaseLabels[frame.phase]}。${frame.explanation}` : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width" aria-labelledby="swap-challenges-title">
      <div className="functions-section-heading"><span className="section-kicker">TRY IT YOURSELF</span><h2 id="swap-challenges-title">三個挑戰，追清楚每一份副本。</h2></div>
      <ChallengePanel challenges={challengeItems} activeId={activeChallenge} onSelect={setActiveChallenge} label="交換學習挑戰">
        {(challenge) => <div className="pointers-challenge-content"><h3>{challenge.label}</h3><p>{SWAP_CHALLENGES.find((item) => item.id === challenge.id)?.description}</p>
          {challenge.id === 'predict-value-swap' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateValueSwap(numericAnswer(challengeX), numericAnswer(challengeY))) }}>
            <pre className="functions-challenge-code">{'int x = 5, y = 9;\nswap(x, y); /* int a、int b 參數 */\nprintf("%d %d", x, y);'}</pre>
            <label htmlFor="swap-challenge-x">值交換後 main 的 x</label><input id="swap-challenge-x" type="number" step={1} value={challengeX} onChange={(event) => setChallengeX(event.target.value)} />
            <label htmlFor="swap-challenge-y">值交換後 main 的 y</label><input id="swap-challenge-y" type="number" step={1} value={challengeY} onChange={(event) => setChallengeY(event.target.value)} />
            <button className="button button-primary" type="submit">檢查值交換答案</button>
          </form>}
          {challenge.id === 'choose-pointer-call' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluatePointerCall(callAnswer)) }}>
            <pre className="functions-challenge-code">{'void swap(int *a, int *b);\nint x = 5, y = 9;\n/* 如何呼叫，才能改寫 x、y？ */'}</pre>
            <fieldset><legend>指標參數應該收到什麼？</legend>
              <label><input type="radio" name="swap-call-answer" checked={callAnswer === 'values'} onChange={() => setCallAnswer('values')} />swap(x, y) · 傳入整數值</label>
              <label><input type="radio" name="swap-call-answer" checked={callAnswer === 'addresses'} onChange={() => setCallAnswer('addresses')} />swap(&amp;x, &amp;y) · 傳入位址</label>
            </fieldset><button className="button button-primary" type="submit">檢查呼叫方式</button>
          </form>}
          {challenge.id === 'preserve-swap-temp' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateSwapTemp(tempAnswer)) }}>
            <pre className="functions-challenge-code">{'/* x = 5, y = 9, a = &x, b = &y */\n*a = *b;\n*b = *a; /* 少了 temp */'}</pre>
            <fieldset><legend>執行這兩行後，x、y 變成什麼？</legend>
              <label><input type="radio" name="swap-temp-answer" checked={tempAnswer === 'swapped'} onChange={() => setTempAnswer('swapped')} />x = 9，y = 5 · 成功交換</label>
              <label><input type="radio" name="swap-temp-answer" checked={tempAnswer === 'both-nine'} onChange={() => setTempAnswer('both-nine')} />x = 9，y = 9 · 原本的 5 已遺失</label>
            </fieldset><button className="button button-primary" type="submit">檢查 temp 判斷</button>
          </form>}
          {feedback[challenge.id] && <p className={`functions-challenge-feedback ${feedback[challenge.id]?.solved ? 'is-success' : 'is-hint'}`} role="status">{feedback[challenge.id]?.message}</p>}
        </div>}
      </ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>C 以值傳遞，位址也會被複製。</h2><p>整數副本只能改變區域參數；位址副本讓不同指標找到同一個物件。交換時先保存原值，才能在覆寫後把它放回另一格。</p>
      <div><Link className="button button-secondary" to="/learn/pointers/basics"><ArrowLeft size={17} aria-hidden="true" />上一課：指標、位址與間接存取</Link><Link className="button button-primary" to="/learn">回到課程地圖 <ArrowRight size={17} aria-hidden="true" /></Link></div>
    </section>
  </div>
}
