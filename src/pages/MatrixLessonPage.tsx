import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_MATRIX_CONFIG, MATRIX_VALUES, simulateMatrixProgram, validateMatrixConfig, type MatrixConfig, type MatrixPhase } from '../domain/matrices'
import { MATRIX_CHALLENGES, evaluateMatrixChallenge, type MatrixChallengeId } from '../data/matrixChallenges'

const LESSON_ID = 'arrays-matrices' as const
const phaseLabels: Record<MatrixPhase, string> = {
  'enter-main': '進入 main', 'initialize-grid': '建立二維陣列', 'read-selected': '讀取指定元素',
  'print-selected': '輸出指定元素', 'initialize-sum': '建立 sum', 'initialize-outer': '建立外層變數',
  'outer-condition': '判斷外層條件', 'initialize-inner': '建立內層變數', 'inner-condition': '判斷內層條件',
  accumulate: '讀取與累加', 'print-value': '輸出元素', 'increment-inner': '更新內層',
  'increment-outer': '更新外層', 'print-sum': '輸出總和', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): MatrixConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_MATRIX_CONFIG }
  const config = value as MatrixConfig
  return validateMatrixConfig(config).length ? { ...DEFAULT_MATRIX_CONFIG } : { mode: config.mode, targetRow: config.targetRow, targetColumn: config.targetColumn }
}
function IndexControl({ field, value, onChange }: { field: 'targetRow' | 'targetColumn'; value: number; onChange: (value: number) => void }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (input.current) input.current.value = String(value) }, [value])
  return <div className="functions-number-control"><label htmlFor={`matrix-${field}`}>{field === 'targetRow' ? '指定列索引' : '指定欄索引'}</label>
    <input ref={input} id={`matrix-${field}`} type="number" min={0} max={field === 'targetRow' ? 1 : 2} step={1} defaultValue={value}
      onChange={event => { if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) onChange(Number(event.target.value)) }}
      onBlur={event => { event.currentTarget.value = String(value) }} />
  </div>
}

export function MatrixLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<MatrixChallengeId>(MATRIX_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<MatrixChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<MatrixChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateMatrixProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = MATRIX_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(MATRIX_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])

  const changeConfig = (next: MatrixConfig) => {
    const valid = validateMatrixConfig(next).length === 0
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted || !valid)
    if (valid) { sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = prediction.trim() === '' ? NaN : Number(prediction)
    if (!Number.isSafeInteger(value)) { setError('請輸入整數作為預測。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls matrix-controls"><h2>選一格，再選走訪順序。</h2>
    <IndexControl field="targetRow" value={config.targetRow} onChange={targetRow => changeConfig({ ...config, targetRow })} />
    <IndexControl field="targetColumn" value={config.targetColumn} onChange={targetColumn => changeConfig({ ...config, targetColumn })} />
    <p>讀取式的第一個索引是列（0–1），第二個是欄（0–2）。指定元素與下方迴圈的走訪變數分開。</p>
    <fieldset><legend>巢狀迴圈順序</legend>
      <label><input type="radio" name="matrix-mode" checked={config.mode === 'row-first'} onChange={() => changeConfig({ ...config, mode: 'row-first' })} />逐列：外層 row、內層 col</label>
      <label><input type="radio" name="matrix-mode" checked={config.mode === 'column-first'} onChange={() => changeConfig({ ...config, mode: 'column-first' })} />逐欄：外層 col、內層 row</label>
    </fieldset><button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_MATRIX_CONFIG })}>恢復預設值</button>
  </div>
  const cellValue = (row: number, column: number) => frame.mainInScope && frame.grid ? frame.grid[row][column] : '—'

  return <div className="matrix-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 二維陣列與巢狀走訪</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 02</span><h1>同一張表格，<br />兩種走訪路徑。</h1><p>把列、欄索引與巢狀迴圈接起來。比較讀取的順序，同時看見不變的逐列記憶體排列。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>grid[2][3]：2 列，每列 3 格。</h2><p>初始化為 {'{{1, 2, 3}, {4, 5, 6}}'}。C 的二維陣列是「元素本身也是陣列」的陣列，依逐列順序連續存放。grid[row][col] 的元素偏移是 row × 3 + col；這裡計算元素個數，不假設 int 的位元組大小。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>grid[{config.targetRow}][{config.targetColumn}] 是多少？</h2><p>先選列，再找欄；等讀取這一格時揭曉。</p></div>
      {simulation.status === 'completed' ? <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="matrix-prediction">預測指定元素的值</label><div><input id="matrix-prediction" type="number" step={1} value={prediction} onChange={event => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form> : <p>設定超出練習範圍，可直接逐步觀察安全停止。</p>}
      {submitted !== null && <p role="status">{frame.selected === null ? '預測已記錄。' : `你預測 ${submitted}，實際讀到 ${frame.selected}。${submitted === frame.selected ? '預測正確！' : '再檢查列與欄的位置。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>改變走訪順序，不改變存放順序。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="二維陣列控制"
        playback={unlocked ? <PlaybackControls controlName="二維陣列執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="matrix-execution lab-panel" aria-labelledby="matrix-grid-title"><h2 id="matrix-grid-title">表格視角：列與欄</h2>
          <div className="matrix-grid" role="list" aria-label="grid 的六個元素">{MATRIX_VALUES.flatMap((values, row) => values.map((_, column) => <div role="listitem" key={`${row}-${column}`} className={frame.activeCell?.row === row && frame.activeCell.column === column ? 'is-active' : ''} aria-label={`grid[${row}][${column}]，${cellValue(row, column)}`}>
            <code>[{row}][{column}]</code><strong>{cellValue(row, column)}</strong>
          </div>))}</div>
          <h3>記憶體視角：永遠逐列排列</h3>
          <div className="matrix-linear-scroll" tabIndex={0} role="region" aria-label="逐列記憶體示意；窄螢幕可水平捲動"><ol className="matrix-linear">{MATRIX_VALUES.flat().map((_, offset) => <li key={offset} className={frame.activeCell?.offset === offset ? 'is-active' : ''}><small>偏移 {offset}</small><strong>{cellValue(Math.floor(offset / 3), offset % 3)}</strong></li>)}</ol></div>
          <dl className="matrix-state"><div><dt>row</dt><dd aria-label={`row，${frame.rowInScope ? frame.row : '不在作用域'}`}>{frame.rowInScope ? frame.row : '—'}</dd></div><div><dt>col</dt><dd aria-label={`col，${frame.columnInScope ? frame.column : '不在作用域'}`}>{frame.columnInScope ? frame.column : '—'}</dd></div><div><dt>sum</dt><dd>{frame.mainInScope ? frame.sum ?? '—' : '—'}</dd></div></dl>
          <p className="matrix-visited">已讀取的偏移：{frame.visits.length ? frame.visits.map(visit => visit.offset).join(' → ') : '尚未走訪'}</p>
          <div className="matrix-console"><h3>printf 輸出</h3>{frame.selectedOutput && <p>{frame.selectedOutput}</p>}<ol aria-label="二維走訪輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無走訪輸出</p>}{frame.summary && <p>{frame.summary}</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，連起索引與路徑。</h2><p>共用陣列：grid[2][3] = {'{{1, 2, 3}, {4, 5, 6}}'}。</p>
      <ChallengePanel challenges={MATRIX_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="二維陣列學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{MATRIX_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateMatrixChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`matrix-answer-${item.id}`}>你的答案（數列以空白或逗號分隔）</label><input id={`matrix-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>兩種順序，都讀完同樣六格。</h2><p>逐列輸出 1、2、3、4、5、6；逐欄輸出 1、4、2、5、3、6。兩者總和都是 21，但 C 的存放順序始終逐列。每個索引都要各自檢查邊界，grid[0][3] 不等於合法的 grid[1][0]。</p>{count === 3 && <p role="status">你已完成二維陣列與巢狀走訪。</p>}<div><Link className="button button-secondary" to="/learn/arrays/basics">上一課：陣列基礎</Link><Link className="button button-primary" to="/learn/pointers/basics">下一課：指標基礎</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
