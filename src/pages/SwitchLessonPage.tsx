import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Code2, Terminal } from 'lucide-react'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_SWITCH_CONFIG, simulateSwitchProgram, validateSwitchConfig, type SwitchConfig, type SwitchCase } from '../domain/switchBranching'
import { SWITCH_CHALLENGES, evaluateSwitchChallenge, switchChallengeSource, type SwitchChallengeId } from '../data/switchChallenges'

const LESSON_ID = 'conditionals-switch' as const
const phaseLabels = {
  'enter-main': '進入 main', initialize: '建立 choice', 'evaluate-switch': '求值 switch',
  'select-case': '匹配入口', 'print-case': '輸出分支內容', break: '離開 switch',
  'fall-through': '接續下一個分支', 'after-switch': '輸出 Done',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
const caseLabel = (value: SwitchCase | null) => value === 'case-1' ? 'case 1' : value === 'case-2' ? 'case 2' : value === 'default' ? 'default' : '尚未選擇'
function readConfig(value: unknown): SwitchConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SWITCH_CONFIG }
  const config = value as SwitchConfig
  return validateSwitchConfig(config).length ? { ...DEFAULT_SWITCH_CONFIG } : { choice: config.choice, mode: config.mode }
}

export function SwitchLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<SwitchChallengeId>(SWITCH_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<SwitchChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<SwitchChallengeId, { solved: boolean; message: string }>>>({})
  const numberRef = useRef<HTMLInputElement>(null)
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const syncRef = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateSwitchProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = SWITCH_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    if (numberRef.current) numberRef.current.value = String(config.choice)
  }, [config.choice])
  useEffect(() => {
    const previous = syncRef.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    syncRef.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey)))
      setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(SWITCH_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: SwitchConfig) => {
    const valid = validateSwitchConfig(next).length === 0
    setConfig(next); setPrediction(''); setSubmitted(null); setError('')
    setUnlocked(lesson.guidedRunCompleted || !valid)
    if (valid) { syncRef.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = prediction.trim() === '' ? NaN : Number(prediction)
    if (!Number.isInteger(value) || value < 0) { setError('請輸入非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls switch-controls">
    <h2>選擇入口與跳出方式</h2>
    <div className="functions-number-control"><label htmlFor="switch-choice">選擇值 choice</label><p>0 到 4 的整數；只有 1、2 有對應 case。</p>
      <input ref={numberRef} id="switch-choice" type="number" min={0} max={4} step={1} defaultValue={config.choice}
        onChange={event => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) changeConfig({ ...config, choice: Number(event.target.value) }) }}
        onBlur={event => { event.currentTarget.value = String(config.choice) }} />
    </div>
    <fieldset><legend>case 後的 break</legend>
      <label><input type="radio" name="switch-mode" checked={config.mode === 'with-break'} onChange={() => changeConfig({ ...config, mode: 'with-break' })} />保留 break</label>
      <label><input type="radio" name="switch-mode" checked={config.mode === 'fall-through'} onChange={() => changeConfig({ ...config, mode: 'fall-through' })} />省略 break（fall-through）</label>
    </fieldset>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_SWITCH_CONFIG })}>恢復預設值</button>
    <p>switch 接受整數型別的運算式；case 是整數常數標籤。它們不是每輪重新判斷的 if。</p>
  </div>

  return <div className="switch-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ switch、case 與 break</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 02 · LESSON 02</span><h1>選好入口，<br />再決定何時離開。</h1><p>switch 先匹配入口。break 決定是否離開；省略它，程式就會接續往下執行。</p></div>
        <aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>匹配一次，從入口往下走。</h2><p>case 1、case 2 是入口標籤；沒有匹配時從 default 進入。break 會離開最近的 switch。省略 break 後，即使下一個 case 不符合 choice，也會接續執行；這種流程稱為 fall-through。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card">
      <div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>switch 區塊內會印幾行？</h2><p>目前 choice = {config.choice}，{config.mode === 'with-break' ? '保留' : '省略'} break。不計算區塊外的 Done。</p></div>
      {simulation.status === 'completed' ? <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="switch-prediction">預測區塊內輸出行數</label><div><input id="switch-prediction" type="number" min={0} step={1} value={prediction} onChange={event => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form> : <p>設定超出練習範圍，可直接逐步觀察安全停止。</p>}
      {submitted !== null && <p role="status">{frame.afterSwitch ? `你預測 ${submitted} 行，實際 ${simulation.output.length - 1} 行。${submitted === simulation.output.length - 1 ? '預測正確！' : '再觀察 break 如何改變路徑。'}` : '預測已記錄，執行到 Done 時揭曉。'}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>追蹤入口與目前執行的分支</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="switch 控制"
        playback={unlocked ? <PlaybackControls controlName="switch 執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} title={<><Code2 size={17} aria-hidden="true" /> C 程式碼</>} status={phaseLabels[frame.phase]} />
        <section className="switch-execution lab-panel" aria-labelledby="switch-memory-title"><h2 id="switch-memory-title">入口不變，執行位置可以往下走。</h2>
          <dl className="switch-state"><div><dt>choice</dt><dd aria-label={`choice，${frame.memory.choice === null ? '尚未宣告' : frame.memory.inScope ? frame.memory.choice : '離開作用域'}`}>{frame.memory.choice !== null && frame.memory.inScope ? frame.memory.choice : '—'}</dd></div><div><dt>匹配的入口</dt><dd>{caseLabel(frame.selectedCase)}</dd></div><div><dt>目前分支</dt><dd>{frame.afterSwitch ? '已離開 switch' : caseLabel(frame.activeCase)}</dd></div></dl>
          <ol className="switch-cases" aria-label="switch 分支位置">{(['case-1', 'case-2', 'default'] as const).map(item => <li key={item} aria-current={frame.activeCase === item ? 'step' : undefined}>{caseLabel(item)}{frame.selectedCase === item && <small>匹配入口</small>}{frame.activeCase === item && <strong>目前位置</strong>}</li>)}</ol>
          <div className="switch-console"><h3><Terminal size={16} aria-hidden="true" /> printf 輸出</h3><ol aria-label="printf 輸出行">{frame.output.map((line, index) => <li key={index}><code>{line}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，驗證分支路徑。</h2>
      <ChallengePanel challenges={SWITCH_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="switch 學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><pre>{switchChallengeSource(item.id)}</pre>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateSwitchChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`answer-${item.id}`}>完整輸出（依序輸入，含 Done）</label><input id={`answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} placeholder="以空白或逗號分隔" /><button className="button button-primary" type="submit">檢查輸出</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>default 也可能由上方接續進入。</h2><p>沒有 case 匹配時，default 是入口；省略 break 時，也可能從前一個 case 一路執行到 default。switch 的 break 只離開 switch，之後仍會印出 Done。</p>{count === 3 && <p role="status">你已完成 switch、case 與 break。</p>}<div><Link className="button button-secondary" to="/learn/conditionals/if-else">上一課：if 與 else</Link><Link className="button button-primary" to="/learn/loops/for">下一課：for 迴圈 <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
