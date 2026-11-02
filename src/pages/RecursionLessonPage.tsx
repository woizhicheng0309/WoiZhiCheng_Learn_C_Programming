import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_RECURSION_CONFIG, simulateRecursionProgram, validateRecursionConfig, type RecursionConfig, type RecursionPhase } from '../domain/recursion'
import { RECURSION_CHALLENGES, evaluateRecursionChallenge, type RecursionChallengeId } from '../data/recursionChallenges'

const LESSON_ID = 'functions-recursion' as const
const phaseLabels: Record<RecursionPhase, string> = {
  'enter-main': '進入 main', call: '呼叫下一層', 'enter-function': '建立呼叫框架',
  'check-base': '判斷終止條件', 'return-base': '回傳基本值', receive: '接收回傳值',
  multiply: '計算本層結果', 'return-result': '回傳本層結果', 'main-result': '回到 main',
  print: '輸出答案', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): RecursionConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_RECURSION_CONFIG }
  const config = value as RecursionConfig
  return validateRecursionConfig(config).length ? { ...DEFAULT_RECURSION_CONFIG } : { n: config.n }
}

export function RecursionLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<RecursionChallengeId>(RECURSION_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<RecursionChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<RecursionChallengeId, { solved: boolean; message: string }>>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateRecursionProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: config.n })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = RECURSION_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => { if (inputRef.current) inputRef.current.value = String(config.n) }, [config.n])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey)))
      setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(RECURSION_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: RecursionConfig) => {
    const valid = validateRecursionConfig(next).length === 0
    setConfig(next); setPrediction(''); setSubmitted(null); setError('')
    setUnlocked(lesson.guidedRunCompleted || !valid)
    if (valid) { sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = prediction.trim() === '' ? NaN : Number(prediction)
    if (!Number.isSafeInteger(value) || value < 0) { setError('請輸入非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls">
    <h2>從哪一個 n 開始？</h2><label htmlFor="recursion-n">起始值 n</label>
    <input ref={inputRef} id="recursion-n" type="number" min={0} max={6} step={1} defaultValue={config.n}
      onChange={event => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) changeConfig({ n: Number(event.target.value) }) }}
      onBlur={event => { event.currentTarget.value = String(config.n) }} />
    <p>本練習接受 0 到 6，讓呼叫堆疊容易追蹤，且結果可由標準 C 的 int 表示。</p>
    <div className="recursion-presets"><button onClick={() => changeConfig({ n: 0 })}>直接到終止條件</button><button onClick={() => changeConfig({ n: 3 })}>追蹤三層呼叫</button><button onClick={() => changeConfig({ ...DEFAULT_RECURSION_CONFIG })}>恢復預設值</button></div>
    <p>必須有能到達的終止條件。C 不會替你自動補上；持續呼叫可能耗盡可用的呼叫堆疊空間。</p>
  </div>

  return <div className="recursion-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 遞迴與呼叫堆疊</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 04 · LESSON 02</span><h1>先往下一層，<br />再把答案帶回來。</h1><p>用 factorial 理解遞迴：每次呼叫保留自己的參數與區域變數，等更小的問題完成，再繼續計算。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>每一層，都有自己的 n。</h2><p>n ≤ 1 時直接回傳 1；否則先取得 factorial(n − 1)，再乘上本層的 n。下層不會改掉上層的參數。呼叫堆疊在此是執行流程的示意，不代表實際記憶體位址或編譯器配置。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>factorial({config.n}) 會回傳多少？</h2><p>先預測結果，再追蹤終止條件與每層回傳。</p></div>
      {simulation.status === 'completed' ? <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="recursion-prediction">預測回傳值</label><div><input id="recursion-prediction" type="number" min={0} step={1} value={prediction} onChange={event => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form> : <p>設定超出練習範圍，可直接逐步觀察安全停止。</p>}
      {submitted !== null && <p role="status">{frame.answer === null ? '預測已記錄，回到 main 收到答案時揭曉。' : `你預測 ${submitted}，實際回傳 ${frame.answer}。${submitted === frame.answer ? '預測正確！' : '再沿著每一層回傳追蹤一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>看見呼叫暫停，也看見回傳接續。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="遞迴控制"
        playback={unlocked ? <PlaybackControls controlName="遞迴執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="recursion-execution lab-panel" aria-labelledby="recursion-stack-title"><h2 id="recursion-stack-title">呼叫堆疊</h2><p>由下往上建立；最上方為目前執行的函式。</p>
          <ol className="recursion-stack" aria-label="factorial 呼叫框架">{[...frame.stack].reverse().map((item, index) => <li key={item.id} aria-current={index === 0 ? 'step' : undefined}>
            <h3>factorial({item.n}) <small>呼叫 #{item.id} · {index === 0 ? '目前執行' : '等待下層回傳'}</small></h3>
            <dl><div><dt>n</dt><dd>{item.n}</dd></div><div><dt>previous</dt><dd>{item.previous ?? '—'}</dd></div><div><dt>result</dt><dd>{item.result ?? '—'}</dd></div><div><dt>回傳值</dt><dd>{item.returnValue ?? '—'}</dd></div></dl>
          </li>)}</ol>{!frame.stack.length && <p>目前沒有 factorial 呼叫框架。</p>}
          <div className="recursion-main"><h3>main</h3><p>answer：<strong aria-label={`answer，${!frame.mainInScope ? '離開作用域' : frame.answer === null ? '等待回傳' : frame.answer}`}>{frame.mainInScope && frame.answer !== null ? frame.answer : '—'}</strong></p></div>
          <div className="recursion-console"><h3>printf 輸出</h3><ol aria-label="遞迴輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，連起呼叫與回傳。</h2>
      <ChallengePanel challenges={RECURSION_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="遞迴學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{RECURSION_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <pre>{simulation.source.sourceText.split('\n').slice(2, 10).join('\n')}</pre>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateRecursionChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`recursion-${item.id}`}>你的答案</label><input id={`recursion-${item.id}`} type="number" min={0} step={1} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>深入時保留狀態，回傳時繼續工作。</h2><p>呼叫下一層前，本層先暫停；下層回傳後，才賦值 previous、計算 result，再回傳給上一層。終止條件讓這條路徑能走回 main。</p>{count === 3 && <p role="status">你已完成遞迴與呼叫堆疊。</p>}<div><Link className="button button-secondary" to="/learn/functions/basics">上一課：函式基礎</Link><Link className="button button-primary" to="/learn/arrays/basics">下一課：陣列、索引與字串</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
