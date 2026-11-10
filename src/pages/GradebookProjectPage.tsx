import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { GRADEBOOK_CHALLENGES, evaluateGradebookChallenge, type GradebookChallengeId } from '../data/gradebookChallenges'
import {
  DEFAULT_GRADEBOOK_CONFIG, GRADEBOOK_CAPACITY, GRADEBOOK_DATASETS, GRADEBOOK_OUTCOMES, GRADEBOOK_QUERY_IDS,
  simulateGradebookProject, validateGradebookConfig, type GradebookConfig, type GradebookFrame,
} from '../domain/gradebookProject'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'

const LESSON_ID = 'projects-gradebook' as const
const decisionLabels: Record<GradebookFrame['decisions'][number]['result'], string> = {
  invalid: '欄位錯誤', long: '行過長', inserted: '已加入', duplicate: '重複，保留第一筆', updated: '重複，已更新', full: '滿表，略過新編號',
}
const reportLabels: Record<GradebookFrame['reportStatus'], string> = {
  absent: '尚未開啟', open: '等待關檔', confirmed: '已成功關閉', incomplete: '寫入失敗', unconfirmed: '關閉回報錯誤',
}
const isCheckpoint = (frame: GradebookFrame) => ['insert', 'reject', 'duplicate', 'update', 'full', 'query-result'].includes(frame.phase)

function readConfig(value: unknown): GradebookConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_GRADEBOOK_CONFIG }
  const { dataset, outcome, queryId, updateDuplicate } = value as GradebookConfig
  const config = { dataset, outcome, queryId, updateDuplicate }
  return validateGradebookConfig(config).length ? { ...DEFAULT_GRADEBOOK_CONFIG } : config
}

export function GradebookProjectPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<readonly number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<GradebookChallengeId>(GRADEBOOK_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<GradebookChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<GradebookChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateGradebookProject(config), [config])
  const sourceLines = useMemo(() => simulation.source.lines.map(({ lineNumber, code }) => ({
    lineNumber, parts: [{ id: `line-${lineNumber}`, text: code || ' ' }],
  })), [simulation.source])
  const player = useTracePlayer({ frames: simulation.frames, speed })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = GRADEBOOK_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

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
        setActiveId(GRADEBOOK_CHALLENGES[0].id)
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

  function changeConfig(next: GradebookConfig) {
    if (validateGradebookConfig(next).length) return
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
    if (tokens.length !== 2 || !/^[0-4]$/.test(tokens[0]) || !/^(-[12]|[0-3])$/.test(tokens[1])) {
      setError('請依序輸入 0 到 4 的用量，以及 -2 到 3 的查詢結果。')
      return
    }
    setSubmitted(tokens.map(Number))
    setError('')
    setUnlocked(true)
    player.reset()
    visitLesson(LESSON_ID)
  }

  const controls = (
    <div className="pointers-controls allocation-controls">
      <h2>選擇資料與查詢</h2>
      <label htmlFor="gradebook-dataset">成績檔</label>
      <select id="gradebook-dataset" value={config.dataset} onChange={event => changeConfig({ ...config, dataset: event.target.value as GradebookConfig['dataset'] })}>
        {Object.entries(GRADEBOOK_DATASETS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
      </select>
      <label htmlFor="gradebook-query">查詢編號</label>
      <select id="gradebook-query" value={config.queryId} onChange={event => changeConfig({ ...config, queryId: Number(event.target.value) })}>
        {GRADEBOOK_QUERY_IDS.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
      <label htmlFor="gradebook-outcome">I/O 情境</label>
      <select id="gradebook-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as GradebookConfig['outcome'] })}>
        {Object.entries(GRADEBOOK_OUTCOMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_GRADEBOOK_CONFIG })}>恢復預設值</button>
      <h3>scores.txt</h3>
      <pre aria-label="成績輸入檔">{GRADEBOOK_DATASETS[config.dataset].text || '（空檔案）'}</pre>
      <details open={config.updateDuplicate || undefined}>
        <summary>選做：比較更新重複紀錄</summary>
        <p>使用混合資料查詢 101。試著預測兩種規則下的分數，再切換規則確認 used 是否改變。這項練習可自行完成。</p>
        <label htmlFor="gradebook-update"><input id="gradebook-update" type="checkbox" checked={config.updateDuplicate} onChange={event => changeConfig({ ...config, updateDuplicate: event.target.checked })} /> 更新同編號的既有紀錄</label>
      </details>
    </div>
  )
  const actual = frame.exitCode !== null ? [frame.used, frame.queryIndex ?? -2] : null
  const predictionResult = submitted && actual && (
    `你預測 ${submitted.join('、')}，實際 ${actual.join('、')}。${submitted.every((value, index) => value === actual[index]) ? '預測正確！' : '回到載入與查詢步驟查看。'}`
  )
  const hasCheckpoint = simulation.frames.some(item => item.index > frame.index && isCheckpoint(item))
  const download = frame.phase === 'done' && frame.reportStatus === 'confirmed'

  return (
    <div className="allocation-page record-file-page pointers-page functions-page lab-page">
      <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
        <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 成績資料管理綜合練習</span></nav>
        <div className="functions-hero__layout">
          <div><span className="section-kicker">MODULE 10 · LESSON 01</span><h1>從讀檔到查詢，<br />完成一份成績報告。</h1><p>把已學的欄位驗證、結構陣列、線性搜尋與檔案輸出組成一支程式。</p></div>
          <aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項核心挑戰完成單元'}</p></aside>
        </div>
      </div></section>
      <section className="pointers-recap page-width">
        <h2>核心任務：載入、查詢、輸出。</h2>
        <p>每行用上一課的 id,score 格式與長度規則驗證。陣列容量為 {GRADEBOOK_CAPACITY}。每筆合法紀錄先查編號是否重複，再判斷剩餘空間。預設保留最早出現的紀錄。</p>
        <p>載入後，使用同一個 find_record 查詢編號。這個函式只比較前 used 格。找到時輸出一筆紀錄，查無時建立空報告。模擬以一次 parse_record 呼叫呈現完整欄位驗證，逐欄過程可回上一課查看。</p>
      </section>
      <section className="functions-prediction-section"><div className="page-width functions-prediction-card">
        <div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>最後存了幾筆，查詢會停在哪一格？</h2><p>依序預測 used 與查詢結果。索引從 0 開始，-1 表示查無，-2 表示因輸入錯誤而未查詢。</p></div>
        <form className="functions-prediction-form" onSubmit={predict}>
          <label htmlFor="gradebook-prediction">預測用量與查詢結果</label>
          <div><input id="gradebook-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>
          {error && <p role="alert">{error}</p>}
        </form>
        {submitted && <p role="status">{predictionResult ?? '預測已記錄，執行到回傳時揭曉。'}</p>}
      </div></section>
      <section className="functions-lab-section"><div className="page-width">
        <h2>觀察資料表與搜尋游標。</h2>
        <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="成績管理設定"
          playback={unlocked ? <>
            <PlaybackControls controlName="成績管理執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} />
            <button className="button button-secondary score-next-record" type="button" disabled={player.atEnd} onClick={() => player.jumpToNext(isCheckpoint)}>{hasCheckpoint ? '前往下一個判定' : '查看最後結果'}</button>
          </> : <p role="status">提交預測後可播放、單步執行或跳到下一個判定。</p>}
          footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p></div>}>
          <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} followActiveLine />
          <section className="allocation-execution lab-panel" aria-label="成績管理追蹤" data-phase={frame.phase}>
            <h3>資料表快照</h3>
            <p aria-label="資料表計數">用量 {frame.used}／{GRADEBOOK_CAPACITY}、無效 {frame.invalid}、重複 {frame.duplicates}、滿表 {frame.full}</p>
            <p aria-label="目前搜尋位置">{frame.probe ? `${frame.probe.purpose === 'duplicate' ? '查重' : '查詢'} ${frame.probe.id}，比較索引 ${frame.probe.index}` : '目前沒有比較'} </p>
            <div className="structure-array-table-scroll">
              <table className="structure-array-table" aria-label="成績資料表">
                <thead><tr><th scope="col">索引</th><th scope="col">id</th><th scope="col">score</th></tr></thead>
                <tbody>{frame.slots.map((record, index) => <tr key={index} className={frame.probe?.index === index ? 'is-active' : undefined}><th scope="row">{index}</th><td>{record?.id ?? '—'}</td><td>{record?.score ?? '—'}</td></tr>)}</tbody>
              </table>
            </div>
            <p aria-label="本行緩衝區">本行 {frame.line === null ? '—' : JSON.stringify(frame.line)}</p>
            <p aria-label="通過驗證的暫存紀錄">暫存 Record {frame.record ? `${frame.record.id},${frame.record.score}` : '—'}</p>
            <h3>載入判定</h3>
            <ol aria-label="逐筆載入判定">{frame.decisions.map(item => <li key={item.row}><code>{JSON.stringify(item.text)}</code> {decisionLabels[item.result]}</li>)}</ol>
            <h3>查詢與報告</h3>
            <p aria-label="查詢索引">查詢索引 {frame.queryIndex ?? '—'}</p>
            <p aria-label="報告檔狀態">{reportLabels[frame.reportStatus]}</p>
            <pre aria-label="報告內容">{frame.report || '（空白）'}</pre>
            {download && <a className="button button-secondary" download="lookup.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(frame.report)}`}>下載 lookup.txt</a>}
            <div className="allocation-console"><h3>主控台</h3><pre aria-label="成績程式輸出">{frame.stdout || '尚無輸出'}</pre></div>
          </section>
        </LabShell>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
      </div></section>
      <section className="pointers-challenges page-width">
        <h2>三個核心挑戰。</h2>
        <ChallengePanel challenges={GRADEBOOK_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="成績管理核心挑戰">
          {item => <div className="pointers-challenge-content">
            <h3>{item.label}</h3><p>{GRADEBOOK_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
            <form onSubmit={event => {
              event.preventDefault()
              const result = evaluateGradebookChallenge(item.id, answers[item.id] ?? '')
              setFeedback(current => ({ ...current, [item.id]: result }))
              if (result.solved) markChallengeCompleted(LESSON_ID, item.id)
            }}>
              <label htmlFor={`gradebook-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label>
              <input id={`gradebook-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} />
              <button className="button button-primary" type="submit">檢查答案</button>
            </form>
            {feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
          </div>}
        </ChallengePanel>
      </section>
      <section className="pointers-recap page-width">
        <h2>把有效範圍、查詢結果與輸出狀態分開。</h2>
        <p>used 決定哪些格子有資料。查詢結果決定報告是否寫入一筆。只有成功關檔的報告可下載。程式會以 w 模式建立或清空 lookup.txt，I/O 設定則由模擬器提供。</p>
        {count === 3 && <p role="status">你已完成成績資料管理綜合練習。</p>}
        <div><Link className="button button-secondary" to="/learn/files/record-filter">上一課：多欄紀錄驗證與檔案輸出</Link><Link className="button button-primary" to="/learn">回到課程地圖</Link></div>
      </section>
    </div>
  )
}
