import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_CONST_POINTER_CONFIG, simulateConstPointerProgram, validateConstPointerConfig, type ConstPointerConfig, type ConstPointerPhase, CONST_POINTER_KINDS, CONST_POINTER_OPERATIONS } from '../domain/constPointers'
import { CONST_POINTER_CHALLENGES, evaluateConstPointerChallenge, type ConstPointerChallengeId } from '../data/constPointerChallenges'

const LESSON_ID = 'pointers-const' as const
const phaseLabels: Record<ConstPointerPhase, string> = {
  'check-program': '檢查 const 賦值規則', 'enter-main': '進入 main', 'initialize-x': '初始化 x', 'initialize-y': '初始化 y',
  'bind-pointer': '初始化 p', 'write-through': '透過指標改值', rebind: '改變指標指向', 'direct-write': '直接改寫 x',
  print: '輸出三個值', 'return-main': 'main 回傳', done: '執行完成', blocked: '尚未進入執行期',
}
function readConfig(value: unknown): ConstPointerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_CONST_POINTER_CONFIG }
  const config = value as ConstPointerConfig
  return validateConstPointerConfig(config).length ? { ...DEFAULT_CONST_POINTER_CONFIG } : { kind: config.kind, operation: config.operation, target: config.target }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 3 && tokens.every(token => /^-?\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}

export function ConstPointerLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<ConstPointerChallengeId>(CONST_POINTER_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<ConstPointerChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<ConstPointerChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateConstPointerProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = CONST_POINTER_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(CONST_POINTER_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: ConstPointerConfig) => {
    if (validateConstPointerConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請輸入 x、y、*p 的三個整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
    visitLesson(LESSON_ID)
  }
  const kind = CONST_POINTER_KINDS[config.kind]
  const canPlay = unlocked || simulation.status !== 'completed'
  const controls = <div className="pointers-controls const-pointer-controls"><h2>選擇宣告與操作</h2>
    <label htmlFor="const-pointer-kind">指標宣告</label><select id="const-pointer-kind" value={config.kind} onChange={event => changeConfig({ ...config, kind: event.target.value as ConstPointerConfig['kind'] })}>{Object.entries(CONST_POINTER_KINDS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="const-pointer-target">初始指向</label><select id="const-pointer-target" value={config.target} onChange={event => changeConfig({ ...config, target: event.target.value as ConstPointerConfig['target'] })}><option value="x">x（初始值 10）</option><option value="y">y（初始值 20）</option></select>
    <label htmlFor="const-pointer-operation">準備執行的操作</label><select id="const-pointer-operation" value={config.operation} onChange={event => changeConfig({ ...config, operation: event.target.value as ConstPointerConfig['operation'] })}>{Object.entries(CONST_POINTER_OPERATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_CONST_POINTER_CONFIG })}>恢復預設值</button>
    <p>此宣告{kind.canWrite ? '允許' : '不允許'}透過 *p 寫入，{kind.canRebind ? '允許' : '不允許'}重新指定 p。x、y 本身都是一般 int。</p>
  </div>
  return <div className="const-pointer-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 指標與 const</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 06 · LESSON 06</span><h1>限制透過它改值，<br />還是固定它的指向？</h1><p>比較四種宣告，分開觀察 *p 的寫入限制與 p 的重新指定。操作不符合 const 規則時，整個程式不進入執行期。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>先分開看：指向的資料，與指標本身。</h2><p>const int *p 限制透過 p 改值，p 仍可改指向；int *const p 固定 p 本身，仍可透過 *p 改值。兩個 const 同時出現，就同時限制這兩種操作。</p>
      <div className="const-pointer-table-scroll" role="region" tabIndex={0} aria-label="四種指標宣告比較，可水平捲動"><table className="const-pointer-table"><caption>初始化 p 之後，哪些賦值操作有效？</caption><thead><tr><th scope="col">宣告</th><th scope="col">透過 *p 改值</th><th scope="col">重新指定 p</th></tr></thead><tbody>{Object.entries(CONST_POINTER_KINDS).map(([value, item]) => <tr key={value} className={config.kind === value ? 'is-selected' : ''}><th scope="row"><code>{item.declaration}</code>{config.kind === value && <small>目前宣告</small>}</th><td>{item.canWrite ? '可以' : '不可以'}</td><td>{item.canRebind ? '可以' : '不可以'}</td></tr>)}</tbody></table></div>
    </section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>{simulation.status === 'completed' ? '最後的 x、y、*p 會是多少？' : '這個操作符合 const 規則嗎？'}</h2><p>{simulation.status === 'completed' ? '先留下三個值的預測，再看指向和原變數如何改變。' : '這組設定不符合 const 賦值規則，直接用單步查看原因；不會先執行宣告，再到錯誤那一行才停止。'}</p></div>
      {simulation.status === 'completed' && <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="const-pointer-prediction">預測 x、y、*p</label><div><input id="const-pointer-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="三個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>}
      {submitted !== null && simulation.status === 'completed' && <p role="status">{frame.printedValues === null ? '預測已記錄，printf 執行時揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.printedValues.join('、')}。${submitted.every((value, index) => value === frame.printedValues![index]) ? '預測正確！' : '分清這一步改的是原變數，還是 p 的指向。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>宣告限制操作，指向連到原變數。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="const 指標控制"
        playback={canPlay ? <PlaybackControls controlName="const 指標執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="const-pointer-execution lab-panel" aria-label="指標與原變數">
          <p aria-label="執行階段">{frame.phase === 'done' ? 'main 已結束。' : frame.mainInScope ? '正在執行 main。' : 'main 尚未開始，沒有建立執行期變數。'}</p>
          <dl className="const-pointer-values">{(['x', 'y'] as const).map(name => <div key={name} className={frame.activeTarget === name ? 'is-active' : ''}><dt>{name}</dt><dd aria-label={name + ' 的值'}>{frame.mainInScope ? frame.values[name] ?? '—' : '—'}</dd><small>{frame.phase === 'done' ? '離開作用域' : frame.values[name] === null ? '尚未建立' : '一般 int，可直接改值'}</small></div>)}</dl>
          <div className={'const-pointer-binding ' + (frame.activeTarget === 'p' ? 'is-active' : '')}><h3>p</h3><code>{kind.declaration}</code><p aria-label="p 的指向">{!frame.mainInScope || frame.target === null ? frame.phase === 'done' ? 'p 已離開作用域' : 'p 尚未建立' : `p → ${frame.target}`}</p>
            <p aria-label="目前解參照值">{frame.mainInScope && frame.target !== null ? `此刻讀取 *p 會得到 ${frame.values[frame.target]}。` : '尚無可讀取的指向。'}</p>
          </div>
          <p>格子的外框標記這一步主要改變的變數。p 的指向用變數名稱表示，不使用虛構的實際位址。</p>
          {simulation.status === 'compile-error' && <p>此程式違反 const 賦值規則：沒有 printf 輸出，也沒有先前語句的執行結果。</p>}
          <div className="const-pointer-console"><h3>printf 輸出</h3><ol aria-label="const 指標輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{canPlay ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，找出 const 限制哪一邊。</h2>
      <ChallengePanel challenges={CONST_POINTER_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="const 指標學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{CONST_POINTER_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateConstPointerChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`const-pointer-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`const-pointer-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>限制透過哪個名稱寫入，不是複製資料。</h2><p>本課 x、y 都是一般 int。即使 p 宣告為 const int *p，也能直接修改 x；p 仍指向 x 時，之後讀取 *p 就會得到新值。這和透過 *p 寫入是不同的操作。</p>{count === 3 && <p role="status">你已完成指標與 const。</p>}<div><Link className="button button-secondary" to="/learn/pointers/array-parameters">上一課：陣列作為函式參數</Link><Link className="button button-primary" to="/learn/structures/basics">下一章：結構與成員存取</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
