import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_INSERTION_SORT_CONFIG, simulateInsertionSortProgram, validateInsertionSortConfig, type InsertionSortConfig, type InsertionSortPhase, type InsertionVariable } from '../domain/insertionSort'
import { INSERTION_SORT_CHALLENGES, evaluateInsertionSortChallenge, type InsertionSortChallengeId } from '../data/insertionSortChallenges'

const LESSON_ID = 'arrays-insertion-sort' as const
const phaseLabels: Record<InsertionSortPhase, string> = {
  'enter-main': '進入 main', 'initialize-values': '建立陣列', 'initialize-i': '建立外層索引',
  'outer-condition': '判斷是否還有下一輪', 'save-key': '暫存 key', 'initialize-j': '設定 j',
  'check-index': '先檢查邊界', 'compare-value': '再比較元素', shift: '右移元素', 'decrement-j': '向左前進',
  'write-key': '寫回 key', 'end-pass': '有序前綴擴大', 'increment-i': '下一輪',
  'initialize-k': '準備輸出', 'print-condition': '判斷輸出範圍', print: '輸出元素',
  'increment-k': '更新輸出索引', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
const sampleNames = { mixed: '未排序', sorted: '已升冪排序', reverse: '反向排列', duplicates: '含重複值' }
function readConfig(value: unknown): InsertionSortConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_INSERTION_SORT_CONFIG }
  const config = value as InsertionSortConfig
  return validateInsertionSortConfig(config).length ? { ...DEFAULT_INSERTION_SORT_CONFIG } : { sample: config.sample, order: config.order }
}
function parseSequence(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  if (tokens.length !== 5 || tokens.some(token => !/^-?\d+$/.test(token) || !Number.isSafeInteger(Number(token)))) return null
  return tokens.map(Number)
}

export function InsertionSortLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<InsertionSortChallengeId>(INSERTION_SORT_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<InsertionSortChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<InsertionSortChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateInsertionSortProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => line.lineNumber === 8 ? {
    lineNumber: 8,
    parts: [
      { id: 'while-prefix', text: '    while (' }, { id: 'index-guard', text: 'j >= 0' },
      { id: 'while-and', text: ' && ' }, { id: 'value-compare', text: `values[j] ${config.order === 'descending' ? '<' : '>'} key` },
      { id: 'while-suffix', text: ') {' },
    ],
  } : { lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] })
  const count = INSERTION_SORT_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(INSERTION_SORT_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: InsertionSortConfig) => {
    if (validateInsertionSortConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const values = parseSequence(prediction)
    if (!values) { setError('請輸入五個整數，以空白或逗號分隔。'); return }
    setSubmitted(values); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls insertion-controls"><h2>選擇陣列與排序方向</h2>
    <label htmlFor="insertion-sample">陣列範例</label><select id="insertion-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as InsertionSortConfig['sample'] })}>{Object.entries(sampleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <fieldset><legend>排序方向</legend><label><input type="radio" name="insertion-order" checked={config.order === 'ascending'} onChange={() => changeConfig({ ...config, order: 'ascending' })} />升冪：小到大</label><label><input type="radio" name="insertion-order" checked={config.order === 'descending'} onChange={() => changeConfig({ ...config, order: 'descending' })} />降冪：大到小</label></fieldset>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_INSERTION_SORT_CONFIG })}>恢復預設值</button>
    <p>升冪時右移比 key 大的元素；降冪時右移比 key 小的元素。相等時不右移。</p>
  </div>


  return <div className="insertion-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 插入排序與右移</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 06</span><h1>先保留 key，<br />再讓出插入位置。</h1><p>逐格右移左側不合順序的元素，把 key 插回合適位置，讓有序前綴逐輪擴大。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>有序前綴，仍可能被下一個 key 改動。</h2><p>本課未排序範例是 {'{4, 3, 1, 5, 2}'}。第一格本身有序；每輪從 i 取出 key，再向左檢查、右移元素，最後寫回 key。和選擇排序不同，有序前綴裡的元素還不一定在全陣列的最終位置。</p><p>先檢查 j &gt;= 0，再以 &amp;&amp; 連接元素比較。j = -1 時右側不執行，避免讀取 values[-1]；最後寫回的位置 j + 1 則是合法的 0。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>第一輪插入後，五格會怎麼排？</h2><p>目前使用「{sampleNames[config.sample]}」，方向為{config.order === 'ascending' ? '升冪' : '降冪'}。只預測 i = 1 這一輪，不是最終結果。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="insertion-prediction">預測第一輪陣列</label><div><input id="insertion-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="以空白或逗號分隔五個數字" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.firstPassValues === null ? '預測已記錄，第一輪完成時揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.firstPassValues.join('、')}。${submitted.every((value, index) => value === frame.firstPassValues![index]) ? '預測正確！' : '第一輪只整理前兩格，再追蹤一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>保留 key，讓元素往右移。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="插入排序控制"
        playback={unlocked ? <PlaybackControls controlName="插入排序執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="insertion-execution lab-panel" aria-labelledby="insertion-memory-title"><h2 id="insertion-memory-title">values 與待填位置</h2>
          <div className="insertion-memory-scroll" tabIndex={0} role="region" aria-label="插入排序記憶格；窄螢幕可水平捲動"><ol className="insertion-memory" aria-label="插入排序元素">{Array.from({ length: 5 }, (_, index) => <li key={index} aria-current={frame.activeIndices.includes(index) ? 'step' : undefined} className={`${frame.holeIndex === null && index < frame.sortedCount ? 'is-sorted' : ''} ${frame.holeIndex === index ? 'is-hole' : ''} ${frame.activeIndices.includes(index) ? 'is-active' : ''}`}>
            <code>[{index}]</code><strong>{frame.mainInScope && frame.values ? frame.values[index] : '—'}</strong><small>{!frame.mainInScope ? '離開作用域' : frame.values === null ? '尚未建立' : frame.holeIndex === index ? '待填位置' : frame.holeIndex !== null && index < frame.sortedCount ? '整理中' : index < frame.sortedCount ? '有序前綴' : '尚未整理'}</small>
          </li>)}</ol></div>
          <p className="insertion-note">「待填位置」是演算法示意，該格仍保留實際數值；需要插入的元素另外存在 key 中。</p>
          <dl className="insertion-state">{(['i', 'key', 'j', 'k'] as InsertionVariable[]).map(name => <div key={name}><dt>{name}</dt><dd aria-label={`${name}，${frame.variables[name].inScope ? frame.variables[name].value : '不在作用域'}`}>{frame.variables[name].inScope ? frame.variables[name].value : '—'}</dd></div>)}</dl>
          <p>元素比較：{frame.comparisons} 次；右移：{frame.shifts} 次。</p><p className="insertion-note">比較次數只計 values[j] 與 key 的比較，不含 j &gt;= 0。右移次數不包含最後將 key 寫回。</p>
          <div className="insertion-console"><h3>printf 輸出</h3><ol aria-label="插入排序輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，連起暫存、位移與邊界。</h2>
      <ChallengePanel challenges={INSERTION_SORT_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="插入排序學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{INSERTION_SORT_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateInsertionSortChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`insertion-answer-${item.id}`}>你的答案（數列以空白或逗號分隔）</label><input id={`insertion-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>資料越接近有序，通常需要越少右移。</h2><p>本課已升冪排序的五格做升冪插入排序時，比較 4 次、右移 0 次；反向排列則比較 10 次、右移 10 次。一般 n 格資料，已排序時需要 n − 1 次元素比較，最壞情況的比較與右移次數隨資料量呈平方成長。</p>{count === 3 && <p role="status">你已完成插入排序與右移。</p>}<div><Link className="button button-secondary" to="/learn/arrays/selection-sort">上一課：選擇排序</Link><Link className="button button-primary" to="/learn/pointers/basics">下一課：指標基礎</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
