import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_ARRAY_PARAMETER_CONFIG, simulateArrayParameterProgram, validateArrayParameterConfig, type ArrayParameterConfig, type ArrayParameterPhase } from '../domain/arrayParameters'
import { ARRAY_PARAMETER_CHALLENGES, evaluateArrayParameterChallenge, type ArrayParameterChallengeId } from '../data/arrayParameterChallenges'

const LESSON_ID = 'pointers-array-parameters' as const
const phaseLabels: Record<ArrayParameterPhase, string> = {
  'enter-main': '進入 main', 'initialize-array': '建立原陣列', 'initialize-count': '指定處理數量',
  'call-process': '呼叫 process', 'bind-parameters': '綁定起始位址與數量', 'initialize-sum': '建立函式區域總和',
  'initialize-i': '建立函式迴圈索引', condition: '判斷處理範圍', 'modify-element': '修改共用陣列',
  accumulate: '讀取元素並累加', 'increment-i': '更新函式索引', 'end-loop': '結束函式迴圈',
  'return-process': 'process 回傳', 'assign-answer': 'main 接收回傳值', 'print-answer': '輸出回傳結果',
  'initialize-k': '建立輸出索引', 'print-condition': '判斷輸出範圍', 'print-element': '輸出原陣列',
  'increment-k': '更新輸出索引', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): ArrayParameterConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_ARRAY_PARAMETER_CONFIG }
  const config = value as ArrayParameterConfig
  return validateArrayParameterConfig(config).length ? { ...DEFAULT_ARRAY_PARAMETER_CONFIG } : { sample: config.sample, count: config.count, mode: config.mode }
}
function parsePrediction(value: string): number | null {
  return /^-?\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) ? Number(value) : null
}

export function ArrayParameterLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<ArrayParameterChallengeId>(ARRAY_PARAMETER_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<ArrayParameterChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<ArrayParameterChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateArrayParameterProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = ARRAY_PARAMETER_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(ARRAY_PARAMETER_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: ArrayParameterConfig) => {
    if (validateArrayParameterConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請輸入一個整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
    visitLesson(LESSON_ID)
  }
  const mainLive = frame.mainStatus !== 'returned'
  const calleeLive = frame.calleeStatus === 'active'
  const controls = <div className="pointers-controls array-parameter-controls"><h2>選擇陣列與函式行為</h2>
    <label htmlFor="array-parameter-sample">陣列範例</label><select id="array-parameter-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as ArrayParameterConfig['sample'] })}><option value="positive">正整數：4、7、2、9、5</option><option value="mixed">含負數：−4、2、−1、3、−2</option><option value="zeros">全部為 0</option></select>
    <label htmlFor="array-parameter-count">傳入的 count</label><select id="array-parameter-count" value={config.count} onChange={event => changeConfig({ ...config, count: Number(event.target.value) })}>{Array.from({ length: 6 }, (_, value) => <option key={value} value={value}>{value} 個元素</option>)}</select>
    <fieldset><legend>函式行為</legend><label><input type="radio" name="array-parameter-mode" checked={config.mode === 'read-only'} onChange={() => changeConfig({ ...config, mode: 'read-only' })} />唯讀加總</label><label><input type="radio" name="array-parameter-mode" checked={config.mode === 'modify'} onChange={() => changeConfig({ ...config, mode: 'modify' })} />每格加 2，再加總</label></fieldset>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_ARRAY_PARAMETER_CONFIG })}>恢復預設值</button>
    <p>count 只決定 process 處理前幾格；main 最後仍會輸出完整五格。本課限制 count 在實際容量內，C 不會自動替你驗證範圍。</p>
  </div>
  return <div className="array-parameter-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 陣列作為函式參數</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 06 · LESSON 05</span><h1>陣列交給函式，<br />資料仍在同一處。</h1><p>把起始位址與元素數量交給函式。比較唯讀加總與原地修改，看見參數、區域變數與回傳值各自屬於哪個呼叫框架。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>傳入起始位址，另外交代元素數量。</h2><p>在這個呼叫中，scores 轉成指向第一格的指標。函式參數 int items[] 會調整為 int *items；items 接收位址的副本，沒有複製整個陣列。透過 items 修改元素，也會改到 main 的 scores。</p><p>唯讀版本用 const int items[]，限制透過這個參數寫入元素。count 與 sum 則是 process 自己的變數，並非陣列的一部分。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>這次函式會回傳多少？</h2><p>目前處理前 {config.count} 格，{config.mode === 'read-only' ? '只讀取元素並加總。' : '每個處理到的元素先加 2，再加總。'}答案等 main 接收回傳值時揭曉。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="array-parameter-prediction">預測 process 回傳值</label><div><input id="array-parameter-prediction" inputMode="numeric" value={prediction} onChange={event => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.answer === null ? '預測已記錄，等待函式回傳並完成賦值。' : `你預測 ${submitted}，實際回傳 ${frame.answer}。${submitted === frame.answer ? '預測正確！' : '檢查處理範圍，以及加總前是否先修改了元素。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>兩個呼叫框架，共用同一組陣列。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="陣列參數控制"
        playback={unlocked ? <PlaybackControls controlName="陣列參數執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="array-parameter-execution lab-panel" aria-label="呼叫框架與共用陣列">
          <div className="array-parameter-frames">
            <section className="array-parameter-frame" aria-label="main 呼叫框架"><h3>main</h3><p>{frame.mainStatus === 'active' ? '執行中' : frame.mainStatus === 'suspended' ? '等待 process 回傳' : '已離開作用域'}</p><dl className="array-parameter-state">
              <div><dt>count</dt><dd aria-label="main 的 count">{mainLive ? frame.callerCount ?? '—' : '—'}</dd></div>
              <div><dt>answer</dt><dd aria-label="main 的 answer">{mainLive ? frame.answer ?? '—' : '—'}</dd></div>
              <div><dt>k</dt><dd aria-label={`main 的 k，${frame.kInScope ? frame.k : '不在作用域'}`}>{frame.kInScope ? frame.k : '—'}</dd></div>
            </dl></section>
            <section className="array-parameter-frame" aria-label="process 呼叫框架"><h3>process</h3><p>{frame.calleeStatus === 'not-called' ? '尚未呼叫' : calleeLive ? '執行中' : '已回傳，參數與區域變數離開作用域'}</p>
              <p className="array-parameter-binding" aria-label="items 的指向">{calleeLive ? 'items → scores[0]（同一陣列）' : 'items 不在作用域'}</p><dl className="array-parameter-state">
                <div><dt>count</dt><dd aria-label="process 的 count">{calleeLive ? frame.parameterCount ?? '—' : '—'}</dd></div>
                <div><dt>sum</dt><dd aria-label="process 的 sum">{calleeLive ? frame.sum ?? '—' : '—'}</dd></div>
                <div><dt>i</dt><dd aria-label={`process 的 i，${frame.iInScope ? frame.i : '不在作用域'}`}>{frame.iInScope ? frame.i : '—'}</dd></div>
              </dl>
            </section>
          </div>
          <h3>main 的 scores：五格共用記憶體</h3><div className="array-parameter-scroll" role="region" tabIndex={0} aria-label="scores 記憶格，窄螢幕可水平捲動"><ol className="array-parameter-memory" aria-label="共用 scores 陣列">{Array.from({ length: 5 }, (_, index) => {
            const selected = frame.callerCount !== null && index < frame.callerCount
            const label = !mainLive ? '離開作用域' : frame.scores === null ? '尚未宣告' : selected ? 'process 處理範圍' : 'process 不處理'
            return <li key={index} className={`${selected ? 'is-selected' : ''} ${frame.activeIndex === index ? 'is-active' : ''}`} aria-current={frame.activeIndex === index ? 'step' : undefined}>
              <code>[{index}]</code><strong>{mainLive && frame.scores ? frame.scores[index] : '—'}</strong><small>{label}</small>
            </li>
          })}</ol></div>
          <p>process 已加總 {frame.visitedIndices.length} 格、寫入 {frame.writes} 格；只建立一組 scores，沒有另一份 items 陣列。</p>
          {frame.returnValue !== null && <p aria-label="已傳回的值">回傳值：{frame.returnValue}。{frame.answer === null ? 'main 尚未完成賦值。' : 'main 已存入 answer。'}</p>}
          <div className="array-parameter-console"><h3>printf 輸出</h3><ol aria-label="陣列參數輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清陣列、參數與數量。</h2>
      <ChallengePanel challenges={ARRAY_PARAMETER_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="陣列參數學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{ARRAY_PARAMETER_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateArrayParameterChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`array-parameter-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`array-parameter-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>位址傳值，元素仍是原來那一組。</h2><p>函式參數 int items[] 不會攜帶整個陣列的大小。sizeof items 得到的是指標大小，不能用來推算原陣列有幾格。由呼叫端明確傳入 count，並確保它不超過可存取範圍。</p>{count === 3 && <p role="status">你已完成陣列作為函式參數。</p>}<div><Link className="button button-secondary" to="/learn/pointers/strings">上一課：字串與字元指標</Link><Link className="button button-primary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
