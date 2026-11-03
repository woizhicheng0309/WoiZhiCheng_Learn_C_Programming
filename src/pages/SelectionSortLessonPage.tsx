import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_SELECTION_SORT_CONFIG, simulateSelectionSortProgram, validateSelectionSortConfig, type SelectionSortConfig, type SelectionSortPhase, type SortVariable } from '../domain/selectionSort'
import { SELECTION_SORT_CHALLENGES, evaluateSelectionSortChallenge, type SelectionSortChallengeId } from '../data/selectionSortChallenges'

const LESSON_ID = 'arrays-selection-sort' as const
const phaseLabels: Record<SelectionSortPhase, string> = {
  'enter-main': '進入 main', 'initialize-values': '建立陣列', 'initialize-i': '建立外層索引', 'outer-condition': '判斷是否還有下一輪',
  'initialize-best': '設定候選索引', 'initialize-j': '建立比較索引', 'inner-condition': '判斷比較範圍', compare: '比較元素',
  'update-best': '更新候選索引', 'increment-j': '更新 j', 'check-swap': '判斷是否交換', 'save-temp': '暫存原值',
  'write-front': '寫入前方位置', 'write-best': '寫回暫存值', 'finish-swap': '結束交換區塊', 'end-pass': '本輪完成',
  'increment-i': '前進到下一輪', 'initialize-k': '準備輸出', 'print-condition': '判斷輸出範圍', print: '輸出元素',
  'increment-k': '更新輸出索引', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
const sampleNames = { mixed: '未排序', sorted: '已升冪排序', reverse: '反向排列', duplicates: '含重複值' }
function readConfig(value: unknown): SelectionSortConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SELECTION_SORT_CONFIG }
  const config = value as SelectionSortConfig
  return validateSelectionSortConfig(config).length ? { ...DEFAULT_SELECTION_SORT_CONFIG } : { sample: config.sample, order: config.order }
}
function parseSequence(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  if (tokens.length !== 5 || tokens.some(token => !/^-?\d+$/.test(token) || !Number.isSafeInteger(Number(token)))) return null
  return tokens.map(Number)
}

export function SelectionSortLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<SelectionSortChallengeId>(SELECTION_SORT_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<SelectionSortChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<SelectionSortChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateSelectionSortProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = SELECTION_SORT_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(SELECTION_SORT_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: SelectionSortConfig) => {
    if (validateSelectionSortConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const values = parseSequence(prediction)
    if (!values) { setError('請輸入五個整數，以空白或逗號分隔。'); return }
    setSubmitted(values); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls sort-controls"><h2>選擇陣列與排序方向</h2>
    <label htmlFor="sort-sample">陣列範例</label><select id="sort-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as SelectionSortConfig['sample'] })}>{Object.entries(sampleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <fieldset><legend>排序方向</legend><label><input type="radio" name="sort-order" checked={config.order === 'ascending'} onChange={() => changeConfig({ ...config, order: 'ascending' })} />升冪：小到大</label><label><input type="radio" name="sort-order" checked={config.order === 'descending'} onChange={() => changeConfig({ ...config, order: 'descending' })} />降冪：大到小</label></fieldset>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_SELECTION_SORT_CONFIG })}>恢復預設值</button>
    <p>best 記錄候選的索引。升冪時找最小值，降冪時找最大值；每輪只放好一個位置。</p>
  </div>

  return <div className="sort-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 選擇排序與交換</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 05</span><h1>每輪選一個，<br />放到正確位置。</h1><p>在尚未排序的區段找出候選，再交換到前方。逐步觀察 best、temp 與逐漸擴大的已排序區段。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>先找位置，再交換資料。</h2><p>i 是這一輪要放好的位置，best 先設為 i，再用 j 比較右邊每一格。best 與 i 不同時，先用 temp 保存原值，再完成兩次陣列寫入。交換中間兩格可能暫時相同，原值仍保留在 temp。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>第一輪結束後，五格會怎麼排？</h2><p>目前使用「{sampleNames[config.sample]}」，方向為{config.order === 'ascending' ? '升冪' : '降冪'}。只預測第一輪，不是最終結果。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="sort-prediction">預測第一輪陣列</label><div><input id="sort-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="以空白或逗號分隔五個數字" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.firstPassValues === null ? '預測已記錄，第一輪完成時揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.firstPassValues.join('、')}。${submitted.every((value, index) => value === frame.firstPassValues![index]) ? '預測正確！' : '第一輪只放好前方一格，再追蹤一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>候選的位置，與已放好的區段。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="選擇排序控制"
        playback={unlocked ? <PlaybackControls controlName="排序執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="sort-execution lab-panel" aria-labelledby="sort-memory-title"><h2 id="sort-memory-title">values 的五個記憶格</h2>
          <div className="sort-memory-scroll" tabIndex={0} role="region" aria-label="排序記憶格；窄螢幕可水平捲動"><ol className="sort-memory" aria-label="排序元素">{Array.from({ length: 5 }, (_, index) => <li key={index} aria-current={frame.activeIndices.includes(index) ? 'step' : undefined} className={`${index < frame.sortedCount ? 'is-sorted' : ''} ${frame.activeIndices.includes(index) ? 'is-active' : ''}`}>
            <code>[{index}]</code><strong>{frame.mainInScope && frame.values ? frame.values[index] : '—'}</strong><small>{!frame.mainInScope ? '離開作用域' : index < frame.sortedCount ? '已放好' : '尚未放好'}</small>
          </li>)}</ol></div>
          <dl className="sort-state">{(['i', 'j', 'best', 'temp', 'k'] as SortVariable[]).map(name => <div key={name}><dt>{name}</dt><dd aria-label={`${name}，${frame.variables[name].inScope ? frame.variables[name].value : '不在作用域'}`}>{frame.variables[name].inScope ? frame.variables[name].value : '—'}</dd></div>)}</dl>
          <p>元素比較：{frame.comparisons} 次；完成交換：{frame.swaps} 次。</p><p className="sort-count-note">只計算 values[j] 與 values[best] 的比較，不包含迴圈條件或 best != i。</p>
          <div className="sort-console"><h3>printf 輸出</h3><ol aria-label="排序輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清候選、交換與比較。</h2>
      <ChallengePanel challenges={SELECTION_SORT_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="選擇排序學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{SELECTION_SORT_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateSelectionSortChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`sort-answer-${item.id}`}>你的答案（數列以空白或逗號分隔）</label><input id={`sort-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>已排序時，不交換也仍要比較。</h2><p>本課五格的選擇排序固定比較 4 + 3 + 2 + 1 = 10 次。每輪最多一次交換，best == i 時不交換；資料已排好也不會省略內層比較。一般 n 格資料需要 n(n − 1)/2 次元素比較，隨資料量呈平方成長。</p>{count === 3 && <p role="status">你已完成選擇排序與交換。</p>}<div><Link className="button button-secondary" to="/learn/arrays/binary-search">上一課：二分搜尋</Link><Link className="button button-primary" to="/learn/pointers/basics">下一課：指標基礎</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
