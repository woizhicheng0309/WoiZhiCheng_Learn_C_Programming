import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_STRUCTURE_ARRAY_CONFIG, STRUCTURE_ARRAY_ROSTERS, simulateStructureArrayProgram, validateStructureArrayConfig, type StructureArrayConfig, type StructureArrayPhase } from '../domain/structureArrays'
import { STRUCTURE_ARRAY_CHALLENGES, evaluateStructureArrayChallenge, type StructureArrayChallengeId } from '../data/structureArrayChallenges'

const LESSON_ID = 'structures-arrays' as const
const phaseLabels: Record<StructureArrayPhase, string> = {
  prepare: '準備結構陣列', 'enter-main': '進入 main', 'initialize-array': '初始化三筆資料',
  'update-member': '更新一筆的成員', 'initialize-totals': '累計歸零', 'for-init': '建立索引',
  'for-condition': '檢查索引範圍', 'add-score': '累加分數', 'if-condition': '檢查門檻',
  'count-pass': '累計達標人數', 'for-update': '索引加一', print: '輸出統計',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): StructureArrayConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STRUCTURE_ARRAY_CONFIG }
  const config = value as StructureArrayConfig
  return validateStructureArrayConfig(config).length ? { ...DEFAULT_STRUCTURE_ARRAY_CONFIG }
    : { roster: config.roster, index: config.index, score: config.score, threshold: config.threshold }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 2 && tokens.every(token => /^\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}

export function StructureArrayLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<StructureArrayChallengeId>(STRUCTURE_ARRAY_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<StructureArrayChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<StructureArrayChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateStructureArrayProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = STRUCTURE_ARRAY_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber,
    parts: line.lineNumber === 12 ? [
      { id: 'for-prefix', text: '  for (' }, { id: 'for-init', text: 'int i = 0' }, { id: 'for-separator-1', text: '; ' },
      { id: 'for-condition', text: 'i < 3' }, { id: 'for-separator-2', text: '; ' },
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
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(STRUCTURE_ARRAY_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: StructureArrayConfig) => {
    if (validateStructureArrayConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請依序輸入總分與達標人數，使用兩個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls structure-controls"><h2>設定成績資料與門檻</h2>
    <label htmlFor="structure-array-roster">原始成績資料</label><select id="structure-array-roster" value={config.roster} onChange={event => changeConfig({ ...config, roster: event.target.value as StructureArrayConfig['roster'] })}>{Object.entries(STRUCTURE_ARRAY_ROSTERS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="structure-array-index">要修改的索引</label><select id="structure-array-index" value={config.index} onChange={event => changeConfig({ ...config, index: Number(event.target.value) })}>{[0, 1, 2].map(index => <option key={index} value={index}>索引 {index}：第 {index + 1} 筆，id = {[7, 12, 21][index]}</option>)}</select>
    <label htmlFor="structure-array-score">更新分數</label><div className="structure-array-range"><input id="structure-array-score" type="range" min="0" max="100" step="1" value={config.score} onChange={event => changeConfig({ ...config, score: Number(event.target.value) })} /><output htmlFor="structure-array-score">{config.score}</output></div>
    <label htmlFor="structure-array-threshold">達標門檻</label><div className="structure-array-range"><input id="structure-array-threshold" type="range" min="0" max="100" step="1" value={config.threshold} onChange={event => changeConfig({ ...config, threshold: Number(event.target.value) })} /><output htmlFor="structure-array-threshold">{config.threshold}</output></div>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_STRUCTURE_ARRAY_CONFIG })}>恢復預設值</button>
    <p>先更新 students[{config.index}].score，再走訪全部三筆。分數等於門檻也算達標。</p>
  </div>
  return <div className="structure-page structure-array-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 結構陣列與逐筆統計</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 07 · LESSON 02</span><h1>先找到那一筆，<br />再讀取它的成員。</h1><p>把多筆學生資料放進結構陣列，更新一筆分數，再追蹤索引、成員存取、總分與達標人數如何一起變化。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>students[i] 是一筆結構，.score 是它的成員。</h2><p>結構陣列的每個元素都有自己的 id 與 score。索引 0、1、2 表示資料位置；id 是儲存的編號，兩者用途不同。students[1].score 會先選第二筆，再取得這一筆的分數。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>改完一筆，統計會怎麼變？</h2><p>先把索引 {config.index} 的分數改成 {config.score}，再計算三筆的總分，以及分數大於或等於 {config.threshold} 的人數。依序填入 total、passed。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="structure-array-prediction">預測總分、達標人數</label><div><input id="structure-array-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.printedValues === null ? '預測已記錄，執行到 printf 後揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.printedValues.join('、')}。${submitted.every((value, index) => value === frame.printedValues![index]) ? '預測正確！' : '先確認更新的是哪一筆，再檢查每筆的分數是否達到門檻。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>逐筆走訪，每次只處理索引 i 的資料。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="結構陣列控制"
        playback={unlocked ? <PlaybackControls controlName="結構陣列執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="structure-execution lab-panel" aria-label="結構陣列與統計值" data-phase={frame.phase}>
          <h3>students · 3 個元素</h3><p>{frame.students === null ? '陣列尚未建立' : frame.mainInScope ? '三個獨立的結構元素' : '陣列已離開作用域'}</p>
          <div className="structure-array-table-scroll" role="region" aria-label="可水平捲動的學生資料表" tabIndex={0}><table className="structure-array-table"><caption>索引選元素，成員名稱選資料</caption><thead><tr><th scope="col">索引</th><th scope="col">id</th><th scope="col">score</th></tr></thead><tbody>{[0, 1, 2].map(index => {
            const record = frame.mainInScope ? frame.students?.[index] : null
            return <tr key={index} aria-current={frame.activeRow === index ? 'true' : undefined} className={frame.activeRow === index ? 'is-active' : ''}>
              <th scope="row">[{index}]{config.index === index && <small>修改對象</small>}</th><td aria-label={`students[${index}].id`}>{record?.id ?? '—'}</td><td aria-label={`students[${index}].score`} className={frame.phase === 'update-member' && frame.activeRow === index ? 'is-written' : ''}>{record?.score ?? '—'}</td>
            </tr>
          })}</tbody></table></div>
          <p>編號 id 不等於陣列索引。框線標記目前處理的資料列；此表不表示實際位元組位置。</p>
          <dl className="structure-array-totals"><div><dt>i</dt><dd aria-label="目前索引 i">{frame.mainInScope && frame.iInScope ? frame.i : '—'}</dd></div><div><dt>total</dt><dd aria-label="目前總分 total">{frame.mainInScope ? frame.total ?? '—' : '—'}</dd></div><div><dt>passed</dt><dd aria-label="目前達標人數 passed">{frame.mainInScope ? frame.passed ?? '—' : '—'}</dd></div></dl>
          <p className="structure-array-condition" aria-label="目前判斷">{frame.condition ? `${frame.condition.expression} → ${frame.condition.value ? '成立' : '不成立'}` : '這一步沒有條件判斷'}</p>
          <div className="structure-console"><h3>printf 輸出</h3><ol aria-label="結構陣列統計輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，串起索引、成員與迴圈。</h2>
      <ChallengePanel challenges={STRUCTURE_ARRAY_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="結構陣列學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{STRUCTURE_ARRAY_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateStructureArrayChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`structure-array-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`structure-array-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>資料列各自獨立，統計依序累積。</h2><p>更新 students[1].score 只改第二筆的分數。for 先檢查 i &lt; 3 才進入迴圈；i 變成 3 時直接離開，不讀取 students[3]。達標判斷使用 &gt;=，等於門檻也會計入。</p>{count === 3 && <p role="status">你已完成結構陣列與逐筆統計。</p>}<div><Link className="button button-secondary" to="/learn/structures/basics">上一課：結構與成員存取</Link><Link className="button button-primary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
