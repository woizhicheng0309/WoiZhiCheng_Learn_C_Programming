import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { ALLOCATORS, DEFAULT_ALLOCATION_CONFIG, simulateAllocationProgram, validateAllocationConfig, type AllocationConfig, type AllocationPhase, type AllocationHeapStatus } from '../domain/allocation'
import { ALLOCATION_CHALLENGES, evaluateAllocationChallenge, type AllocationChallengeId } from '../data/allocationChallenges'

const LESSON_ID = 'memory-allocation' as const
const phaseLabels: Record<AllocationPhase, string> = {
  prepare: '準備配置', 'enter-main': '進入 main', 'initialize-count': '設定元素數量', allocate: '請求動態記憶體',
  'check-allocation': '檢查配置結果', 'print-failure': '輸出失敗訊息', 'return-failure': '失敗路徑回傳',
  'initialize-sum': '總和歸零', 'for-init': '建立索引', 'for-condition': '檢查索引界線',
  'initialize-cell': '先寫入元素', accumulate: '再讀取加總', 'for-update': '索引加一',
  'print-sum': '輸出總和', free: '釋放配置區塊', 'clear-pointer': '指標設為 NULL',
  'return-success': '正常路徑回傳', done: '執行完成', blocked: '安全停止',
}
const heapLabels: Record<AllocationHeapStatus, string> = { 'not-requested': '尚未配置', live: '有效區塊', failed: '配置失敗', freed: '已釋放' }
function readConfig(value: unknown): AllocationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_ALLOCATION_CONFIG }
  const config = value as AllocationConfig
  return validateAllocationConfig(config).length ? { ...DEFAULT_ALLOCATION_CONFIG }
    : { allocator: config.allocator, outcome: config.outcome, count: config.count, start: config.start }
}
function parsePrediction(value: string): number | null {
  const token = value.trim()
  return /^\d+$/.test(token) && Number.isSafeInteger(Number(token)) ? Number(token) : null
}

export function AllocationLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<AllocationChallengeId>(ALLOCATION_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<AllocationChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<AllocationChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateAllocationProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = ALLOCATION_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length
  const failedScenario = config.outcome === 'failure'
  const predictionLabel = failedScenario ? '預測 main 回傳值' : '預測 sum 的輸出'
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber,
    parts: line.lineNumber === 12 ? [
      { id: 'for-prefix', text: '  for (' }, { id: 'for-init', text: 'int i = 0' }, { id: 'for-separator-1', text: '; ' },
      { id: 'for-condition', text: 'i < count' }, { id: 'for-separator-2', text: '; ' },
      { id: 'for-update', text: 'i++' }, { id: 'for-suffix', text: ') {' },
    ] : [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }],
  }))

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(ALLOCATION_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: AllocationConfig) => {
    if (validateAllocationConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請輸入一個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls allocation-controls"><h2>設定配置與初始化</h2>
    <label htmlFor="allocation-allocator">配置函式</label><select id="allocation-allocator" value={config.allocator} onChange={event => changeConfig({ ...config, allocator: event.target.value as AllocationConfig['allocator'] })}>{Object.entries(ALLOCATORS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="allocation-outcome">配置結果（模擬情境）</label><select id="allocation-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as AllocationConfig['outcome'] })}><option value="success">成功：取得有效區塊</option><option value="failure">失敗：回傳 NULL</option></select>
    <label htmlFor="allocation-count">元素數量 count</label><div className="allocation-range"><input id="allocation-count" type="range" min="1" max="5" step="1" value={config.count} onChange={event => changeConfig({ ...config, count: Number(event.target.value) })} /><output htmlFor="allocation-count">{config.count}</output></div>
    <label htmlFor="allocation-start">寫入起始值</label><div className="allocation-range"><input id="allocation-start" type="range" min="0" max="20" step="1" value={config.start} disabled={failedScenario} onChange={event => changeConfig({ ...config, start: Number(event.target.value) })} /><output htmlFor="allocation-start">{config.start}</output></div>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_ALLOCATION_CONFIG })}>恢復預設值</button>
    <p>配置結果由模擬器指定，用來練習兩條分支；真實 C 程式必須檢查回傳值。本課 count 固定限制為 1 到 5，不涵蓋零長度請求或大小乘法溢位。</p>
  </div>
  const pointerLabels = { undeclared: '尚未建立', heap: '→ 配置區塊', null: 'NULL', invalidated: '失效（不可讀取）' }
  return <div className="allocation-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 動態記憶體配置與釋放</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 08 · LESSON 01</span><h1>先取得空間，<br />再管理它的生命週期。</h1><p>從 malloc 與 calloc 出發，逐步檢查配置結果、初始化元素、讀取加總，再釋放區塊並改寫指標。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>指標變數與配置區塊，有不同的生命週期。</h2><p>p 是 main 裡的區域指標；配置成功時，它保存動態區塊的位址。malloc 不初始化內容，calloc 會清零位元，本課的 int 元素因此從 0 開始。兩者都可能失敗，必須先檢查 NULL。</p><p>用 count × sizeof *p 請求所需空間，不假設 int 固定佔 4 個位元組。free 結束區塊的生命週期；接著指定 p = NULL，是改寫指標變數。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>{failedScenario ? '沒有取得空間，程式會怎麼結束？' : '先寫入再讀取，總和是多少？'}</h2><p>{failedScenario ? '配置函式回傳 NULL。沿著失敗分支，預測 main 的回傳值；這條路徑沒有 sum 的輸出。' : `配置 ${config.count} 個 int，依序寫入 ${config.start} + i，再累加到 sum。預測 printf 輸出的總和。`}</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="allocation-prediction">{predictionLabel}</label><div><input id="allocation-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="一個非負整數" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.predictionValue === null ? `預測已記錄，執行到${failedScenario ? '失敗分支回傳' : 'printf'}後揭曉。` : `你預測 ${submitted}，實際 ${frame.predictionValue}。${submitted === frame.predictionValue ? '預測正確！' : failedScenario ? '檢查 NULL 分支的 return 敘述。' : '先寫入起始值加上索引，再累加每格的值。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>配置、檢查、使用、釋放。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="動態記憶體控制"
        playback={unlocked ? <PlaybackControls controlName="動態記憶體執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="allocation-execution lab-panel" aria-label="指標與配置區塊" data-phase={frame.phase}>
          <dl className="allocation-variables"><div><dt>p</dt><dd aria-label="指標 p">{frame.mainInScope ? pointerLabels[frame.pointer] : '—'}</dd></div><div><dt>count</dt><dd aria-label="目前 count">{frame.mainInScope ? frame.count ?? '—' : '—'}</dd></div><div><dt>i</dt><dd aria-label="目前 i">{frame.mainInScope && frame.iInScope ? frame.i : '—'}</dd></div><div><dt>sum</dt><dd aria-label="目前 sum">{frame.mainInScope ? frame.sum ?? '—' : '—'}</dd></div></dl>
          <section className={'allocation-block is-' + frame.heapStatus} aria-label="配置區塊"><h3>{heapLabels[frame.heapStatus]}</h3><p>請求容量：{config.count} × sizeof(int)</p>
            {(frame.heapStatus === 'live' || frame.heapStatus === 'freed') ? <ol className="allocation-cells" aria-label="配置元素">{Array.from({ length: config.count }, (_, index) => <li key={index} className={frame.activeCell === index ? 'is-active' : ''}><code>[{index}]</code><strong aria-label={`配置元素[${index}]`}>{frame.heapStatus === 'freed' ? '不可存取' : frame.cells[index] === null ? '未初始化' : frame.cells[index]}</strong></li>)}</ol>
              : <p>{frame.heapStatus === 'failed' ? '沒有取得可用區塊，不建立元素。' : '尚未請求動態空間。'}</p>}
            {frame.heapStatus === 'freed' && <p>只保留曾請求的索引示意，不讀取或顯示已釋放區塊的內容。</p>}
          </section>
          <p className="allocation-condition" aria-label="目前判斷">{frame.condition ? `${frame.condition.expression} → ${frame.condition.value ? '成立' : '不成立'}` : '這一步沒有條件判斷'}</p>
          <p>格子表示 int 元素，不表示實際位址。sizeof *p 在這裡只求型別大小，不會讀取 p 指向的內容。</p>
          <p aria-label="main 回傳值">main 回傳值：{frame.exitCode ?? '尚未回傳'}</p>
          <div className="allocation-console"><h3>主控台輸出</h3><ol aria-label="動態記憶體輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，確認空間與數值的界線。</h2>
      <ChallengePanel challenges={ALLOCATION_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="動態記憶體學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{ALLOCATION_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateAllocationChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`allocation-answer-${item.id}`}>你的答案（一個整數）</label><input id={`allocation-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>取得空間不等於已有數值，釋放後也不能再使用。</h2><p>malloc 成功後仍要先初始化；配置失敗時，提早回傳可以避開後面的存取。使用完後釋放一次，再直接指定 p = NULL。這只改寫 p，不會修復其他指標別名；本課沒有建立別名。</p>{count === 3 && <p role="status">你已完成動態記憶體配置與釋放。</p>}<div><Link className="button button-secondary" to="/learn/structures/functions">上一課：結構的函式傳遞與 typedef</Link><Link className="button button-primary" to="/learn/memory/reallocation">下一課：realloc 容量調整與失敗處理</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
