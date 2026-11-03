import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_BINARY_SEARCH_CONFIG, BINARY_VALUES, simulateBinarySearchProgram, validateBinarySearchConfig, type BinarySearchConfig, type BinarySearchPhase } from '../domain/binarySearch'
import { BINARY_SEARCH_CHALLENGES, evaluateBinarySearchChallenge, type BinarySearchChallengeId } from '../data/binarySearchChallenges'

const LESSON_ID = 'arrays-binary-search' as const
const phaseLabels: Record<BinarySearchPhase, string> = {
  'enter-main': '進入 main', 'initialize-values': '建立有序陣列', 'initialize-target': '建立目標值', 'initialize-count': '設定搜尋格數',
  'initialize-left': '設定 left', 'initialize-right': '設定 right', 'initialize-found': '設定尚未找到', condition: '判斷區間',
  'initialize-mid': '計算中點', 'compare-equal': '檢查中點', record: '記錄索引', break: '提前結束',
  'compare-less': '比較大小', 'move-left': '排除左半邊', 'move-right': '排除右半邊', 'end-iteration': '本輪結束',
  print: '輸出結果', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): BinarySearchConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_BINARY_SEARCH_CONFIG }
  const config = value as BinarySearchConfig
  return validateBinarySearchConfig(config).length ? { ...DEFAULT_BINARY_SEARCH_CONFIG } : { target: config.target, count: config.count }
}
function NumberControl({ field, value, onChange }: { field: 'target' | 'count'; value: number; onChange: (value: number) => void }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (input.current) input.current.value = String(value) }, [value])
  return <div className="functions-number-control"><label htmlFor={`binary-${field}`}>{field === 'target' ? '目標值 target' : '搜尋格數 n'}</label>
    <input ref={input} id={`binary-${field}`} type="number" min={field === 'target' ? -5 : 0} max={field === 'target' ? 25 : 7} step={1} defaultValue={value}
      onChange={event => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) onChange(Number(event.target.value)) }}
      onBlur={event => { event.currentTarget.value = String(value) }} />
  </div>
}

export function BinarySearchLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<BinarySearchChallengeId>(BINARY_SEARCH_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<BinarySearchChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<BinarySearchChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateBinarySearchProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = BINARY_SEARCH_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(BINARY_SEARCH_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: BinarySearchConfig) => {
    const valid = validateBinarySearchConfig(next).length === 0
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted || !valid)
    if (valid) { sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = prediction.trim() === '' ? NaN : Number(prediction)
    if (!Number.isSafeInteger(value)) { setError('請輸入整數索引；找不到時可以填 -1。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls binary-controls"><h2>在有序資料中找目標。</h2>
    <NumberControl field="target" value={config.target} onChange={target => changeConfig({ ...config, target })} />
    <NumberControl field="count" value={config.count} onChange={count => changeConfig({ ...config, count })} />
    <p>target 接受 -5 到 25；只搜尋前 n 格，n 接受 0 到 7。底層陣列始終有七格且已遞增排序。</p>
    <div className="binary-presets"><button onClick={() => changeConfig({ target: 10, count: 7 })}>目標不存在</button><button onClick={() => changeConfig({ ...config, count: 0 })}>空搜尋區間</button><button onClick={() => changeConfig({ ...DEFAULT_BINARY_SEARCH_CONFIG })}>恢復預設值</button></div>
  </div>
  const cellState = (index: number) => !frame.mainInScope ? '已離開作用域' : frame.count === null ? '尚未設定範圍' : index >= frame.count ? '範圍外' : frame.left === null || frame.right === null ? '等待建立區間' : index >= frame.left && index <= frame.right ? '候選區間' : '已排除'

  return <div className="binary-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 二分搜尋與區間縮小</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 04</span><h1>先看中點，<br />再排除半邊。</h1><p>沿著有序陣列追蹤 left、right 與 mid。每次確認中點不相等後，就縮小待搜尋的區間。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>先排序，才有依據排除半邊。</h2><p>本例資料為 {'{2, 4, 7, 9, 12, 15, 18}'}，皆不重複且已遞增排序。若中點值太小，目標只可能在右邊；若太大，只可能在左邊。未排序資料不能直接套用這個判斷。</p><p>本課使用含兩端的閉區間 [left, right]。mid = left + (right - left) / 2；中點不相等後，用 mid + 1 或 mid - 1 排除它，避免區間卡住。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>前 {config.count} 格中，{config.target} 在哪裡？</h2><p>預測最後的 found 索引；找不到就填 -1。</p></div>
      {simulation.status === 'completed' ? <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="binary-prediction">預測最後的 found</label><div><input id="binary-prediction" type="number" step={1} value={prediction} onChange={event => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form> : <p>設定超出練習範圍，可直接逐步觀察安全停止。</p>}
      {submitted !== null && <p role="status">{frame.output === null ? '預測已記錄，輸出搜尋結果時揭曉。' : `你預測 ${submitted}，實際 found = ${frame.found}。${submitted === frame.found ? '預測正確！' : '再檢查區間如何縮小。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>中點是索引，區間包含兩端。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="二分搜尋控制"
        playback={unlocked ? <PlaybackControls controlName="二分搜尋執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="binary-execution lab-panel" aria-labelledby="binary-memory-title"><h2 id="binary-memory-title">候選區間與目前中點</h2>
          <div className="binary-memory-scroll" tabIndex={0} role="region" aria-label="有序陣列；窄螢幕可水平捲動"><ol className="binary-memory" aria-label="二分搜尋元素">{BINARY_VALUES.map((_, index) => <li key={index} aria-current={frame.midInScope && frame.mid === index ? 'step' : undefined} className={`${cellState(index) === '候選區間' ? 'is-candidate' : 'is-excluded'}${frame.midInScope && frame.mid === index ? ' is-mid' : ''}`}>
            <code>[{index}]</code><strong>{frame.mainInScope && frame.values ? frame.values[index] : '—'}</strong><small>{cellState(index)}</small>{frame.midInScope && frame.mid === index && <small>mid</small>}
          </li>)}</ol></div>
          <dl className="binary-state">{(['left', 'right', 'mid', 'found'] as const).map(name => {
            const visible = frame.mainInScope && (name !== 'mid' || frame.midInScope)
            return <div key={name}><dt>{name}</dt><dd aria-label={`${name}，${visible ? frame[name] ?? '尚未宣告' : '不在作用域'}`}>{visible ? frame[name] ?? '—' : '—'}</dd></div>
          })}</dl>
          <p aria-label="目前搜尋區間">{!frame.mainInScope ? 'main 已結束。' : frame.left === null || frame.right === null ? '尚未建立區間。' : `[${frame.left}, ${frame.right}]${frame.left > frame.right ? '：空區間，不讀取陣列。' : '：含左右端點。'}`}</p>
          <p>已檢查 {frame.inspectedIndices.length} 個中點；索引路徑：{frame.inspectedIndices.length ? frame.inspectedIndices.join(' → ') : '尚未檢查'}。</p><p className="binary-count-note">這裡計算檢查過的中點個數；不相等時，程式還會再比較一次大小。</p>
          <div className="binary-console"><h3>printf 輸出</h3><p aria-label="二分搜尋結果">{frame.output ?? '尚無輸出'}</p></div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，確定區間會前進。</h2>
      <ChallengePanel challenges={BINARY_SEARCH_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="二分搜尋學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{BINARY_SEARCH_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateBinarySearchChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`binary-answer-${item.id}`}>你的答案</label><input id={`binary-answer-${item.id}`} type="number" step={1} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>區間為空，就結束搜尋。</h2><p>每輪先判斷 left &lt;= right，才計算中點與存取元素。left &gt; right 代表沒有候選位置；n = 0 時一開始就是 [0, -1]。二分搜尋在有序資料中每輪排除約半數候選，所需輪數隨資料量呈對數成長。</p>{count === 3 && <p role="status">你已完成二分搜尋與區間縮小。</p>}<div><Link className="button button-secondary" to="/learn/arrays/search">上一課：線性搜尋</Link><Link className="button button-primary" to="/learn/pointers/basics">下一課：指標基礎</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
