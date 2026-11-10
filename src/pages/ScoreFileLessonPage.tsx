import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_SCORE_FILE_CONFIG, SCORE_FILE_DATASETS, SCORE_FILE_OUTCOMES, simulateScoreFileProgram, validateScoreFileConfig, type ScoreFileConfig, type ScoreFilePhase, type ScoreRecordReason } from '../domain/scoreFile'
import { escapeIntegerInput } from '../domain/integerParsing'
import { SCORE_FILE_CHALLENGES, evaluateScoreFileChallenge, type ScoreFileChallengeId } from '../data/scoreFileChallenges'

const LESSON_ID = 'files-score-statistics' as const
const phaseLabels: Record<ScoreFilePhase, string> = {
  prepare: '準備統計', 'enter-main': '進入 main', open: '開啟檔案', 'check-open': '檢查開啟', 'print-open': '回報開啟失敗', 'return-open': '開啟失敗回傳',
  'declare-buffer': '建立緩衝區', 'initialize-collector': '初始化收集狀態', 'initialize-counters': '統計歸零', 'set-policy': '設定策略', 'initialize-stopped': '初始化停止狀態',
  read: '讀取字元', 'read-error': '檢查讀取錯誤', 'empty-eof': '檢查無待處理資料的檔尾', 'check-character': '判斷字元或行尾', 'check-capacity': '檢查容量', append: '保存字元', 'too-long': '標記過長', continue: '繼續收集',
  terminate: '補上空字元', 'initialize-valid': '先檢查長度', 'declare-end': '宣告 end', 'clear-errno': '清除 errno', convert: '轉換十進位數字', 'check-conversion': '檢查轉換', 'tail-condition': '檢查尾端空白', 'advance-end': '略過空白',
  'check-score': '檢查整串與分數', 'check-valid': '選擇接受或拒絕', accept: '接受筆數加一', sum: '加入總和', reject: '拒絕筆數加一', 'stop-condition': '檢查停止策略', stop: '標記部分統計', 'break-invalid': '提早停止', reset: '準備下一筆', 'final-eof': '檢查最後一筆',
  'capture-error': '保存讀取錯誤', close: '關閉串流', 'check-io': '檢查 I/O', 'print-io': '回報 I/O 失敗', 'return-io': 'I/O 失敗回傳', 'print-status': '標示統計範圍', 'print-summary': '輸出統計', 'average-condition': '檢查平均分母', 'print-average': '計算平均', 'print-no-average': '平均不適用', return: 'main 回傳', done: '執行完成', blocked: '停止執行',
}
const reasonLabels: Record<ScoreRecordReason, string> = { accepted: '接受', 'too-long': '拒絕：整行過長', 'no-digits': '拒絕：沒有數字', 'long-range': '拒絕：超出 long 範圍', 'trailing-data': '拒絕：尾端資料', 'score-range': '拒絕：不在 0～100' }
const isRecordDecision = (frame: { phase: ScoreFilePhase }) => frame.phase === 'sum' || frame.phase === 'reject'
function readConfig(value: unknown): ScoreFileConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SCORE_FILE_CONFIG }
  const config = value as ScoreFileConfig
  return validateScoreFileConfig(config).length ? { ...DEFAULT_SCORE_FILE_CONFIG } : { dataset: config.dataset, outcome: config.outcome, stopOnInvalid: config.stopOnInvalid }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 3 && tokens.every(token => /^\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}

export function ScoreFileLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<ScoreFileChallengeId>(SCORE_FILE_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<ScoreFileChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<ScoreFileChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateScoreFileProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = SCORE_FILE_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length
  const text = SCORE_FILE_DATASETS[config.dataset].text
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const hasNextRecord = simulation.frames.some(candidate => candidate.index > player.frameIndex && isRecordDecision(candidate))
  const variable = (value: number | boolean | null) => !frame.mainInScope || value === null ? '—' : typeof value === 'boolean' ? Number(value) : value
  const inIteration = (value: string | number | boolean | null) => !frame.iterationInScope || value === null ? '—' : typeof value === 'boolean' ? Number(value) : value

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(SCORE_FILE_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: ScoreFileConfig) => {
    if (validateScoreFileConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請依序輸入接受筆數、拒絕筆數與總和，使用三個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls allocation-controls"><h2>設定資料與錯誤策略</h2>
    <label htmlFor="score-dataset">分數資料</label><select id="score-dataset" value={config.dataset} onChange={event => changeConfig({ ...config, dataset: event.target.value as ScoreFileConfig['dataset'] })}>{Object.entries(SCORE_FILE_DATASETS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="score-outcome">I/O 情境</label><select id="score-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as ScoreFileConfig['outcome'] })}>{Object.entries(SCORE_FILE_OUTCOMES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="score-policy">無效紀錄策略</label><select id="score-policy" value={String(config.stopOnInvalid)} onChange={event => changeConfig({ ...config, stopOnInvalid: event.target.value === 'true' })}><option value="false">跳過無效紀錄，繼續統計</option><option value="true">第一筆無效紀錄後停止</option></select>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_SCORE_FILE_CONFIG })}>恢復預設值</button>
    <p>虛擬 scores.txt 使用 ASCII、C locale、32 位元二補數 long 模型。每行一筆，允許前後空白，分數限 0～100。空白行是無效紀錄。</p>
    <p>line[12] 可保留 11 個資料字元。過長紀錄會繼續讀到換行或正常檔尾，再拒絕整筆。讀取失敗情境在取得最多 4 個字元後，於下次讀取回報錯誤。</p>
  </div>
  return <div className="allocation-page file-reading-page score-file-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width"><nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 檔案資料驗證與分數統計</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 09 · LESSON 04</span><h1>先確認整筆資料，<br />再把分數加入統計。</h1><p>串接 fgetc、字元陣列、strtol 與條件判斷，追蹤每筆資料的接受、拒絕與錯誤處理。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>核心任務：收集完整一行，逐關驗證，再更新統計。</h2><p>先把一般字元放入 line，遇到換行或正常 EOF 才補空字元。驗證順序是長度、數字轉換、尾端資料與 0～100 範圍。valid 一旦設為 0，後面的檢查通過也不會把它改回 1。</p><p>每筆合法紀錄才增加 accepted 與 sum；無效紀錄只增加 rejected。若提早停止，輸出標示 partial。I/O 失敗則回報錯誤，不輸出成功統計。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>哪些資料真的會進入總和？</h2><p>預測接受筆數、拒絕筆數與總和，觀察三種事件的累積結果。開啟失敗時三者皆為 0；讀取錯誤時，未完成的半筆不算拒絕，也不接受。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="score-prediction">預測 accepted、rejected、sum</label><div><input id="score-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="三個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.predictionValues === null ? '預測已記錄，執行到 main 回傳後揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.predictionValues.join('、')}。${submitted.every((value, index) => value === frame.predictionValues![index]) ? '預測正確！' : '先判斷整筆是否完整與合法，再檢查停止策略。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>讀取 → 完整紀錄 → 驗證 → 統計。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="分數檔案統計控制"
        playback={unlocked ? <>
          <PlaybackControls controlName="分數統計執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} />
          <button className="button button-secondary score-next-record" type="button" disabled={player.atEnd} onClick={() => player.jumpToNext(isRecordDecision)}>{hasNextRecord ? '前往下一筆判定' : '查看最後結果'}</button>
        </> : <p role="status">提交上方預測後解鎖播放、單步與逐筆跳轉。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} followActiveLine />
        <section className="allocation-execution lab-panel" aria-label="分數檔案統計狀態" data-phase={frame.phase}>
          <h3>main 的統計與收集狀態</h3><dl className="allocation-variables">
            <div><dt>accepted</dt><dd aria-label="目前 accepted">{variable(frame.accepted)}</dd></div><div><dt>rejected</dt><dd aria-label="目前 rejected">{variable(frame.rejected)}</dd></div><div><dt>sum</dt><dd aria-label="目前 sum">{variable(frame.sum)}</dd></div>
            <div><dt>used</dt><dd aria-label="目前 used">{variable(frame.used)}</dd></div><div><dt>too_long</dt><dd aria-label="目前 too_long">{variable(frame.tooLong)}</dd></div><div><dt>stopped</dt><dd aria-label="目前 stopped">{variable(frame.stopped)}</dd></div>
            <div><dt>fp</dt><dd aria-label="目前 fp">{!frame.mainInScope ? '—' : frame.pointer === 'undeclared' ? '尚未宣告' : frame.pointer === 'null' ? 'NULL' : frame.pointer === 'stream' ? '→ 有效串流' : '不可再使用'}</dd></div><div><dt>read_failed / close_failed</dt><dd aria-label="I/O 結果">{variable(frame.readFailed)} / {variable(frame.closeFailed)}</dd></div>
            <div><dt>EOF 指標</dt><dd aria-label="分數 EOF 指標">{variable(frame.eof)}</dd></div><div><dt>錯誤指標</dt><dd aria-label="分數錯誤指標">{variable(frame.error)}</dd></div>
          </dl>
          <section className="allocation-block"><h3>虛擬 scores.txt</h3><pre aria-label="虛擬分數檔案">{text.length ? text : '（空檔案）'}</pre><p aria-label="分數檔案讀取位置">邏輯字元位置（紀錄）：{frame.position ?? '尚未開啟'} / {text.length}</p><p>這是模擬位置紀錄，不是 ftell 位元組偏移。串流狀態：{frame.streamStatus === 'open' ? '已開啟' : frame.streamStatus === 'closed' ? '已關閉' : frame.streamStatus === 'disassociated' ? '關閉回報錯誤，已解除關聯' : '尚未開啟'}。</p></section>
          <section className="allocation-block"><h3>line[12]：保留前綴與結尾位置</h3>{frame.mainInScope && frame.buffer ? <ol className="file-input-tokens" aria-label="分數字元緩衝區">{frame.buffer.map((character, index) => <li key={index} className={index < (frame.used ?? 0) ? 'is-consumed' : frame.terminated && index === frame.used ? 'is-current' : 'is-tail'}><small>[{index}]</small><code>{character === null ? '?' : character === '\0' ? '\\0' : character === ' ' ? '空白' : escapeIntegerInput(character)}</code><small>{index < (frame.used ?? 0) ? '本筆資料' : frame.terminated && index === frame.used ? '結尾空字元' : '非本筆範圍'}</small></li>)}</ol> : <p>尚未建立或已離開作用域。</p>}<p>問號表示尚未初始化。非本筆範圍可能保留前一筆的內容，不能當成目前字串的一部分；補上結尾前不交給 strtol。</p></section>
          <h3>本輪的區域變數</h3><dl className="allocation-variables"><div><dt>ch · int</dt><dd aria-label="分數目前 ch">{inIteration(frame.ch)}</dd></div><div><dt>value · long</dt><dd aria-label="分數目前 value">{inIteration(frame.value)}</dd></div><div><dt>end 索引</dt><dd aria-label="分數目前 end">{!frame.iterationInScope ? '—' : !frame.endDeclared ? '尚未宣告' : frame.endIndex ?? '尚未取得'}</dd></div><div><dt>valid</dt><dd aria-label="分數目前 valid">{inIteration(frame.valid)}</dd></div><div><dt>errno</dt><dd aria-label="分數目前 errno">{!frame.mainInScope ? '—' : frame.errno === 'unknown' ? '尚未清除' : frame.errno}</dd></div></dl>
          <p className="allocation-condition" aria-label="目前判斷">{frame.condition ? `${frame.condition.expression} → ${frame.condition.value ? '成立' : '不成立'}` : '這一步沒有條件判斷'}</p>
          <section className="allocation-block"><h3>逐筆判定紀錄</h3><p>下表是教學追蹤紀錄，不是額外的 C 陣列；拒絕原因標示第一個失敗關卡。</p>{frame.records.length ? <ol className="score-records" aria-label="分數判定紀錄">{frame.records.map(record => <li key={record.index}><code>{JSON.stringify(record.text)}</code><strong>{reasonLabels[record.reason]}</strong></li>)}</ol> : <p>尚無完成判定的紀錄。</p>}</section>
          <p aria-label="main 回傳值">main 回傳值：{frame.exitCode ?? '尚未回傳'}</p><div className="allocation-console"><h3>主控台輸出</h3><pre aria-label="分數統計輸出">{frame.output.length ? frame.output.join('') : '尚無輸出'}</pre></div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個核心挑戰，驗證整筆資料與統計分母。</h2><ChallengePanel challenges={SCORE_FILE_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="分數統計學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{SCORE_FILE_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
      <form onSubmit={event => { event.preventDefault(); const result = evaluateScoreFileChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}><label htmlFor={`score-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`score-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button></form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
    </div>}</ChallengePanel></section>
    <section className="pointers-recap page-width"><h2>先關閉串流，再判斷要輸出哪種結果。</h2><p>正常 EOF 可結束沒有換行的最後一筆；讀取錯誤則不處理未完成資料。關閉前保存 ferror，關閉後不再使用 fp。只有 accepted &gt; 0 時才計算平均，並先轉成 double 避免整數除法。</p><p>本課資料最多 6 筆，合法分數最多 100，sum 不超過 600。long 模型固定為 32 位元二補數；實際平台範圍可能不同，但本課 0～100 的接受規則相同。</p><p>語意依據：<a href="https://www.sigbus.info/n1570#7.21.7.1" target="_blank" rel="noreferrer">C11 工作草案 N1570：fgetc</a>、<a href="https://www.sigbus.info/n1570#7.22.1.4" target="_blank" rel="noreferrer">strtol</a>。</p>{count === 3 && <p role="status">你已完成檔案資料驗證與分數統計。</p>}<div><Link className="button button-secondary" to="/learn/files/integer-parsing">上一課：strtol 數字解析與輸入驗證</Link><Link className="button button-primary" to="/learn/files/record-filter">下一課：多欄紀錄驗證與檔案輸出</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
    <section className="pointers-recap page-width"><h2>選做：把收集紀錄封裝成函式。</h2><p>完成核心挑戰後，可嘗試拆出收集與驗證函式，並在支援更多資料前加入計數與總和的溢位檢查。這些延伸不計入本課三項完成條件。</p></section>
  </div>
}
