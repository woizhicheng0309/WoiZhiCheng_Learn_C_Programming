import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Code2, MapPin, ShieldAlert, Terminal, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import {
  DEFAULT_POINTER_CONFIG, POINTER_LIMITS, simulatePointerProgram, validatePointerConfig,
  type PointerConfig, type PointerFrame, type PointerPhase, type PointerTarget,
} from '../domain/pointers'
import {
  POINTER_CHALLENGES, evaluateNullPointer, evaluatePointerPrediction, evaluatePointerWrite,
} from '../data/pointerChallenges'

const LESSON_ID = 'pointers-basics' as const
type ChallengeId = (typeof POINTER_CHALLENGES)[number]['id']
type Feedback = { solved: boolean; message: string }
const addresses = { x: '0x1000', y: '0x1004' } as const
const phaseLabels: Record<PointerPhase, string> = {
  'enter-main': '進入 main', 'declare-values': '建立變數', 'bind-pointer': '儲存位址',
  'read-pointer': '透過指標讀值', 'write-pointer': '透過指標改寫', print: '輸出前後值',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}

function readConfig(value: unknown): PointerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_POINTER_CONFIG }
  const candidate = value as PointerConfig
  return validatePointerConfig(candidate).length === 0
    ? { x: candidate.x, y: candidate.y, newValue: candidate.newValue, target: candidate.target }
    : { ...DEFAULT_POINTER_CONFIG }
}

function NumberControl({ field, value, onChange }: {
  field: 'x' | 'y' | 'newValue'; value: number; onChange: (value: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== String(value)) inputRef.current.value = String(value)
  }, [value])
  return (
    <div className="functions-number-control">
      <div className="functions-control-label">
        <label htmlFor={`pointer-${field}`}>{field} 的值</label>
        <small>{POINTER_LIMITS.min} 到 {POINTER_LIMITS.max} 的整數</small>
      </div>
      <input ref={inputRef} id={`pointer-${field}`} type="number" step={1}
        min={POINTER_LIMITS.min} max={POINTER_LIMITS.max} defaultValue={value}
        onChange={(event) => {
          const draft = event.target.value
          if (draft.trim() !== '' && Number.isFinite(Number(draft))) onChange(Number(draft))
        }}
        onBlur={(event) => { event.currentTarget.value = String(value) }} />
    </div>
  )
}

function PointerMemory({ frame }: { frame: PointerFrame }) {
  const memory = frame.memory
  const target = memory.pointerTarget
  const live = memory.inScope
  const pointerValue = !memory.pointerDeclared ? '尚未宣告'
    : !live ? '離開作用域' : target === 'null' ? 'NULL'
      : target ? addresses[target] : '尚未設定'
  return (
    <section className="pointers-memory lab-panel" aria-labelledby="pointer-memory-title">
      <div className="pointers-panel-heading">
        <small>FOLLOW THE ADDRESS</small><h2 id="pointer-memory-title">沿著位址，找到原本的變數。</h2>
      </div>
      <p className="pointers-address-note">位址是教學示意；此模型以 4 bytes 的 int 呈現，實際大小與位址依執行環境而異。</p>
      <div className="pointers-memory-cells">
        {(['x', 'y'] as const).map((name) => {
          const pointed = live && memory.pointerDeclared && target === name
          const value = !memory.valuesDeclared ? '尚未宣告' : !live ? '離開作用域' : String(memory[name])
          return (
            <div className={`pointers-memory-cell${pointed ? ' is-pointed' : ''}${pointed && frame.accessKind === 'write' ? ' is-writing' : ''}`}
              key={name} aria-label={`${name}，${value}${pointed ? '，p 指向這格' : ''}`}>
              <div><code>{name}</code>{pointed && <span>{frame.accessKind === 'write' ? '寫入' : 'p 指向這格'}</span>}</div>
              <strong>{memory.valuesDeclared && live ? memory[name] : '—'}</strong>
              <code>{addresses[name]}</code>
            </div>
          )
        })}
      </div>
      <div className={`pointers-reference${target === 'null' && live ? ' is-null' : ''}`} aria-label={`指標 p，${pointerValue}`}>
        <MapPin size={24} aria-hidden="true" />
        <div><small>p 存的是位址</small><code>{pointerValue}</code></div>
        <ArrowRight size={22} aria-hidden="true" />
        <strong>{live && target && target !== 'null' ? `指向 ${target}` : target === 'null' && live ? '沒有指向有效物件' : '—'}</strong>
      </div>
      <div className="pointers-selected" aria-label={`selected，${!memory.selectedDeclared ? '尚未宣告' : !live ? '離開作用域' : memory.selected}`}>
        <span><code>selected</code> · 讀取時複製的值</span>
        <strong>{memory.selectedDeclared && live ? memory.selected : '—'}</strong>
      </div>
      <div className="pointers-console" aria-label="指標程式輸出">
        <span><Terminal size={16} aria-hidden="true" /> printf 輸出</span>
        <code>{frame.outputText ?? '尚無輸出'}</code>
      </div>
    </section>
  )
}

export function PointerLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lessonProgress.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lessonProgress.guidedRunCompleted || readConfig(lessonProgress.savedState).target === 'null')
  const [prediction, setPrediction] = useState('')
  const [submittedPrediction, setSubmittedPrediction] = useState<number | null>(null)
  const [predictionError, setPredictionError] = useState('')
  const [activeChallenge, setActiveChallenge] = useState<ChallengeId>(() =>
    POINTER_CHALLENGES.find((challenge) => !lessonProgress.completedChallengeIds.includes(challenge.id))?.id ?? POINTER_CHALLENGES[0].id)
  const [challengePrediction, setChallengePrediction] = useState('')
  const [challengeWrite, setChallengeWrite] = useState('9')
  const [nullAnswer, setNullAnswer] = useState<'safe' | 'unsafe' | null>(null)
  const [feedback, setFeedback] = useState<Partial<Record<ChallengeId, Feedback>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const syncRef = useRef({ savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId })
  const resettingProgressRef = useRef(false)
  const simulation = useMemo(() => simulatePointerProgram(config), [config])
  const configKey = JSON.stringify(config)
  const player = useTracePlayer({ frames: simulation.frames, speed, config: configKey })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = useMemo(() => simulation.source.lines.map((line) => ({
    lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }],
  })), [simulation.source])
  const completedCount = POINTER_CHALLENGES.filter((challenge) => lessonProgress.completedChallengeIds.includes(challenge.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = syncRef.current
    const cleared = (previous.hasLesson && !hasLesson)
      || (previous.visited !== null && progress.lastVisitedLessonId === null)
    syncRef.current = { savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId }
    resettingProgressRef.current = previous.savedKey !== savedKey || cleared
    if (resettingProgressRef.current) {
      const savedConfig = readConfig(JSON.parse(savedKey))
      setConfig(savedConfig)
      setPrediction('')
      setSubmittedPrediction(null)
      setPredictionError('')
      setUnlocked(lessonProgress.guidedRunCompleted || savedConfig.target === 'null')
      if (cleared) {
        resetPlayer()
        setFeedback({})
        setActiveChallenge(POINTER_CHALLENGES[0].id)
      }
    } else if (previous.guided !== lessonProgress.guidedRunCompleted) {
      setUnlocked(lessonProgress.guidedRunCompleted)
    }
  }, [savedKey, lessonProgress.guidedRunCompleted, hasLesson, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resettingProgressRef.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: PointerConfig) => {
    setConfig(next)
    setPrediction('')
    setSubmittedPrediction(null)
    setPredictionError('')
    setUnlocked(lessonProgress.guidedRunCompleted || next.target === 'null' || validatePointerConfig(next).length > 0)
    if (validatePointerConfig(next).length === 0) {
      // Record the local write before the provider renders so storage sync does not relock it.
      syncRef.current.savedKey = JSON.stringify(next)
      rememberLessonState(LESSON_ID, next)
    }
  }
  const submitPrediction = (event: FormEvent) => {
    event.preventDefault()
    const answer = prediction.trim() === '' ? Number.NaN : Number(prediction)
    if (!Number.isInteger(answer)) { setPredictionError('請先輸入一個整數作為預測。'); return }
    setPredictionError('')
    setSubmittedPrediction(answer)
    setUnlocked(true)
    player.reset()
  }
  const completeChallenge = (id: ChallengeId, evaluation: Feedback) => {
    setFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) markChallengeCompleted(LESSON_ID, id)
  }
  const numericAnswer = (value: string) => value.trim() === '' ? null : Number(value)
  const challengeItems = POINTER_CHALLENGES.map((challenge, index) => ({
    id: challenge.id, label: challenge.title, eyebrow: `CHALLENGE 0${index + 1}`,
    completed: lessonProgress.completedChallengeIds.includes(challenge.id),
  }))
  const controls = (
    <div className="pointers-controls">
      <h2>設定指向與數值</h2>
      <label htmlFor="pointer-target">p 要指向哪裡？</label>
      <select id="pointer-target" value={config.target}
        onChange={(event) => changeConfig({ ...config, target: event.target.value as PointerTarget })}>
        <option value="x">&amp;x · x 的位址</option><option value="y">&amp;y · y 的位址</option>
        <option value="null">NULL · 不指向物件</option>
      </select>
      {(['x', 'y', 'newValue'] as const).map((field) => (
        <NumberControl key={field} field={field} value={config[field]}
          onChange={(value) => changeConfig({ ...config, [field]: value })} />
      ))}
      <button type="button" className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_POINTER_CONFIG })}>恢復預設值</button>
      <p className="functions-safety-note"><ShieldAlert size={20} aria-hidden="true" />改變參數後會回到第一步；NULL 會在讀取前安全停止。</p>
    </div>
  )

  return (
    <div className="pointers-page functions-page lab-page">
      <section className="pointers-hero functions-hero lab-hero">
        <div className="page-width">
          <nav className="breadcrumbs" aria-label="麵包屑">
            <Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" /><span>指標</span>
          </nav>
          <div className="functions-hero__layout">
            <div className="functions-hero__copy">
              <Link to="/learn" className="back-link"><ArrowLeft size={16} aria-hidden="true" />回到課程地圖</Link>
              <span className="section-kicker">MODULE 06 · LESSON 01</span>
              <h1>指標、位址與間接存取。<br />沿著 p，找到那一格。</h1>
              <p><code>&amp;x</code> 取得位址，<code>p</code> 保存位址，<code>*p</code> 存取那裡的值。跟著每一步，把三件事分清楚。</p>
            </div>
            <aside className={`lesson-status-card${completedCount === 3 ? ' complete' : ''}`} aria-label="本單元學習進度">
              <div><Trophy size={21} aria-hidden="true" /><span>{completedCount === 3 ? '單元完成' : '學習進度'}</span></div>
              <strong>{completedCount}<small>/3</small></strong><p>通過三題即可完成這個單元</p>
            </aside>
          </div>
        </div>
      </section>
      <section className="functions-overview page-width" aria-labelledby="pointer-goals-title">
        <div className="functions-objectives">
          <span className="section-kicker">LEARNING GOALS</span><h2 id="pointer-goals-title">先看位址，再看值。</h2>
          <ul><li><Check size={17} aria-hidden="true" />分辨變數的值、變數的位址與指標的值。</li>
            <li><Check size={17} aria-hidden="true" />理解透過指標改寫，會改變原本的變數。</li>
            <li><Check size={17} aria-hidden="true" />辨識 NULL 不可解參照。</li></ul>
        </div>
        <div className="functions-concepts">
          <article><span><MapPin size={20} aria-hidden="true" /></span><small>01 · 取得位址</small><h3>&amp;x：這一格在哪裡</h3><p><code>int *p = &amp;x;</code> 宣告指向 int 的指標，將 x 的位址存入 p。</p></article>
          <article><span><ArrowRight size={20} aria-hidden="true" /></span><small>02 · 解參照</small><h3>*p：讀寫那一格</h3><p><code>int selected = *p;</code> 複製值；<code>*p = 12;</code> 則改寫 p 指向的變數。</p></article>
          <article><span><ShieldAlert size={20} aria-hidden="true" /></span><small>03 · 空指標</small><h3>NULL：沒有目標</h3><p>NULL 沒有指向可存取的物件。對它解參照是未定義行為，不能預測輸出。</p></article>
        </div>
      </section>
      <section className="functions-prediction-section" aria-labelledby="pointer-prediction-title">
        <div className="page-width functions-prediction-card">
          <div className="functions-prediction-card__copy">
            <span className="section-kicker">PREDICT BEFORE RUN</span>
            <h2 id="pointer-prediction-title">改寫前，*p 會讀到什麼？</h2>
            <p>{config.target === 'null' ? '這次 p 是 NULL；直接逐步觀察模擬器在哪裡停止。' : `這次 p 保存 ${config.target} 的位址。先預測 selected 會拿到的值，再逐步驗證。`}</p>
          </div>
          {config.target !== 'null' && simulation.validationIssues.length === 0 && (
            <form className="functions-prediction-form" onSubmit={submitPrediction}>
              <label htmlFor="pointer-prediction">我預測 selected 會收到</label>
              <div><input id="pointer-prediction" type="number" step={1} value={prediction} onChange={(event) => setPrediction(event.target.value)} />
                <button className="button button-primary" type="submit">提交預測 <ArrowRight size={17} aria-hidden="true" /></button></div>
              {predictionError && <p role="alert" className="functions-form-error">{predictionError}</p>}
            </form>
          )}
          {submittedPrediction !== null && <p className="pointers-prediction-feedback" role="status">
            {frame.memory.selectedDeclared
              ? `你猜 ${submittedPrediction}，實際讀到 ${frame.memory.selected}。${submittedPrediction === frame.memory.selected ? '預測正確！' : '沿著 p 的位址，再找一次對應的變數。'}`
              : '預測已記錄。走到「透過指標讀值」時揭曉。'}
          </p>}
        </div>
      </section>
      <section className="functions-lab-section" aria-labelledby="pointer-lab-title">
        <div className="page-width">
          <div className="functions-section-heading"><span className="section-kicker">FOLLOW THE POINTER</span>
            <h2 id="pointer-lab-title">同一個位址，連起讀與寫。</h2><p>改寫 *p 會改變目標變數；p 保存的位址不變，selected 也保留讀取時的副本。</p></div>
          <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="指標參數控制"
            playback={unlocked ? <PlaybackControls playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed}
              controlName="指標執行" onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} />
              : <p className="functions-player-lock" role="status">提交上方預測後解鎖播放與單步控制。</p>}
            footer={<div className="functions-trace-footer"><div><small>STEP {player.frameIndex + 1} / {simulation.frames.length}</small><strong>{phaseLabels[frame.phase]}</strong></div>
              <p>{frame.explanation}</p>{frame.phase === 'blocked' && <p className="functions-blocked-message" role="alert">{simulation.message}</p>}</div>}>
            <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart}
              title={<><Code2 size={17} aria-hidden="true" />C 程式碼</>} status={phaseLabels[frame.phase]} />
            <PointerMemory frame={frame} />
          </LabShell>
          <p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? `${phaseLabels[frame.phase]}。${frame.explanation}` : ''}</p>
        </div>
      </section>
      <section className="pointers-challenges page-width" aria-labelledby="pointer-challenges-title">
        <div className="functions-section-heading"><span className="section-kicker">TRY IT YOURSELF</span><h2 id="pointer-challenges-title">三個挑戰，確認你能沿著指標找到值。</h2></div>
        <ChallengePanel challenges={challengeItems} activeId={activeChallenge} onSelect={setActiveChallenge} label="指標學習挑戰">
          {(challenge) => <div className="pointers-challenge-content">
            <h3>{challenge.label}</h3><p>{POINTER_CHALLENGES.find((item) => item.id === challenge.id)?.description}</p>
            {challenge.id === 'predict-pointer-read' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluatePointerPrediction(numericAnswer(challengePrediction))) }}>
              <pre className="functions-challenge-code">{'int x = 5;\nint *p = &x;\nprintf("%d", *p);'}</pre>
              <label htmlFor="pointer-challenge-prediction">預測 *p 的輸出</label>
              <input id="pointer-challenge-prediction" type="number" step={1} value={challengePrediction} onChange={(event) => setChallengePrediction(event.target.value)} />
              <button className="button button-primary" type="submit">檢查讀取答案</button>
            </form>}
            {challenge.id === 'write-through-pointer' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluatePointerWrite(numericAnswer(challengeWrite))) }}>
              <pre className="functions-challenge-code">{'int y = 9;\nint *p = &y;\n*p = newValue; /* 讓 y 變成 12 */'}</pre>
              <label htmlFor="pointer-challenge-write">要透過 *p 寫入的新值</label>
              <input id="pointer-challenge-write" type="number" step={1} value={challengeWrite} onChange={(event) => setChallengeWrite(event.target.value)} />
              <button className="button button-primary" type="submit">檢查改寫結果</button>
            </form>}
            {challenge.id === 'identify-null-pointer' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateNullPointer(nullAnswer)) }}>
              <pre className="functions-challenge-code">{'int *p = NULL;\nprintf("%d", *p);'}</pre>
              <fieldset><legend>這次可以安全讀取 *p 嗎？</legend>
                <label><input type="radio" name="pointer-null-answer" checked={nullAnswer === 'safe'} onChange={() => setNullAnswer('safe')} />可以，會讀到 0</label>
                <label><input type="radio" name="pointer-null-answer" checked={nullAnswer === 'unsafe'} onChange={() => setNullAnswer('unsafe')} />不可以，NULL 沒有指向有效物件</label>
              </fieldset><button className="button button-primary" type="submit">檢查安全判斷</button>
            </form>}
            {feedback[challenge.id] && <p className={`functions-challenge-feedback ${feedback[challenge.id]?.solved ? 'is-success' : 'is-hint'}`} role="status">{feedback[challenge.id]?.message}</p>}
          </div>}
        </ChallengePanel>
      </section>
      <section className="pointers-recap page-width">
        <h2>帶走三件事：位址、目標、值。</h2>
        <p><code>p = &amp;x</code> 改變指向；<code>*p = 12</code> 改變目標的值。只有指向有效物件時，才能透過指標存取它。</p>
        <div><Link className="button button-secondary" to="/learn/arrays/basics"><ArrowLeft size={17} aria-hidden="true" />上一課：陣列與字串</Link>
          <Link className="button button-primary" to="/learn/pointers/swap">下一課：指標參數與交換變數 <ArrowRight size={17} aria-hidden="true" /></Link></div>
      </section>
    </div>
  )
}
