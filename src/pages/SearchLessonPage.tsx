import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_SEARCH_CONFIG, SEARCH_VALUES, simulateSearchProgram, validateSearchConfig, type SearchConfig, type SearchPhase } from '../domain/search'
import { SEARCH_CHALLENGES, evaluateSearchChallenge, type SearchChallengeId } from '../data/searchChallenges'

const LESSON_ID = 'arrays-search' as const
const phaseLabels: Record<SearchPhase, string> = {
  'enter-main': '進入 main', 'initialize-values': '建立陣列', 'initialize-target': '建立目標值',
  'initialize-found': '設定尚未找到', 'initialize-index': '建立索引', condition: '判斷邊界',
  compare: '比較元素值', record: '記錄相符索引', break: '提前結束', increment: '更新索引',
  print: '輸出搜尋結果', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): SearchConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SEARCH_CONFIG }
  const config = value as SearchConfig
  return validateSearchConfig(config).length ? { ...DEFAULT_SEARCH_CONFIG } : { target: config.target, mode: config.mode }
}

export function SearchLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<SearchChallengeId>(SEARCH_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<SearchChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<SearchChallengeId, { solved: boolean; message: string }>>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateSearchProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = SEARCH_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => { if (inputRef.current) inputRef.current.value = String(config.target) }, [config.target])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(SEARCH_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: SearchConfig) => {
    const valid = validateSearchConfig(next).length === 0
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted || !valid)
    if (valid) { sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = prediction.trim() === '' ? NaN : Number(prediction)
    if (!Number.isSafeInteger(value)) { setError('請輸入整數作為預測；找不到時可以填 -1。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls search-controls"><h2>要找哪個值？</h2><label htmlFor="search-target">目標值 target</label>
    <input ref={inputRef} id="search-target" type="number" min={-5} max={15} step={1} defaultValue={config.target}
      onChange={event => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) changeConfig({ ...config, target: Number(event.target.value) }) }}
      onBlur={event => { event.currentTarget.value = String(config.target) }} />
    <p>本練習接受 -5 到 15。陣列固定為 4、7、2、7、5，其中 7 有兩筆。</p>
    <fieldset><legend>搜尋策略</legend>
      <label><input type="radio" name="search-mode" checked={config.mode === 'first'} onChange={() => changeConfig({ ...config, mode: 'first' })} />第一筆：相符後 break</label>
      <label><input type="radio" name="search-mode" checked={config.mode === 'last'} onChange={() => changeConfig({ ...config, mode: 'last' })} />最後一筆：相符後繼續搜尋</label>
    </fieldset><div className="search-presets"><button onClick={() => changeConfig({ ...config, target: 9 })}>試試找不到的 9</button><button onClick={() => changeConfig({ ...DEFAULT_SEARCH_CONFIG })}>恢復預設值</button></div>
  </div>

  return <div className="search-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 線性搜尋與提前結束</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 03</span><h1>找到一筆就停，<br />還是繼續往後找？</h1><p>從索引 0 開始逐格比較。觀察重複值、break 與 found，理解第一筆和最後一筆為什麼不同。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>比較的是值，記錄的是索引。</h2><p>values = {'{4, 7, 2, 7, 5}'}。索引 1 與 3 的值都是 7。found 先設為 -1；相符時記錄 i，找不到就維持 -1。這個狀態標記不能拿來讀取 values[-1]。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>搜尋 {config.target}，最後 found 是多少？</h2><p>目前策略：{config.mode === 'first' ? '第一筆相符就停止' : '走完陣列，保留最後一筆'}。請預測索引，或填 -1 表示找不到。</p></div>
      {simulation.status === 'completed' ? <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="search-prediction">預測最後的 found</label><div><input id="search-prediction" type="number" step={1} value={prediction} onChange={event => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form> : <p>設定超出練習範圍，可直接逐步觀察安全停止。</p>}
      {submitted !== null && <p role="status">{frame.output === null ? '預測已記錄，輸出搜尋結果時揭曉。' : `你預測 ${submitted}，實際 found = ${frame.found}。${submitted === frame.found ? '預測正確！' : '再檢查索引與停止時機。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>每次只比較一格，看見何時停止。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="線性搜尋控制"
        playback={unlocked ? <PlaybackControls controlName="搜尋執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="search-execution lab-panel" aria-labelledby="search-memory-title"><h2 id="search-memory-title">values 的五個記憶格</h2>
          <div className="search-memory-scroll" tabIndex={0} role="region" aria-label="陣列記憶格；窄螢幕可水平捲動"><ol className="search-memory" aria-label="values 元素">{SEARCH_VALUES.map((_, index) => <li key={index} aria-current={frame.activeIndex === index ? 'step' : undefined} className={frame.activeIndex === index ? 'is-active' : ''}>
            <code>[{index}]</code><strong>{frame.mainInScope && frame.values ? frame.values[index] : '—'}</strong><small>{frame.mainInScope && frame.found === index ? '已記錄索引' : frame.comparedIndices.includes(index) ? '已比較' : '尚未比較'}</small>
          </li>)}</ol></div>
          <dl className="search-state"><div><dt>i</dt><dd aria-label={`i，${frame.iInScope ? frame.i : '不在作用域'}`}>{frame.iInScope ? frame.i : '—'}</dd></div><div><dt>target</dt><dd>{frame.mainInScope ? frame.target ?? '—' : '—'}</dd></div><div><dt>found</dt><dd aria-label={`found，${!frame.mainInScope ? '離開作用域' : frame.found ?? '尚未宣告'}`}>{frame.mainInScope ? frame.found ?? '—' : '—'}</dd></div></dl>
          <p aria-label="目前比較結果">{frame.matched === null ? '執行到 if 時才比較 values[i] 與 target。' : `values[${frame.activeIndex}] = ${frame.values![frame.activeIndex!]}，${frame.matched ? '等於' : '不等於'} target = ${frame.target}。`}</p>
          <p>已比較 {frame.comparedIndices.length} / 5 格；路徑：{frame.comparedIndices.length ? frame.comparedIndices.join(' → ') : '尚未開始'}</p>
          <div className="search-console"><h3>printf 輸出</h3><p aria-label="搜尋結果輸出">{frame.output ?? '尚無輸出'}</p></div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清索引與狀態。</h2><p>共用陣列：{'{4, 7, 2, 7, 5}'}，合法索引為 0 到 4。</p>
      <ChallengePanel challenges={SEARCH_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="線性搜尋學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{SEARCH_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateSearchChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`search-answer-${item.id}`}>你的答案</label><input id={`search-answer-${item.id}`} type="number" step={1} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>是否提前結束，取決於你要找哪一筆。</h2><p>第一筆策略在命中後 break；最後一筆策略會走完陣列並覆寫 found。找不到時兩者都比較五格，保留 -1。這是線性搜尋：資料不必先排序，最壞情況需要逐格比較所有元素。</p>{count === 3 && <p role="status">你已完成線性搜尋與提前結束。</p>}<div><Link className="button button-secondary" to="/learn/arrays/matrices">上一課：二維陣列</Link><Link className="button button-primary" to="/learn/arrays/binary-search">下一課：二分搜尋</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
