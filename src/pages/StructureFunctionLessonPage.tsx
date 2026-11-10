import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { STRUCTURE_FUNCTION_CHALLENGES, evaluateStructureFunctionChallenge, type StructureFunctionChallengeId } from '../data/structureFunctionChallenges'
import {
  DEFAULT_STRUCTURE_FUNCTION_CONFIG, ORIGINAL_STRUCTURE_SCORE, STRUCTURE_TYPE_NAMES, STRUCTURE_WRITE_ORDERS,
  simulateStructureFunctionProgram, validateStructureFunctionConfig,
  type StructureFunctionConfig, type StructureFunctionPhase, type StudentValue,
} from '../domain/structureFunctions'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'

const LESSON_ID = 'structures-functions' as const
const phaseLabels: Record<StructureFunctionPhase, string> = {
  prepare: '準備執行', blocked: '安全停止', done: '執行完成', 'enter-main': '進入 main',
  'initialize-original': '初始化原始紀錄', 'call-revise': '呼叫 revise', 'enter-revise': '接收結構值',
  'write-copy': '改寫區域副本', 'return-copy': '回傳結構值', 'receive-copy': '初始化預覽紀錄',
  'bind-selected': '保存原始紀錄位址', 'call-update': '呼叫 update', 'enter-update': '接收指標值',
  'write-target': '寫入目前指向的紀錄', 'rebind-target': '改寫區域指標',
  'return-observed': '回傳分數', 'receive-observed': '接收分數', print: '輸出結果', 'return-main': 'main 回傳',
}

function readConfig(value: unknown): StructureFunctionConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STRUCTURE_FUNCTION_CONFIG }
  const { typeName, writeOrder, previewScore, writeScore } = value as StructureFunctionConfig
  const config = { typeName, writeOrder, previewScore, writeScore }
  return validateStructureFunctionConfig(config).length ? { ...DEFAULT_STRUCTURE_FUNCTION_CONFIG } : config
}

function StudentCard({ name, typeName, value, writing }: {
  name: 'original' | 'preview' | 'copy'; typeName: string; value: Readonly<StudentValue> | null; writing: boolean
}) {
  return (
    <section className={`structure-object${writing ? ' is-active' : ''}`} aria-label={`${name} 紀錄`}>
      <h3>{name}<small>{typeName}</small></h3>
      <dl className="structure-members">
        {(['id', 'score'] as const).map(field => (
          <div key={field} className={writing && field === 'score' ? 'is-selected' : undefined}>
            <dt><code>{name}.{field}</code><small>int</small></dt>
            <dd aria-label={`${name}.${field}`}>{value?.[field] ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function StructureFunctionLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<StructureFunctionChallengeId>(STRUCTURE_FUNCTION_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<StructureFunctionChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<StructureFunctionChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateStructureFunctionProgram(config), [config])
  const sourceLines = useMemo(() => simulation.source.lines.map(({ lineNumber, code }) => ({
    lineNumber, parts: [{ id: `line-${lineNumber}`, text: code || ' ' }],
  })), [simulation.source])
  const player = useTracePlayer({ frames: simulation.frames, speed })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const typeName = STRUCTURE_TYPE_NAMES[config.typeName].name
  const count = STRUCTURE_FUNCTION_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

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
        setActiveId(STRUCTURE_FUNCTION_CHALLENGES[0].id)
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

  function changeConfig(next: StructureFunctionConfig) {
    if (validateStructureFunctionConfig(next).length) return
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
    if (tokens.length !== 2 || !tokens.every(token => /^\d+$/.test(token) && Number(token) <= 100)) {
      setError('請依序輸入 original、preview 的分數，每個分數須為 0 到 100 的整數。')
      return
    }
    setSubmitted(tokens.map(Number))
    setError('')
    setUnlocked(true)
    player.reset()
    visitLesson(LESSON_ID)
  }

  const controls = (
    <div className="pointers-controls structure-controls">
      <h2>選擇型別名稱、順序與分數</h2>
      <label htmlFor="structure-function-type">型別寫法</label>
      <select id="structure-function-type" value={config.typeName} onChange={event => changeConfig({ ...config, typeName: event.target.value as StructureFunctionConfig['typeName'] })}>
        {Object.entries(STRUCTURE_TYPE_NAMES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
      </select>
      <label htmlFor="structure-function-order">update 內的順序</label>
      <select id="structure-function-order" value={config.writeOrder} onChange={event => changeConfig({ ...config, writeOrder: event.target.value as StructureFunctionConfig['writeOrder'] })}>
        {Object.entries(STRUCTURE_WRITE_ORDERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      {([['previewScore', 'revise 寫入的分數'], ['writeScore', 'update 寫入的分數']] as const).map(([field, label]) => (
        <div key={field}>
          <label htmlFor={`structure-function-${field}`}>{label}</label>
          <div className="structure-pointer-range">
            <input id={`structure-function-${field}`} type="range" min="0" max="100" value={config[field]} onChange={event => changeConfig({ ...config, [field]: Number(event.target.value) })} />
            <output htmlFor={`structure-function-${field}`}>{config[field]}</output>
          </div>
        </div>
      ))}
      <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_STRUCTURE_FUNCTION_CONFIG })}>恢復預設值</button>
      <p>original 起始分數為 {ORIGINAL_STRUCTURE_SCORE}。型別寫法只影響程式碼的名稱，兩種順序則會改到不同的紀錄。</p>
    </div>
  )
  const printedValues = frame.printedValues
  const predictionResult = submitted && printedValues && (
    `你預測 ${submitted.join('、')}，實際 ${printedValues.join('、')}。${submitted.every((value, index) => value === printedValues[index]) ? '預測正確！' : '在寫入那一步確認 target 指向哪筆紀錄。'}`
  )

  return (
    <div className="structure-page structure-function-page pointers-page functions-page lab-page">
      <section className="pointers-hero functions-hero lab-hero">
        <div className="page-width">
          <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 結構的函式傳遞與 typedef</span></nav>
          <div className="functions-hero__layout">
            <div>
              <span className="section-kicker">MODULE 07 · LESSON 04</span>
              <h1>把結構傳給函式，<br />追蹤副本與指標。</h1>
              <p>觀察結構參數、結構回傳值與指標參數，切換寫入順序，找出哪一份紀錄被修改。</p>
            </div>
            <aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside>
          </div>
        </div>
      </section>
      <section className="pointers-recap page-width">
        <h2>結構值與指標值都會交給各自的參數。</h2>
        <p>revise 的 copy 參數有自己的 id 與 score，回傳的結構值用於初始化 preview。update 的 target 參數保存一份位址值，透過它寫入就會改到當下指向的紀錄。</p>
        <p><code>typedef</code> 宣告型別的另一個名稱。範例中的 <code>Student</code> 和 <code>struct Student</code> 表示同一型別。</p>
      </section>
      <section className="functions-prediction-section">
        <div className="page-width functions-prediction-card">
          <div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>最後會改到哪份紀錄？</h2><p>revise 設定預覽分數為 {config.previewScore}。update 寫入 {config.writeScore}，目前採用「{STRUCTURE_WRITE_ORDERS[config.writeOrder]}」。請預測最後兩份紀錄的分數。</p></div>
          <form className="functions-prediction-form" onSubmit={predict}>
            <label htmlFor="structure-function-prediction">預測 original、preview 的分數</label>
            <div><input id="structure-function-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>
            {error && <p role="alert">{error}</p>}
          </form>
          {submitted && <p role="status">{predictionResult ?? '預測已記錄，執行到 printf 後揭曉。'}</p>}
        </div>
      </section>
      <section className="functions-lab-section">
        <div className="page-width">
          <h2>觀察呼叫端與目前執行的函式。</h2>
          <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="結構函式設定"
            playback={unlocked ? <PlaybackControls controlName="結構函式執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交預測後可播放或單步執行。</p>}
            footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p></div>}>
            <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} followActiveLine />
            <section className="structure-execution lab-panel" aria-label="結構函式追蹤" data-phase={frame.phase}>
              <p>目前函式 <strong aria-label="目前執行的函式">{frame.activeFunction ?? '—'}</strong></p>
              <h3>main 的物件</h3>
              <StudentCard name="original" typeName={typeName} value={frame.original} writing={frame.writtenObject === 'original'} />
              <StudentCard name="preview" typeName={typeName} value={frame.preview} writing={frame.writtenObject === 'preview'} />
              <dl className="structure-pointer-links">
                <div><dt>selected<small>{typeName} *</small></dt><dd aria-label="selected 指向">{frame.selected ? `→ &${frame.selected}` : '—'}</dd></div>
                <div><dt>observed<small>int</small></dt><dd aria-label="observed 值">{frame.observed ?? '—'}</dd></div>
              </dl>
              <section aria-label="被呼叫端的參數">
                <h3>被呼叫端的參數</h3>
                {frame.activeFunction === 'revise' && <StudentCard name="copy" typeName={typeName} value={frame.copy} writing={frame.writtenObject === 'copy'} />}
                {frame.activeFunction === 'update' && (
                  <dl className="structure-pointer-links">
                    <div><dt>target<small>{typeName} *</small></dt><dd aria-label="target 指向">→ &amp;{frame.target}</dd></div>
                    <div><dt>alternate<small>{typeName} *</small></dt><dd aria-label="alternate 指向">→ &amp;{frame.alternate}</dd></div>
                  </dl>
                )}
                {frame.scoreParameter === null ? <p>目前沒有作用中的被呼叫端參數。</p> : <p>區域參數 score = {frame.scoreParameter}</p>}
                {frame.returnedStudent && <p aria-label="即將回傳的結構">回傳值 {'{'}id={frame.returnedStudent.id}, score={frame.returnedStudent.score}{'}'}</p>}
                {frame.returnedScore !== null && <p aria-label="即將回傳的整數">回傳值 {frame.returnedScore}</p>}
              </section>
              <div className="structure-console"><h3>printf 輸出</h3><pre aria-label="結構函式輸出">{frame.stdout || '尚無輸出'}</pre></div>
            </section>
          </LabShell>
          <p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
        </div>
      </section>
      <section className="pointers-challenges page-width">
        <h2>三個挑戰，分辨副本、指向與型別名稱。</h2>
        <ChallengePanel challenges={STRUCTURE_FUNCTION_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="結構函式學習挑戰">
          {item => (
            <div className="pointers-challenge-content">
              <h3>{item.label}</h3>
              <p>{STRUCTURE_FUNCTION_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
              <form onSubmit={event => {
                event.preventDefault()
                const result = evaluateStructureFunctionChallenge(item.id, answers[item.id] ?? '')
                setFeedback(current => ({ ...current, [item.id]: result }))
                if (result.solved) markChallengeCompleted(LESSON_ID, item.id)
              }}>
                <label htmlFor={`structure-function-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label>
                <input id={`structure-function-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} />
                <button className="button button-primary" type="submit">檢查答案</button>
              </form>
              {feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
            </div>
          )}
        </ChallengePanel>
      </section>
      <section className="pointers-recap page-width">
        <h2>改寫 target 的指向後，selected 仍指向 original。</h2>
        <p>追蹤圖用名稱顯示物件與位址關係。函式返回後，呼叫端的紀錄繼續使用，區域參數結束生命週期。選做時可嘗試回傳新的指標值，並由呼叫端指定給 selected，再比較指向。</p>
        <p>語意依據見 <a href="https://www.sigbus.info/n1570#6.5.2.2" target="_blank" rel="noreferrer">C11 工作草案 N1570 的函式呼叫</a>與 <a href="https://www.sigbus.info/n1570#6.7.8" target="_blank" rel="noreferrer">型別定義</a>。</p>
        {count === 3 && <p role="status">你已完成結構的函式傳遞與 typedef。</p>}
        <div><Link className="button button-secondary" to="/learn/structures/pointers">上一課：指向結構的指標</Link><Link className="button button-primary" to="/learn/memory/allocation">下一課：動態記憶體配置與釋放</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div>
      </section>
    </div>
  )
}
