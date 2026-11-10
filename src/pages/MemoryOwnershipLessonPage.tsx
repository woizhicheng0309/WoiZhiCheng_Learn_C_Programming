import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { MEMORY_OWNERSHIP_CHALLENGES, evaluateMemoryOwnershipChallenge, type MemoryOwnershipChallengeId } from '../data/memoryOwnershipChallenges'
import {
  DEFAULT_MEMORY_OWNERSHIP_CONFIG, MEMORY_OWNERSHIP_OUTCOMES, MEMORY_OWNERSHIP_STRATEGIES,
  simulateMemoryOwnershipProgram, validateMemoryOwnershipConfig,
  type HeapPointerState, type MemoryOwnershipConfig, type MemoryOwnershipPhase,
} from '../domain/memoryOwnership'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'

const LESSON_ID = 'memory-ownership' as const
const phaseLabels: Record<MemoryOwnershipPhase, string> = {
  prepare: '準備執行', blocked: '安全停止', 'enter-main': '進入 main', allocate: '配置區塊',
  'initialize-destination': '初始化目的端', 'check-allocation': '檢查配置結果',
  'print-failure': '輸出失敗訊息', 'return-failure': '回傳狀態 1', 'initialize-value': '初始化資料',
  borrow: '建立借用別名', 'select-source': '選擇原始持有者', 'check-transfer': '檢查是否轉交',
  'call-transfer': '呼叫轉交函式', 'enter-transfer': '進入轉交函式', 'copy-pointer': '複製位址',
  'clear-source': '完成交接', 'leave-transfer': '返回 main', 'select-destination': '選擇新持有者',
  observe: '借看資料', 'call-release': '呼叫釋放函式', 'enter-release': '進入釋放函式',
  free: '結束區塊生命週期', 'clear-owner': '清空持有欄位', 'leave-release': '返回 main',
  'clear-view': '清空借用指標', print: '輸出結果', 'return-main': '回傳狀態 0', done: '執行完成',
}
const pointerLabels: Record<HeapPointerState, string> = { unset: '—', null: 'NULL', live: '→ A', invalid: '失效' }
const ownerCodes = { failure: 0, source: 1, destination: 2 } as const
const viewCodes: Record<HeapPointerState, number> = { unset: 0, live: 1, null: 2, invalid: 3 }

function readConfig(value: unknown): MemoryOwnershipConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_MEMORY_OWNERSHIP_CONFIG }
  const { strategy, outcome, value: data } = value as MemoryOwnershipConfig
  const config = { strategy, outcome, value: data }
  return validateMemoryOwnershipConfig(config).length ? { ...DEFAULT_MEMORY_OWNERSHIP_CONFIG } : config
}

export function MemoryOwnershipLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<readonly [number, number] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<MemoryOwnershipChallengeId>(MEMORY_OWNERSHIP_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<MemoryOwnershipChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<MemoryOwnershipChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateMemoryOwnershipProgram(config), [config])
  const sourceLines = useMemo(() => simulation.source.lines.map(({ lineNumber, code }) => ({
    lineNumber, parts: [{ id: `line-${lineNumber}`, text: code || ' ' }],
  })), [simulation.source])
  const player = useTracePlayer({ frames: simulation.frames, speed })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = MEMORY_OWNERSHIP_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey)))
      setPrediction('')
      setSubmitted(null)
      setError('')
      setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) {
        setAnswers({})
        setFeedback({})
        setActiveId(MEMORY_OWNERSHIP_CHALLENGES[0].id)
      }
    } else if (previous.guided !== lesson.guidedRunCompleted) {
      setUnlocked(lesson.guidedRunCompleted)
    }
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) {
      markGuidedRunCompleted(LESSON_ID)
    }
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  function changeConfig(next: MemoryOwnershipConfig) {
    if (validateMemoryOwnershipConfig(next).length) return
    setConfig(next)
    setPrediction('')
    setSubmitted(null)
    setError('')
    setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next)
    rememberLessonState(LESSON_ID, next)
  }

  function predict(event: FormEvent) {
    event.preventDefault()
    const tokens = prediction.trim().split(/[\s,，]+/)
    if (tokens.length !== 2 || !/^[0-2]$/.test(tokens[0]) || !/^[0-3]$/.test(tokens[1])) {
      setError('請依序輸入釋放者代碼與 view 狀態代碼。')
      return
    }
    setSubmitted([Number(tokens[0]), Number(tokens[1])])
    setError('')
    setUnlocked(true)
    player.reset()
    visitLesson(LESSON_ID)
  }

  const controls = (
    <div className="pointers-controls allocation-controls">
      <h2>設定配置與交接</h2>
      <label htmlFor="ownership-outcome">配置情境</label>
      <select id="ownership-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as MemoryOwnershipConfig['outcome'] })}>
        {Object.entries(MEMORY_OWNERSHIP_OUTCOMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <label htmlFor="ownership-strategy">所有權策略</label>
      <select id="ownership-strategy" value={config.strategy} onChange={event => changeConfig({ ...config, strategy: event.target.value as MemoryOwnershipConfig['strategy'] })}>
        {Object.entries(MEMORY_OWNERSHIP_STRATEGIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <label htmlFor="ownership-value">寫入的資料值</label>
      <div className="allocation-range">
        <input id="ownership-value" type="range" min="0" max="100" value={config.value} onChange={event => changeConfig({ ...config, value: Number(event.target.value) })} />
        <output htmlFor="ownership-value">{config.value}</output>
      </div>
      <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_MEMORY_OWNERSHIP_CONFIG })}>恢復預設值</button>
      <p>配置情境決定模擬器如何呈現 malloc 的回傳結果。C 程式由實際配置結果決定分支。</p>
    </div>
  )
  const viewAfterRelease = simulation.frames.find(item => item.phase === 'leave-release')?.view ?? 'unset'
  const actual = frame.printedOutcome ? [ownerCodes[frame.printedOutcome], viewCodes[viewAfterRelease]] : null
  const predictionResult = submitted && actual && (
    `你預測 ${submitted.join('、')}，實際 ${actual.join('、')}。${submitted.every((value, index) => value === actual[index]) ? '預測正確！' : '請查看釋放責任與 view 的狀態。'}`
  )

  return (
    <div className="allocation-page memory-ownership-page pointers-page functions-page lab-page">
      <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
        <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 記憶體所有權、借用與釋放</span></nav>
        <div className="functions-hero__layout">
          <div><span className="section-kicker">MODULE 08 · LESSON 03</span><h1>交接同一塊記憶體，<br />追蹤誰負責釋放。</h1><p>配置一格 int，讓結構持有位址，再觀察借用、轉交與釋放如何改變每個指標的狀態。</p></div>
          <aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside>
        </div>
      </div></section>
      <section className="pointers-recap page-width">
        <h2>同一個位址可以有多個指標，釋放責任由程式約定。</h2>
        <p>本例由持有區塊的 Buffer 負責釋放。交接時先把位址存入原本為空的目的欄位，再清空來源欄位。view 借看同一格資料，交接期間仍然有效。</p>
        <p>範例會在釋放後分別清空持有欄位與借用變數。圖中的 A 是配置區塊的識別符號。</p>
      </section>
      <section className="functions-prediction-section"><div className="page-width functions-prediction-card">
        <div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>誰釋放？回到 main 時 view 又是什麼狀態？</h2>
          <p>釋放者代碼為 0 無、1 source、2 destination。請預測 release_buffer 返回後、view 清空前的狀態，代碼為 0 尚未宣告、1 有效、2 NULL、3 失效。配置失敗時以結束前的狀態作答。</p>
        </div>
        <form className="functions-prediction-form" onSubmit={predict}>
          <label htmlFor="ownership-prediction">預測釋放者與 view 狀態</label>
          <div><input id="ownership-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>
          {error && <p role="alert">{error}</p>}
        </form>
        {submitted && <p role="status">{predictionResult ?? '預測已記錄，執行到輸出後揭曉。'}</p>}
      </div></section>
      <section className="functions-lab-section"><div className="page-width">
        <h2>追蹤結構欄位、借用指標與區塊生命週期。</h2>
        <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="記憶體所有權設定"
          playback={unlocked ? <PlaybackControls controlName="記憶體所有權執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交預測後可播放或單步執行。</p>}
          footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p></div>}>
          <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} followActiveLine />
          <section className="allocation-execution lab-panel" aria-label="記憶體所有權追蹤" data-phase={frame.phase}>
            <p>目前函式 <strong>{frame.activeFunction ?? '—'}</strong></p>
            <dl className="allocation-variables ownership-variables">
              <div><dt>釋放責任</dt><dd aria-label="目前釋放責任">{frame.responsibility ?? '無'}</dd></div>
              <div><dt>source.data</dt><dd aria-label="source.data 指向">{pointerLabels[frame.source]}</dd></div>
              <div><dt>destination.data</dt><dd aria-label="destination.data 指向">{pointerLabels[frame.destination]}</dd></div>
              <div><dt>view</dt><dd aria-label="view 指向">{pointerLabels[frame.view]}</dd></div>
              <div><dt>cleanup</dt><dd aria-label="cleanup 指向">{frame.cleanup ? `→ &${frame.cleanup}` : '—'}</dd></div>
              <div><dt>observed</dt><dd aria-label="observed 值">{frame.observed ?? '—'}</dd></div>
            </dl>
            {frame.activeFunction === 'move_buffer' && <p>參數 to → &amp;destination，from → &amp;source。</p>}
            {frame.releaseParameter && <p aria-label="釋放函式參數">參數 buffer → &amp;{frame.releaseParameter}</p>}
            <section className={`allocation-block ownership-block${frame.heap === 'live' ? ' is-live' : frame.heap === 'released' ? ' is-freed' : ''}`}>
              <h3>區塊 A</h3>
              <p aria-label="區塊 A 狀態">{frame.heap === 'live' ? '有效' : frame.heap === 'released' ? '已釋放' : '未配置'}</p>
              {frame.heap === 'live' && <p aria-label="區塊 A 資料值">int {frame.heapValue ?? '尚未初始化'}</p>}
              <p aria-label="free 呼叫次數">free 呼叫 {frame.freeCount} 次</p>
            </section>
            <div className="allocation-console"><h3>程式輸出</h3><pre aria-label="記憶體所有權輸出">{frame.stdout || '尚無輸出'}</pre></div>
          </section>
        </LabShell>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
      </div></section>
      <section className="pointers-challenges page-width">
        <h2>三個挑戰，確認交接、別名與失敗分支。</h2>
        <ChallengePanel challenges={MEMORY_OWNERSHIP_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="記憶體所有權學習挑戰">
          {item => <div className="pointers-challenge-content">
            <h3>{item.label}</h3><p>{MEMORY_OWNERSHIP_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
            <form onSubmit={event => {
              event.preventDefault()
              const result = evaluateMemoryOwnershipChallenge(item.id, answers[item.id] ?? '')
              setFeedback(current => ({ ...current, [item.id]: result }))
              if (result.solved) markChallengeCompleted(LESSON_ID, item.id)
            }}>
              <label htmlFor={`ownership-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label>
              <input id={`ownership-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} />
              <button className="button button-primary" type="submit">檢查答案</button>
            </form>
            {feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
          </div>}
        </ChallengePanel>
      </section>
      <section className="pointers-recap page-width">
        <h2>釋放前保存需要的資料，釋放後清空手上的別名。</h2>
        <p>observed 是已讀出的整數，輸出時可以繼續使用。cleanup 指向 main 裡仍有效的 Buffer 結構。區塊釋放後，程式直接覆寫原先指向該區塊的指標值。</p>
        <p>語意依據見 <a href="https://www.sigbus.info/n1570#6.2.4" target="_blank" rel="noreferrer">C11 工作草案 N1570 的物件生命週期</a>與 <a href="https://www.sigbus.info/n1570#7.22.3.3" target="_blank" rel="noreferrer">free 的規則</a>。</p>
        {count === 3 && <p role="status">你已完成記憶體所有權、借用與釋放。</p>}
        <div><Link className="button button-secondary" to="/learn/memory/reallocation">上一課：realloc 容量調整與失敗處理</Link><Link className="button button-primary" to="/learn/files/reading">下一課：檔案開啟與 fgets 讀取</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div>
      </section>
    </div>
  )
}
