import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { DYNAMIC_RECORDS_CHALLENGES, evaluateDynamicRecordsChallenge, type DynamicRecordsChallengeId } from '../data/dynamicRecordsChallenges'
import {
  DEFAULT_DYNAMIC_RECORDS_CONFIG, DYNAMIC_RECORD_SAMPLES, DYNAMIC_RECORD_GROWTH, simulateDynamicRecords, validateDynamicRecordsConfig,
  type DynamicRecordsConfig, type DynamicRecordsFrame,
} from '../domain/dynamicRecords'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'

const LESSON_ID = 'projects-dynamic-records' as const
const isCheckpoint = (frame: DynamicRecordsFrame) => ['appended', 'failed', 'summary', 'reset'].includes(frame.phase)
function readConfig(value: unknown): DynamicRecordsConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_DYNAMIC_RECORDS_CONFIG }
  const { sample, count, growth, failAt } = value as DynamicRecordsConfig
  const config = { sample, count, growth, failAt }
  return validateDynamicRecordsConfig(config).length ? { ...DEFAULT_DYNAMIC_RECORDS_CONFIG } : config
}

export function DynamicRecordsProjectPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<readonly number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<DynamicRecordsChallengeId>(DYNAMIC_RECORDS_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<DynamicRecordsChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<DynamicRecordsChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateDynamicRecords(config), [config])
  const sourceLines = useMemo(() => simulation.source.lines.map(({ lineNumber, code }) => ({
    lineNumber, parts: [{ id: `line-${lineNumber}`, text: code || ' ' }],
  })), [simulation.source])
  const player = useTracePlayer({ frames: simulation.frames, speed })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = DYNAMIC_RECORDS_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

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
        setActiveId(DYNAMIC_RECORDS_CHALLENGES[0].id)
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

  function changeConfig(next: DynamicRecordsConfig) {
    if (validateDynamicRecordsConfig(next).length) return
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
    if (tokens.length !== 2 || !tokens.every(token => /^[0-8]$/.test(token))) {
      setError('請依序輸入最後的 used 與 capacity，使用 0 到 8 的整數。')
      return
    }
    setSubmitted(tokens.map(Number)); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls allocation-controls">
    <h2>加入紀錄與擴充設定</h2>
    <label htmlFor="dynamic-records-sample">紀錄資料</label>
    <select id="dynamic-records-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as DynamicRecordsConfig['sample'] })}>
      {Object.entries(DYNAMIC_RECORD_SAMPLES).map(([id, sample]) => <option key={id} value={id}>{sample.label}</option>)}
    </select>
    <label htmlFor="dynamic-records-count">加入筆數</label>
    <div className="allocation-range"><input id="dynamic-records-count" type="range" min="0" max="6" value={config.count} onChange={event => changeConfig({ ...config, count: Number(event.target.value) })} /><output htmlFor="dynamic-records-count">{config.count}</output></div>
    <label htmlFor="dynamic-records-failure">注入配置失敗</label>
    <select id="dynamic-records-failure" value={config.failAt} onChange={event => changeConfig({ ...config, failAt: Number(event.target.value) })}>
      <option value="0">不注入失敗</option>{[1, 2, 3].map(value => <option key={value} value={value}>第 {value} 次配置失敗</option>)}
    </select>
    <p>只有需要新空間時才算一次配置。設定的失敗次數若未到達，就會全部成功加入。</p>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_DYNAMIC_RECORDS_CONFIG })}>恢復預設值</button>
    <details><summary>選做：比較逐筆擴充與容量加倍</summary>
      <p>切換策略，先預測加入六筆的配置次數與剩餘空格。逐筆擴充每次只增加一格；容量加倍會預留空間，減少需要配置的次數。實際耗時與是否搬移由配置器決定。</p>
      <label htmlFor="dynamic-records-growth">擴充策略</label>
      <select id="dynamic-records-growth" value={config.growth} onChange={event => changeConfig({ ...config, growth: event.target.value as DynamicRecordsConfig['growth'] })}>
        {Object.entries(DYNAMIC_RECORD_GROWTH).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </details>
    <p>目前策略：{DYNAMIC_RECORD_GROWTH[config.growth]}。</p>
  </div>
  const summary = simulation.frames.find(item => item.phase === 'summary')
  const predictionResult = frame.revealed && submitted && summary
    ? `你預測 ${submitted.join('、')}，實際 ${summary.used}、${summary.capacity}。${submitted[0] === summary.used && submitted[1] === summary.capacity ? '預測正確！' : '追蹤哪一次加入才需要擴充，以及失敗時保留的容量。'}` : null
  const hasCheckpoint = simulation.frames.some(item => item.index > frame.index && isCheckpoint(item))

  return <div className="allocation-page record-file-page dynamic-records-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 動態容量紀錄管理</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 10 · LESSON 03</span><h1>紀錄逐筆加入，<br />空間隨需求成長。</h1><p>把結構、指標與 realloc 組成動態清單，追蹤擴充、失敗與最後的清理。</p></div>
        <aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項核心挑戰完成單元'}</p></aside>
      </div>
    </div></section>
    <section className="pointers-recap page-width"><h2>核心任務：先取得空間，寫入紀錄，再增加有效筆數。</h2>
      <p>本課從已驗證的紀錄開始，依輸入順序加入 RecordList。used 表示有效筆數，capacity 表示可容納的格數。容量用完時由 2 格起始，再加倍為 4、8 格。</p>
      <p>temp 接到 NULL 時保留原有清單並停止加入；成功時先接回指標，再更新容量。只讀取 [0, used) 中的紀錄，最後釋放仍持有的區塊一次。</p>
    </section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card">
      <div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>清理前會保留幾筆與幾格？</h2><p>預測輸出摘要中的 used 與 capacity。留意配置失敗發生在第幾筆，以及空資料是否需要配置。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="dynamic-records-prediction">預測 used 與 capacity</label>
        <div><input id="dynamic-records-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>
        {error && <p role="alert">{error}</p>}
      </form>{submitted && <p role="status">{predictionResult ?? '預測已記錄，執行到摘要輸出時揭曉。'}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>觀察已初始化紀錄、剩餘空格與有效指標。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="動態紀錄設定"
        playback={unlocked ? <><PlaybackControls controlName="動態紀錄執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} />
          <button className="button button-secondary score-next-record" type="button" disabled={player.atEnd} onClick={() => player.jumpToNext(isCheckpoint)}>{hasCheckpoint ? '前往下一個階段' : '查看最後結果'}</button></> : <p role="status">提交預測後可播放、單步執行或跳到下一個階段。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p></div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} followActiveLine />
        <section className="allocation-execution lab-panel" aria-label="動態紀錄追蹤" data-phase={frame.phase}>
          <h3>動態清單快照</h3>
          <dl className="allocation-variables">
            <div><dt>used：有效筆數</dt><dd aria-label="有效筆數">{frame.used ?? '—'}</dd></div>
            <div><dt>capacity：容量</dt><dd aria-label="配置容量">{frame.capacity ?? '—'}</dd></div>
            <div><dt>list.data</dt><dd aria-label="清單指標">{frame.data}</dd></div>
            <div><dt>temp</dt><dd aria-label="暫存指標">{frame.temp}</dd></div>
            <div><dt>next：待採用容量</dt><dd>{frame.next ?? '—'}</dd></div>
            <div><dt>目前索引 i</dt><dd>{frame.i ?? '—'}</dd></div>
            <div><dt>配置嘗試次數</dt><dd aria-label="配置嘗試次數">{frame.attempts}</dd></div>
            <div><dt>最後釋放區塊數</dt><dd aria-label="最後釋放區塊數">{frame.releases}</dd></div>
          </dl>
          <p aria-label="待加入紀錄">待加入：{frame.pending ? `${frame.pending.id},${frame.pending.score}` : '—'}</p>
          <div className="structure-array-table-scroll"><table className="structure-array-table" aria-label="動態配置資料表">
            <thead><tr><th scope="col">索引</th><th scope="col">id</th><th scope="col">score</th><th scope="col">狀態</th></tr></thead>
            <tbody>{frame.rows?.map((record, index) => <tr key={index} className={index < (frame.used ?? 0) ? 'is-written' : record ? 'is-active' : undefined}>
              <th scope="row">{index}</th><td>{record?.id ?? '—'}</td><td>{record?.score ?? '—'}</td><td>{index < (frame.used ?? 0) ? '有效紀錄' : record ? '已寫入，待增加 used' : '未初始化，不可讀取'}</td>
            </tr>)}</tbody>
          </table></div>
          {!frame.rows && <p>{frame.phase === 'prepare' ? '尚未建立清單。' : frame.phase === 'done' ? '清單已離開作用域。' : '目前沒有可讀取的配置區塊。'}</p>}
          <p>B1、B2 等表示每次成功配置的生命週期。即使位址相同，成功 realloc 後也須使用回傳的指標；圖中「失效」是追蹤標記，C 程式不讀取舊指標。空格的 — 表示未初始化。</p>
          <div className="allocation-console"><h3>主控台</h3><pre aria-label="動態紀錄輸出">{frame.output || '尚無輸出'}</pre></div>
          <p aria-label="程式回傳值">程式回傳值：{frame.exitCode ?? '—'}</p>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個核心挑戰，確認容量、失敗與清理。</h2>
      <ChallengePanel challenges={DYNAMIC_RECORDS_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="動態紀錄核心挑戰">
        {item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{DYNAMIC_RECORDS_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
          <form onSubmit={event => { event.preventDefault(); const result = evaluateDynamicRecordsChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
            <label htmlFor={`dynamic-records-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`dynamic-records-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} />
            <button className="button button-primary" type="submit">檢查答案</button>
          </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
        </div>}
      </ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>擴充成功才採用，加入成功才增加 used。</h2>
      <p>來源中的 resize_records 是教學輔助函式，可在指定次數直接回傳 NULL。本模擬在其餘次數採用配置成功的路徑；實際執行 C 時，每一次 realloc 仍可能因環境資源不足而失敗。</p>
      <p>擴充前以 SIZE_MAX / sizeof 檢查元素上限，加倍前再檢查 limit / 2，避免容量與位元組數溢位。本課最多六筆，只展示這些防護，不以巨大配置進行實驗。</p>
      {count === 3 && <p role="status">你已完成動態容量紀錄管理。</p>}
      <div><Link className="button button-secondary" to="/learn/projects/score-range">上一課：成績排序與區間查詢</Link><Link className="button button-primary" to="/learn">回到課程地圖</Link></div>
    </section>
  </div>
}
