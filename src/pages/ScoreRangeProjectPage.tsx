import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { SCORE_RANGE_CHALLENGES, evaluateScoreRangeChallenge, type ScoreRangeChallengeId } from '../data/scoreRangeChallenges'
import {
  DEFAULT_SCORE_RANGE_CONFIG, SCORE_RANGE_SAMPLES, simulateScoreRangeProject, validateScoreRangeConfig,
  type ScoreRangeConfig, type ScoreRangeFrame,
} from '../domain/scoreRange'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'

const LESSON_ID = 'projects-score-range' as const
const isCheckpoint = (frame: ScoreRangeFrame) => ['insert', 'sorted', 'receive-bound'].includes(frame.phase)
function readConfig(value: unknown): ScoreRangeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SCORE_RANGE_CONFIG }
  const { sample, count, low, high } = value as ScoreRangeConfig
  const config = { sample, count, low, high }
  return validateScoreRangeConfig(config).length ? { ...DEFAULT_SCORE_RANGE_CONFIG } : config
}

export function ScoreRangeProjectPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<readonly number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<ScoreRangeChallengeId>(SCORE_RANGE_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<ScoreRangeChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<ScoreRangeChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateScoreRangeProject(config), [config])
  const sourceLines = useMemo(() => simulation.source.lines.map(({ lineNumber, code }) => ({
    lineNumber, parts: [{ id: `line-${lineNumber}`, text: code || ' ' }],
  })), [simulation.source])
  const player = useTracePlayer({ frames: simulation.frames, speed })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = SCORE_RANGE_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

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
        setActiveId(SCORE_RANGE_CHALLENGES[0].id)
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

  function changeConfig(next: ScoreRangeConfig) {
    if (validateScoreRangeConfig(next).length) return
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
    if (tokens.length !== 2 || !tokens.every(token => /^[0-6]$/.test(token)) || Number(tokens[0]) > Number(tokens[1])) {
      setError('請依序輸入 begin 與 end，使用 0 到 6 的整數，且 begin 不超過 end。')
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
      <h2>選擇資料與分數範圍</h2>
      <label htmlFor="score-range-sample">成績資料</label>
      <select id="score-range-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as ScoreRangeConfig['sample'] })}>
        {Object.entries(SCORE_RANGE_SAMPLES).map(([key, sample]) => <option key={key} value={key}>{sample.label}</option>)}
      </select>
      {([
        ['count', '有效筆數', 0, 6],
        ['low', '分數下界（包含）', 0, config.high],
        ['high', '分數上界（包含）', config.low, 100],
      ] as const).map(([field, label, min, max]) => (
        <div key={field}>
          <label htmlFor={`score-range-${field}`}>{label}</label>
          <div className="allocation-range">
            <input id={`score-range-${field}`} type="range" min={min} max={max} value={config[field]} onChange={event => changeConfig({ ...config, [field]: Number(event.target.value) })} />
            <output htmlFor={`score-range-${field}`}>{config[field]}</output>
          </div>
        </div>
      ))}
      <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_SCORE_RANGE_CONFIG })}>恢復預設值</button>
      <p>本次處理前 {config.count} 筆，查詢 {config.low}～{config.high} 分，包含上下界。</p>
      <details><summary>選做：全體同分的邊界</summary>
        <p>先手算六筆都是 75 分時的兩個邊界，再載入資料驗證。將範圍移到 76～100 分，觀察兩個邊界能否都等於 count。</p>
        <button className="functions-restore-button" onClick={() => changeConfig({ sample: 'equal', count: 6, low: 75, high: 75 })}>載入同分邊界練習</button>
      </details>
    </div>
  )
  const actual = frame.revealed ? [frame.begin, frame.end] : null
  const predictionResult = submitted && actual && (
    `你預測 ${submitted.join('、')}，實際 ${actual.join('、')}。${submitted.every((value, index) => value === actual[index]) ? '預測正確！' : '比較兩次搜尋對相等分數的處理。'}`
  )
  const hasCheckpoint = simulation.frames.some(item => item.index > frame.index && isCheckpoint(item))
  const isMatched = (index: number) => frame.begin !== null && frame.end !== null && index >= frame.begin && index < frame.end

  return (
    <div className="allocation-page record-file-page score-range-page pointers-page functions-page lab-page">
      <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
        <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 成績排序與區間查詢</span></nav>
        <div className="functions-hero__layout">
          <div><span className="section-kicker">MODULE 10 · LESSON 02</span><h1>先整理成績，<br />找出區間內的每一筆。</h1><p>按分數穩定排序，再用兩次二分搜尋找出包含所有同分紀錄的範圍。</p></div>
          <aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項核心挑戰完成單元'}</p></aside>
        </div>
      </div></section>
      <section className="pointers-recap page-width">
        <h2>核心任務：整筆排序，找到兩個邊界，再走訪結果。</h2>
        <p>範例直接初始化已驗證的紀錄，指定 count 決定有效範圍。插入排序的 key 保存整份 Record，移動時 id 與 score 一起移動。只有較大的分數會右移，因此同分紀錄維持原始順序。</p>
        <p>第一次找第一筆 score ≥ 下界的位置 begin，第二次找第一筆 score &gt; 上界的位置 end。符合分數條件的資料位於半開索引範圍 [begin, end)，共有 end - begin 筆。</p>
      </section>
      <section className="functions-prediction-section"><div className="page-width functions-prediction-card">
        <div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>兩個邊界最後停在哪裡？</h2><p>依序預測 begin 與 end。邊界可以等於 count，兩者相等時結果為空。</p></div>
        <form className="functions-prediction-form" onSubmit={predict}>
          <label htmlFor="score-range-prediction">預測 begin 與 end</label>
          <div><input id="score-range-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>
          {error && <p role="alert">{error}</p>}
        </form>
        {submitted && <p role="status">{predictionResult ?? '預測已記錄，執行到結果輸出時揭曉。'}</p>}
      </div></section>
      <section className="functions-lab-section"><div className="page-width">
        <h2>觀察排序前綴、暫存紀錄與搜尋範圍。</h2>
        <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="成績區間設定"
          playback={unlocked ? <>
            <PlaybackControls controlName="成績區間執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} />
            <button className="button button-secondary score-next-record" type="button" disabled={player.atEnd} onClick={() => player.jumpToNext(isCheckpoint)}>{hasCheckpoint ? '前往下一個階段' : '查看最後結果'}</button>
          </> : <p role="status">提交預測後可播放、單步執行或跳到下一個階段。</p>}
          footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p></div>}>
          <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} followActiveLine />
          <section className="allocation-execution lab-panel" aria-label="成績區間追蹤" data-phase={frame.phase}>
            <h3>資料表快照</h3>
            <p aria-label="有序前綴">有效筆數 {frame.count ?? '—'}，有序前綴 {frame.sortedPrefix} 筆。</p>
            <div className="structure-array-table-scroll">
              <table className="structure-array-table" aria-label="區間成績資料表">
                <thead><tr><th scope="col">索引</th><th scope="col">id</th><th scope="col">score</th><th scope="col">狀態</th></tr></thead>
                <tbody>{frame.rows?.map((record, index) => (
                  <tr key={index} className={frame.activeIndices.includes(index) ? 'is-active' : isMatched(index) ? 'is-written' : undefined}>
                    <th scope="row">{index}</th><td>{record.id}</td><td>{record.score}</td>
                    <td>{frame.count === null || index >= frame.count ? '本次未使用' : frame.hole === index ? '待放回 key' : isMatched(index) ? '符合區間' : index < frame.sortedPrefix ? '有序前綴' : '待排序'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <dl className="allocation-variables">
              <div><dt>排序暫存 key</dt><dd aria-label="排序暫存 key">{frame.key ? `${frame.key.id},${frame.key.score}` : '—'}</dd></div>
              <div><dt>j</dt><dd aria-label="排序 j">{frame.j ?? '—'}</dd></div>
              <div><dt>待填位置</dt><dd>{frame.hole ?? '—'}</dd></div>
            </dl>
            <p>待填位置是排序的追蹤標記。陣列格子在右移後仍保留指定的內容，key 已另存完整紀錄。</p>
            <h3>目前的二分搜尋</h3>
            <p aria-label="搜尋種類">{frame.search ? frame.search.kind === 'lower' ? '下界：第一筆至少達到目標分數' : '上界：第一筆超過目標分數' : '尚未進入或已完成'}</p>
            <dl className="allocation-variables">
              <div><dt>候選範圍 [left, right)</dt><dd aria-label="搜尋候選範圍">{frame.search ? `[${frame.search.left}, ${frame.search.right})` : '—'}</dd></div>
              <div><dt>target</dt><dd aria-label="搜尋目標">{frame.search?.target ?? '—'}</dd></div>
              <div><dt>mid</dt><dd aria-label="搜尋 mid">{frame.search?.mid ?? '—'}</dd></div>
            </dl>
            <p>right 可表示有效資料尾端的下一個位置。只有 left &lt; right 時才計算 mid，因此每次讀取的中點仍在有效範圍內。</p>
            <h3>查詢結果紀錄</h3>
            <p aria-label="區間查詢結果">begin {frame.begin ?? '—'}，end {frame.end ?? '—'}，筆數 {frame.begin !== null && frame.end !== null ? frame.end - frame.begin : '—'}</p>
            <div className="allocation-console"><h3>主控台</h3><pre aria-label="成績區間輸出">{frame.output || '尚無輸出'}</pre></div>
            {frame.phase === 'done' && <a className="button button-secondary" download="range.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(frame.report)}`}>下載區間結果</a>}
          </section>
        </LabShell>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
      </div></section>
      <section className="pointers-challenges page-width">
        <h2>三個核心挑戰，確認同分順序與邊界。</h2>
        <ChallengePanel challenges={SCORE_RANGE_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="成績區間核心挑戰">
          {item => <div className="pointers-challenge-content">
            <h3>{item.label}</h3><p>{SCORE_RANGE_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
            <form onSubmit={event => {
              event.preventDefault()
              const result = evaluateScoreRangeChallenge(item.id, answers[item.id] ?? '')
              setFeedback(current => ({ ...current, [item.id]: result }))
              if (result.solved) markChallengeCompleted(LESSON_ID, item.id)
            }}>
              <label htmlFor={`score-range-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label>
              <input id={`score-range-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} />
              <button className="button button-primary" type="submit">檢查答案</button>
            </form>
            {feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
          </div>}
        </ChallengePanel>
      </section>
      <section className="pointers-recap page-width">
        <h2>分數包含兩端，索引使用半開範圍。</h2>
        <p>after_equal 為 0 時，分數相等就往左縮小；為 1 時，分數相等仍向右尋找。空資料、查無紀錄與全體同分都沿用同一套邊界規則。</p>
        {count === 3 && <p role="status">你已完成成績排序與區間查詢。</p>}
        <div><Link className="button button-secondary" to="/learn/projects/gradebook">上一課：成績資料管理綜合練習</Link><Link className="button button-primary" to="/learn/projects/dynamic-records">下一課：動態容量紀錄管理</Link></div>
      </section>
    </div>
  )
}
