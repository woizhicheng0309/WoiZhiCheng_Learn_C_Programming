import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_REALLOCATION_CONFIG, REALLOCATION_DATASETS, REALLOCATION_OUTCOMES, simulateReallocationProgram, validateReallocationConfig, type ReallocationBlock, type ReallocationConfig, type ReallocationPhase, type ReallocationPointer } from '../domain/reallocation'
import { REALLOCATION_CHALLENGES, evaluateReallocationChallenge, type ReallocationChallengeId } from '../data/reallocationChallenges'

const LESSON_ID = 'memory-reallocation' as const
const phaseLabels: Record<ReallocationPhase, string> = {
  prepare: '準備容量調整', 'enter-main': '進入 main', 'initialize-count': '設定原容量', 'allocate-original': '配置原區塊',
  'check-original': '檢查首次配置', 'initialize-original': '初始化原元素', 'set-requested': '設定目標容量',
  reallocate: '接收 realloc 結果', 'check-result': '檢查暫存指標', 'adopt-result': '採用成功結果',
  'new-for-init': '從原容量開始', 'new-for-condition': '檢查新增範圍', 'initialize-new': '初始化新增元素',
  'new-for-update': '新增索引加一', 'update-count': '更新有效容量', 'print-failure': '保留原區塊',
  'initialize-sum': '總和歸零', 'sum-for-init': '從索引零開始', 'sum-for-condition': '檢查有效範圍',
  accumulate: '讀取有效元素', 'sum-for-update': '加總索引加一', 'print-result': '輸出容量與總和',
  free: '釋放有效區塊', 'clear-p': '改寫 p', 'clear-tmp': '改寫 tmp', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
const pointerLabels: Record<ReallocationPointer, string> = {
  undeclared: '尚未建立', A: '→ 原區塊 A', B: '→ 結果區塊 B', invalidated: '失效（不可讀取）', null: 'NULL',
}
function readConfig(value: unknown): ReallocationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_REALLOCATION_CONFIG }
  const config = value as ReallocationConfig
  return validateReallocationConfig(config).length ? { ...DEFAULT_REALLOCATION_CONFIG }
    : { dataset: config.dataset, outcome: config.outcome, requested: config.requested, fill: config.fill }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 2 && tokens.every(token => /^\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}
function BlockCard({ name, block, active, activeCell }: { name: 'A' | 'B'; block: Readonly<ReallocationBlock>; active: boolean; activeCell: number | null }) {
  const labels = { 'not-created': '尚未建立', live: '有效', ended: '已由 realloc 結束生命週期', freed: '已由 free 釋放' }
  return <section className={`allocation-block reallocation-block is-${block.status}${active ? ' is-active' : ''}`} aria-label={`區塊 ${name}`}>
    <h3>{name === 'A' ? 'A：原區塊' : 'B：調整結果'}</h3><p aria-label={`區塊 ${name} 狀態`}>{labels[block.status]}</p>
    {block.status === 'not-created' ? <p>目前沒有這份配置物件。</p> : <>
      <p>生命週期記錄：{block.capacity} 個 int · 模擬位置 {block.location}</p>
      <ol className="allocation-cells" aria-label={`區塊 ${name} 的元素`}>{Array.from({ length: block.capacity }, (_, index) => <li key={index} className={active && activeCell === index ? 'is-active' : ''}><code>[{index}]</code><strong aria-label={`${name}[${index}]`}>{block.status !== 'live' ? '不可存取' : block.cells[index] === null ? '未初始化' : block.cells[index]}</strong></li>)}</ol>
      {block.status !== 'live' && <p>僅保留索引與容量記錄，不讀取或顯示舊內容。</p>}
    </>}
  </section>
}

export function ReallocationLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<ReallocationChallengeId>(REALLOCATION_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<ReallocationChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<ReallocationChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateReallocationProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = REALLOCATION_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts:
    line.lineNumber === 17 ? [
      { id: 'new-prefix', text: '    for (' }, { id: 'new-for-init', text: 'int i = count' }, { id: 'new-separator-1', text: '; ' },
      { id: 'new-for-condition', text: 'i < requested' }, { id: 'new-separator-2', text: '; ' },
      { id: 'new-for-update', text: 'i++' }, { id: 'new-suffix', text: ') {' },
    ] : line.lineNumber === 25 ? [
      { id: 'sum-prefix', text: '  for (' }, { id: 'sum-for-init', text: 'int i = 0' }, { id: 'sum-separator-1', text: '; ' },
      { id: 'sum-for-condition', text: 'i < count' }, { id: 'sum-separator-2', text: '; ' },
      { id: 'sum-for-update', text: 'i++' }, { id: 'sum-suffix', text: ') {' },
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
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(REALLOCATION_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: ReallocationConfig) => {
    if (validateReallocationConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請依序輸入有效容量與總和，使用兩個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls allocation-controls"><h2>設定原資料與目標容量</h2>
    <label htmlFor="reallocation-dataset">原始資料</label><select id="reallocation-dataset" value={config.dataset} onChange={event => changeConfig({ ...config, dataset: event.target.value as ReallocationConfig['dataset'] })}>{Object.entries(REALLOCATION_DATASETS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="reallocation-outcome">realloc 結果（模擬情境）</label><select id="reallocation-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as ReallocationConfig['outcome'] })}>{Object.entries(REALLOCATION_OUTCOMES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="reallocation-requested">目標容量 requested</label><div className="allocation-range"><input id="reallocation-requested" type="range" min="1" max="5" step="1" value={config.requested} onChange={event => changeConfig({ ...config, requested: Number(event.target.value) })} /><output htmlFor="reallocation-requested">{config.requested}</output></div>
    <label htmlFor="reallocation-fill">新增元素值</label><div className="allocation-range"><input id="reallocation-fill" type="range" min="0" max="9" step="1" value={config.fill} disabled={config.outcome === 'failure' || config.requested <= 3} onChange={event => changeConfig({ ...config, fill: Number(event.target.value) })} /><output htmlFor="reallocation-fill">{config.fill}</output></div>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_REALLOCATION_CONFIG })}>恢復預設值</button>
    <p>本課模擬第一次 malloc 成功，專注觀察 realloc。位置與成敗是教學情境，真實程式仍需檢查回傳值。目標容量限制為 1 到 5，不涵蓋零長度請求或大小乘法溢位。</p>
  </div>
  return <div className="allocation-page reallocation-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ realloc 容量調整與失敗處理</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 08 · LESSON 02</span><h1>先接住新結果，<br />再決定怎麼改指標。</h1><p>用 tmp 接住 realloc 的結果，追蹤擴充、縮小、保留資料與失敗分支，最後只釋放仍有效的區塊。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>requested 是請求，count 才是目前有效容量。</h2><p>先用 tmp 接收回傳值，成功後才改寫 p 與 count。正長度請求失敗時，原區塊與內容仍有效。成功則保留新舊大小較小範圍的前綴；擴充出的新內容尚未初始化，縮小後不能再存取被移除的尾端。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>最後還能讀幾格，總和又是多少？</h2><p>原三格為 {REALLOCATION_DATASETS[config.dataset].values.join('、')}，請求改為 {config.requested} 格。{config.outcome === 'failure' ? '本次調整失敗，程式保留原區塊。' : `若有新增元素，各先寫入 ${config.fill}。`}依序預測最後輸出的 count、sum。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="reallocation-prediction">預測有效容量、總和</label><div><input id="reallocation-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.printedValues === null ? '預測已記錄，執行到最後的 printf 後揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.printedValues.join('、')}。${submitted.every((value, index) => value === frame.printedValues![index]) ? '預測正確！' : '先確認調整是否成功，再依有效容量累加保留與新增的元素。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>原指標、暫存結果與配置生命週期。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="容量調整控制"
        playback={unlocked ? <PlaybackControls controlName="容量調整執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="allocation-execution lab-panel" aria-label="容量調整與配置區塊" data-phase={frame.phase}>
          <dl className="allocation-variables reallocation-variables">{(['p', 'tmp'] as const).map(pointer => <div key={pointer}><dt>{pointer}</dt><dd aria-label={`${pointer} 指向`}>{frame.mainInScope ? pointerLabels[frame[pointer]] : '—'}</dd></div>)}
            <div><dt>count</dt><dd aria-label="目前 count">{frame.mainInScope ? frame.count ?? '—' : '—'}</dd></div><div><dt>requested</dt><dd aria-label="目前 requested">{frame.mainInScope ? frame.requested ?? '—' : '—'}</dd></div><div><dt>i</dt><dd aria-label="目前 i">{frame.mainInScope && frame.iInScope ? frame.i : '—'}</dd></div><div><dt>sum</dt><dd aria-label="目前 sum">{frame.mainInScope ? frame.sum ?? '—' : '—'}</dd></div>
          </dl>
          <BlockCard name="A" block={frame.original} active={frame.activeBlock === 'A'} activeCell={frame.activeCell} />
          <BlockCard name="B" block={frame.resized} active={frame.activeBlock === 'B'} activeCell={frame.activeCell} />
          <p>A、B 標記不同的物件生命週期；X、Y 只代表模擬位置，沒有讀取或比較失效的指標值。位置相同也必須採用回傳的新指標。</p>
          <p className="allocation-condition" aria-label="目前判斷">{frame.condition ? `${frame.condition.expression} → ${frame.condition.value ? '成立' : '不成立'}` : '這一步沒有條件判斷'}</p>
          <p aria-label="main 回傳值">main 回傳值：{frame.exitCode ?? '尚未回傳'}</p>
          <div className="allocation-console"><h3>主控台輸出</h3><ol aria-label="容量調整輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清請求與有效結果。</h2>
      <ChallengePanel challenges={REALLOCATION_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="容量調整學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{REALLOCATION_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateReallocationChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`reallocation-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`reallocation-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>失敗保留原配置，成功改用新結果。</h2><p>直接把 realloc 回傳值覆寫到唯一的 p，可能在失敗時遺失原區塊的位址。暫存結果讓程式能分辨兩條路徑。成功後，即使位置相同也不用舊指標；最後 free 有效區塊，再直接把兩個指標變數設為 NULL。</p><p>語意依據：<a href="https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf#page=367" target="_blank" rel="noreferrer">C11 工作草案 N1570 §7.22.3.5：realloc</a>。</p>{count === 3 && <p role="status">你已完成 realloc 容量調整與失敗處理。</p>}<div><Link className="button button-secondary" to="/learn/memory/allocation">上一課：動態記憶體配置與釋放</Link><Link className="button button-primary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
