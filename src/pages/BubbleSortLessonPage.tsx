import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_BUBBLE_SORT_CONFIG, simulateBubbleSortProgram, validateBubbleSortConfig, type BubbleSortConfig, type BubbleSortPhase, type BubbleSortVariable } from '../domain/bubbleSort'
import { BUBBLE_SORT_CHALLENGES, evaluateBubbleSortChallenge, type BubbleSortChallengeId } from '../data/bubbleSortChallenges'

const LESSON_ID = 'arrays-bubble-sort' as const
const phaseLabels: Record<BubbleSortPhase, string> = {
  'enter-main': '進入 main', 'initialize-values': '建立陣列', 'initialize-end': '建立右邊界', 'outer-condition': '判斷是否還有下一輪',
  'reset-swapped': '重設交換旗標', 'initialize-j': '建立比較索引', 'inner-condition': '判斷相鄰比較範圍', compare: '比較相鄰元素',
  'save-temp': '暫存左格', 'write-left': '寫入左格', 'write-right': '寫回右格', 'mark-swapped': '記錄本輪交換',
  'finish-swap': '結束交換區塊', 'increment-j': '更新 j', 'end-pass': '本輪完成', 'check-early-exit': '判斷是否提前結束',
  break: '跳出外層迴圈', 'continue-passes': '繼續後續各輪', 'finish-pass': '離開本輪區塊', 'decrement-end': '縮小右邊界',
  'initialize-k': '準備輸出', 'print-condition': '判斷輸出範圍', print: '輸出元素', 'increment-k': '更新輸出索引',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
const sampleNames = { mixed: '未排序', sorted: '已升冪排序', reverse: '反向排列', duplicates: '含重複值' }
function readConfig(value: unknown): BubbleSortConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_BUBBLE_SORT_CONFIG }
  const config = value as BubbleSortConfig
  return validateBubbleSortConfig(config).length ? { ...DEFAULT_BUBBLE_SORT_CONFIG } : { sample: config.sample, order: config.order, earlyExit: config.earlyExit }
}
function parseSequence(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  if (tokens.length !== 5 || tokens.some(token => !/^-?\d+$/.test(token) || !Number.isSafeInteger(Number(token)))) return null
  return tokens.map(Number)
}

export function BubbleSortLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<BubbleSortChallengeId>(BUBBLE_SORT_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<BubbleSortChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<BubbleSortChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateBubbleSortProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = BUBBLE_SORT_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(BUBBLE_SORT_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: BubbleSortConfig) => {
    if (validateBubbleSortConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const values = parseSequence(prediction)
    if (!values) { setError('請輸入五個整數，以空白或逗號分隔。'); return }
    setSubmitted(values); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls bubble-sort-controls"><h2>選擇陣列與排序方向</h2>
    <label htmlFor="bubble-sort-sample">陣列範例</label><select id="bubble-sort-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as BubbleSortConfig['sample'] })}>{Object.entries(sampleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <fieldset><legend>排序方向</legend><label><input type="radio" name="bubble-sort-order" checked={config.order === 'ascending'} onChange={() => changeConfig({ ...config, order: 'ascending' })} />升冪：小到大</label><label><input type="radio" name="bubble-sort-order" checked={config.order === 'descending'} onChange={() => changeConfig({ ...config, order: 'descending' })} />降冪：大到小</label></fieldset>
    <label className="bubble-sort-toggle"><input type="checkbox" checked={config.earlyExit} onChange={event => changeConfig({ ...config, earlyExit: event.target.checked })} />整輪沒有交換時提前結束</label>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_BUBBLE_SORT_CONFIG })}>恢復預設值</button>
    <p>切換提前結束，對照同一份資料的比較次數。每輪先把 swapped 歸零，有交換就保持 1。</p>
  </div>

  return <div className="bubble-sort-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 氣泡排序與提前結束</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 07</span><h1>相鄰比一比，<br />逐輪推向右端。</h1><p>從左到右比較相鄰元素，交換順序相反的一對。追蹤 end、temp 與 swapped，判斷何時能提早結束。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>一輪走到底，右端就定位。</h2><p>j 與 j + 1 是相鄰兩格；升冪時左大右小就交換，最大值會一路向右移到 end。降冪時則把最小值推到右端。每輪縮小 end，右側已放好的格子不再參與比較。交換中途的舊值保存在 temp。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>第一輪結束後，五格會怎麼排？</h2><p>目前使用「{sampleNames[config.sample]}」，方向為{config.order === 'ascending' ? '升冪' : '降冪'}。只預測第一輪，不是最終結果。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="bubble-sort-prediction">預測第一輪陣列</label><div><input id="bubble-sort-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="以空白或逗號分隔五個數字" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.firstPassValues === null ? '預測已記錄，第一輪完成時揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.firstPassValues.join('、')}。${submitted.every((value, index) => value === frame.firstPassValues![index]) ? '預測正確！' : '第一輪只保證最右格定位，再追蹤一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>相鄰交換，與右側已放好的區段。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="氣泡排序控制"
        playback={unlocked ? <PlaybackControls controlName="排序執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="bubble-sort-execution lab-panel" aria-labelledby="bubble-sort-memory-title"><h2 id="bubble-sort-memory-title">values 的五個記憶格</h2>
          <div className="bubble-sort-memory-scroll" tabIndex={0} role="region" aria-label="排序記憶格；窄螢幕可水平捲動"><ol className="bubble-sort-memory" aria-label="排序元素">{Array.from({ length: 5 }, (_, index) => <li key={index} aria-current={frame.activeIndices.includes(index) ? 'step' : undefined} className={`${index >= 5 - frame.sortedCount ? 'is-sorted' : ''} ${frame.activeIndices.includes(index) ? 'is-active' : ''}`}>
            <code>[{index}]</code><strong>{frame.mainInScope && frame.values ? frame.values[index] : '—'}</strong><small>{!frame.mainInScope ? '離開作用域' : index >= 5 - frame.sortedCount ? '已放好' : '尚未放好'}</small>
          </li>)}</ol></div>
          <dl className="bubble-sort-state">{(['end', 'j', 'swapped', 'temp', 'k'] as BubbleSortVariable[]).map(name => <div key={name}><dt>{name}</dt><dd aria-label={`${name}，${frame.variables[name].inScope ? frame.variables[name].value : '不在作用域'}`}>{frame.variables[name].inScope ? frame.variables[name].value : '—'}</dd></div>)}</dl>
          <p>完成輪數：{frame.passes}；元素比較：{frame.comparisons} 次；完成交換：{frame.swaps} 次。</p><p className="bubble-sort-count-note">只計算 values[j] 與 values[j + 1] 的比較，不包含迴圈條件或 !swapped。swapped 記錄整輪是否交換過，並非目前這一對。</p>
          <div className="bubble-sort-console"><h3>printf 輸出</h3><ol aria-label="排序輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清相鄰交換與停止條件。</h2>
      <ChallengePanel challenges={BUBBLE_SORT_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="氣泡排序學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{BUBBLE_SORT_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateBubbleSortChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`bubble-sort-answer-${item.id}`}>你的答案（數列以空白或逗號分隔）</label><input id={`bubble-sort-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>完整一輪沒有交換，才能放心停下。</h2><p>開啟提前結束後，已排序的五格仍須先比較 4 次，確認整輪沒有交換。關閉時固定比較 4 + 3 + 2 + 1 = 10 次。相反排列的最壞情況仍需平方量級的比較；一對沒交換不能代表整輪有序。相等元素不交換，可維持它們原本的相對次序。</p>{count === 3 && <p role="status">你已完成氣泡排序與提前結束。</p>}<div><Link className="button button-secondary" to="/learn/arrays/insertion-sort">上一課：插入排序</Link><Link className="button button-primary" to="/learn/arrays/string-copy">下一課：字串安全複製</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
