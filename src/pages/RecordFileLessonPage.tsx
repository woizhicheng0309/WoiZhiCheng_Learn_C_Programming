import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { RECORD_FILE_CHALLENGES, evaluateRecordFileChallenge, type RecordFileChallengeId } from '../data/recordFileChallenges'
import {
  DEFAULT_RECORD_FILE_CONFIG, RECORD_FILE_DATASETS, RECORD_FILE_OUTCOMES, RECORD_LINE_LIMIT,
  simulateRecordFileProgram, validateRecordFileConfig,
  type OutputFileStatus, type RecordDecision, type RecordFileConfig, type RecordFilePhase,
} from '../domain/recordFile'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'

const LESSON_ID = 'files-record-filter' as const
const decisions: Record<RecordDecision, string> = {
  'too-long': '拒絕：過長', id: '拒絕：id', separator: '拒絕：分隔符', score: '拒絕：score',
  tail: '拒絕：尾端資料', below: '合法，低於門檻', written: '已交給輸出串流', 'write-error': '合法，寫入失敗',
}
const outputLabels: Record<OutputFileStatus, string> = {
  absent: '尚未開啟', open: '寫入中，等待關檔', confirmed: '已成功關閉', incomplete: '處理中斷', unconfirmed: '關閉回報錯誤',
}
const isRowDecision = (frame: { phase: RecordFilePhase }) => ['reject', 'skip', 'written', 'write-failed'].includes(frame.phase)

function readConfig(value: unknown): RecordFileConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_RECORD_FILE_CONFIG }
  const { dataset, outcome, minimumScore } = value as RecordFileConfig
  const config = { dataset, outcome, minimumScore }
  return validateRecordFileConfig(config).length ? { ...DEFAULT_RECORD_FILE_CONFIG } : config
}

export function RecordFileLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<readonly number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<RecordFileChallengeId>(RECORD_FILE_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<RecordFileChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<RecordFileChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateRecordFileProgram(config), [config])
  const sourceLines = useMemo(() => simulation.source.lines.map(({ lineNumber, code }) => ({
    lineNumber, parts: [{ id: `line-${lineNumber}`, text: code || ' ' }],
  })), [simulation.source])
  const player = useTracePlayer({ frames: simulation.frames, speed })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = RECORD_FILE_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

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
        setActiveId(RECORD_FILE_CHALLENGES[0].id)
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

  function changeConfig(next: RecordFileConfig) {
    if (validateRecordFileConfig(next).length) return
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
    if (tokens.length !== 3 || !tokens.every(token => /^\d+$/.test(token) && Number.isSafeInteger(Number(token)))) {
      setError('請依序輸入三個非負整數。')
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
      <h2>設定輸入與篩選條件</h2>
      <label htmlFor="record-file-dataset">輸入資料</label>
      <select id="record-file-dataset" value={config.dataset} onChange={event => changeConfig({ ...config, dataset: event.target.value as RecordFileConfig['dataset'] })}>
        {Object.entries(RECORD_FILE_DATASETS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
      </select>
      <label htmlFor="record-file-outcome">I/O 情境</label>
      <select id="record-file-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as RecordFileConfig['outcome'] })}>
        {Object.entries(RECORD_FILE_OUTCOMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <label htmlFor="record-file-minimum">分數門檻</label>
      <div className="allocation-range">
        <input id="record-file-minimum" type="range" min="0" max="100" value={config.minimumScore} onChange={event => changeConfig({ ...config, minimumScore: Number(event.target.value) })} />
        <output htmlFor="record-file-minimum">{config.minimumScore}</output>
      </div>
      <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_RECORD_FILE_CONFIG })}>恢復預設值</button>
      <h3>scores.txt</h3>
      <pre aria-label="虛擬輸入檔">{RECORD_FILE_DATASETS[config.dataset].text || '（空檔案）'}</pre>
      <p>I/O 情境由模擬器指定。執行 C 程式時，由實際的串流回傳值決定分支。</p>
    </div>
  )
  const actual = frame.exitCode !== null ? [frame.valid, frame.rejected, frame.written] : null
  const predictionResult = submitted && actual && (
    `你預測 ${submitted.join('、')}，實際 ${actual.join('、')}。${submitted.every((value, index) => value === actual[index]) ? '預測正確！' : '比較合法、拒絕與寫入各在哪一步累計。'}`
  )
  const canDownload = frame.phase === 'done' && frame.outputStatus === 'confirmed'
  const hasNextDecision = simulation.frames.some(item => item.index > frame.index && isRowDecision(item))

  return (
    <div className="allocation-page record-file-page pointers-page functions-page lab-page">
      <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
        <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 多欄紀錄驗證與檔案輸出</span></nav>
        <div className="functions-hero__layout">
          <div><span className="section-kicker">MODULE 09 · LESSON 05</span><h1>逐欄驗證，<br />再輸出符合條件的紀錄。</h1><p>讀入每行的 id 與 score，確認整筆合格後才建立結構，最後將達到門檻的紀錄寫進新檔案。</p></div>
          <aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside>
        </div>
      </div></section>
      <section className="pointers-recap page-width">
        <h2>先驗證整筆紀錄，再判斷分數門檻。</h2>
        <p>本例使用 LF 換行、無內嵌空字元的 ASCII 文字檔，每行固定為兩欄 id,score。id 介於 1 到 9999，score 介於 0 到 100。strtol 允許數字前的空白與正負號，數值仍須在範圍內。id 後緊接逗號，分數後只允許換行或字串終點。</p>
        <p>每行最多 {RECORD_LINE_LIMIT} 個資料字元，換行另計。過長時讀完整行再略過。最後一行可以直接在 EOF 結束。</p>
      </section>
      <section className="functions-prediction-section"><div className="page-width functions-prediction-card">
        <div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>合法、拒絕、寫入各有幾筆？</h2><p>預測執行結束時的三個計數。written 只計入 fprintf 回報成功的筆數。</p></div>
        <form className="functions-prediction-form" onSubmit={predict}>
          <label htmlFor="record-file-prediction">預測合法、拒絕、寫入筆數</label>
          <div><input id="record-file-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="三個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>
          {error && <p role="alert">{error}</p>}
        </form>
        {submitted && <p role="status">{predictionResult ?? '預測已記錄，執行到回傳時揭曉。'}</p>}
      </div></section>
      <section className="functions-lab-section"><div className="page-width">
        <h2>追蹤欄位解析、逐筆判定與輸出檔狀態。</h2>
        <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="多欄資料設定"
          playback={unlocked ? <>
            <PlaybackControls controlName="多欄資料執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} />
            <button className="button button-secondary score-next-record" type="button" disabled={player.atEnd} onClick={() => player.jumpToNext(isRowDecision)}>{hasNextDecision ? '前往下一筆判定' : '查看最後結果'}</button>
          </> : <p role="status">提交預測後可播放、單步執行或逐筆跳轉。</p>}
          footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p></div>}>
          <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={frame.explanation} followActiveLine />
          <section className="allocation-execution lab-panel" aria-label="多欄紀錄追蹤" data-phase={frame.phase}>
            <h3>欄位檢查</h3>
            <p aria-label="輸入檔狀態">輸入檔 {frame.inputStatus === 'open' ? '已開啟' : frame.inputStatus === 'closed' ? '已關閉' : '尚未開啟'}</p>
            <dl className="allocation-variables">
              <div><dt>本行緩衝區</dt><dd aria-label="本行緩衝區">{frame.chunk === null ? '—' : JSON.stringify(frame.chunk)}</dd></div>
              <div><dt>id 轉換值</dt><dd aria-label="id 轉換值">{frame.idValue ?? '—'}</dd></div>
              <div><dt>score 轉換值</dt><dd aria-label="score 轉換值">{frame.scoreValue ?? '—'}</dd></div>
              <div><dt>end 索引</dt><dd aria-label="end 索引">{frame.end ?? '—'}</dd></div>
              <div><dt>Record</dt><dd aria-label="Record 資料">{frame.record ? `${frame.record.id},${frame.record.score}` : '—'}</dd></div>
            </dl>
            <h3>逐筆判定</h3>
            <p aria-label="處理計數">合法 {frame.valid}、拒絕 {frame.rejected}、寫入 {frame.written}</p>
            <div className="structure-array-table-scroll">
              <table className="structure-array-table" aria-label="逐筆判定">
                <thead><tr><th scope="col">行</th><th scope="col">資料</th><th scope="col">結果</th></tr></thead>
                <tbody>{frame.decisions.map(item => <tr key={item.row}><th scope="row">{item.row}</th><td><code>{JSON.stringify(item.text)}</code></td><td>{decisions[item.result]}</td></tr>)}</tbody>
              </table>
            </div>
            <h3>selected.txt 預覽</h3>
            <p aria-label="輸出檔狀態">{outputLabels[frame.outputStatus]}</p>
            <pre aria-label="輸出檔內容">{frame.outputText || '（尚無內容）'}</pre>
            {canDownload && <a className="button button-secondary" download="selected.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(frame.outputText)}`}>下載 selected.txt</a>}
            <div className="allocation-console"><h3>主控台</h3><pre aria-label="多欄程式輸出">{frame.stdout || '尚無輸出'}</pre></div>
          </section>
        </LabShell>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
      </div></section>
      <section className="pointers-challenges page-width">
        <h2>三個挑戰，練習尾端檢查、計數與關檔。</h2>
        <ChallengePanel challenges={RECORD_FILE_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="多欄紀錄學習挑戰">
          {item => <div className="pointers-challenge-content">
            <h3>{item.label}</h3><p>{RECORD_FILE_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
            <form onSubmit={event => {
              event.preventDefault()
              const result = evaluateRecordFileChallenge(item.id, answers[item.id] ?? '')
              setFeedback(current => ({ ...current, [item.id]: result }))
              if (result.solved) markChallengeCompleted(LESSON_ID, item.id)
            }}>
              <label htmlFor={`record-file-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label>
              <input id={`record-file-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} />
              <button className="button button-primary" type="submit">檢查答案</button>
            </form>
            {feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
          </div>}
        </ChallengePanel>
      </section>
      <section className="pointers-recap page-width">
        <h2>寫入與關檔都要檢查。</h2>
        <p>預覽呈現已交給輸出串流的文字。執行成功且關檔後才提供下載。關檔回報錯誤時，檔案中的內容可能不完整。成功開啟時，w 模式會建立 selected.txt，或將同名檔案截為空檔。</p>
        <p>語意依據見 <a href="https://www.sigbus.info/n1570#7.21.6.1" target="_blank" rel="noreferrer">C11 工作草案 N1570 的 fprintf</a>與 <a href="https://www.sigbus.info/n1570#7.21.5.1" target="_blank" rel="noreferrer">fclose</a>。</p>
        {count === 3 && <p role="status">你已完成多欄紀錄驗證與檔案輸出。</p>}
        <div><Link className="button button-secondary" to="/learn/files/score-statistics">上一課：檔案資料驗證與分數統計</Link><Link className="button button-primary" to="/learn/projects/gradebook">下一課：成績資料管理綜合練習</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div>
      </section>
    </div>
  )
}
