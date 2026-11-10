import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_FILE_READING_CONFIG, FILE_READING_DATASETS, FILE_READING_OUTCOMES, simulateFileReadingProgram, validateFileReadingConfig, type FileReadingConfig, type FileReadingPhase, type FileStreamStatus } from '../domain/fileReading'
import { FILE_READING_CHALLENGES, evaluateFileReadingChallenge, type FileReadingChallengeId } from '../data/fileReadingChallenges'

const LESSON_ID = 'files-reading' as const
const phaseLabels: Record<FileReadingPhase, string> = {
  prepare: '準備讀取文字檔', 'enter-main': '進入 main', open: '開啟文字串流', 'check-open': '檢查開啟結果',
  'print-open-failure': '輸出開啟失敗', 'return-open-failure': '開啟失敗回傳', 'declare-buffer': '建立 buffer',
  'initialize-reads': '次數歸零', 'read-attempt': '呼叫 fgets', 'while-condition': '檢查讀取結果',
  'count-read': '成功次數加一', 'print-chunk': '輸出這次字串', 'capture-read-error': '保存讀取錯誤狀態',
  close: '關閉並解除串流關聯', 'check-errors': '檢查 I/O 狀態', 'print-io-failure': '輸出 I/O 失敗',
  'return-io-failure': 'I/O 失敗回傳', 'print-summary': '輸出成功次數', 'return-success': '正常回傳', done: '執行完成', blocked: '安全停止',
}
const streamLabels: Record<FileStreamStatus, string> = { 'not-opened': '尚未開啟', open: '已開啟', closed: '已成功關閉', disassociated: '解除關聯，關閉回報錯誤' }
const pointerLabels = { undeclared: '尚未建立', stream: '→ 有效文字串流', null: 'NULL', invalidated: '不可再使用' }
function readConfig(value: unknown): FileReadingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_FILE_READING_CONFIG }
  const config = value as FileReadingConfig
  return validateFileReadingConfig(config).length ? { ...DEFAULT_FILE_READING_CONFIG }
    : { dataset: config.dataset, outcome: config.outcome, bufferSize: config.bufferSize }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 2 && tokens.every(token => /^\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}
function showCharacter(value: string | null, indeterminate: boolean) {
  if (value === null) return indeterminate ? '內容不確定' : '未初始化'
  return value === '\0' ? "'\\0'" : value === '\n' ? "'\\n'" : `'${value}'`
}

export function FileReadingLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<FileReadingChallengeId>(FILE_READING_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<FileReadingChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<FileReadingChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateFileReadingProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = FILE_READING_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length
  const text = FILE_READING_DATASETS[config.dataset].text
  const terminator = frame.bufferState === 'valid' ? frame.buffer?.indexOf('\0') ?? -1 : -1
  const flagValue = (value: boolean | null) => frame.mainInScope && value !== null ? Number(value) : '—'
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: line.lineNumber === 11 ? [
    { id: 'while-prefix', text: '  while (' }, { id: 'fgets-call', text: 'fgets(buffer, sizeof buffer, fp)' },
    { id: 'fgets-check', text: ' != NULL' }, { id: 'while-suffix', text: ') {' },
  ] : [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(FILE_READING_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: FileReadingConfig) => {
    if (validateFileReadingConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請依序輸入成功讀取次數與 main 回傳值，使用兩個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls allocation-controls"><h2>設定文字與 I/O 情境</h2>
    <label htmlFor="file-reading-dataset">文字資料</label><select id="file-reading-dataset" value={config.dataset} onChange={event => changeConfig({ ...config, dataset: event.target.value as FileReadingConfig['dataset'] })}>{Object.entries(FILE_READING_DATASETS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="file-reading-outcome">I/O 情境</label><select id="file-reading-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as FileReadingConfig['outcome'] })}>{Object.entries(FILE_READING_OUTCOMES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="file-reading-size">buffer 大小</label><div className="allocation-range"><input id="file-reading-size" type="range" min="2" max="8" step="1" value={config.bufferSize} onChange={event => changeConfig({ ...config, bufferSize: Number(event.target.value) })} /><output htmlFor="file-reading-size">{config.bufferSize}</output></div>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_FILE_READING_CONFIG })}>恢復預設值</button>
    <p>資料是虛擬 notes.txt 的 ASCII 文字串流，換行以 \n 表示。成敗由模擬情境指定；讀取錯誤情境發生在第一次 fgets 尚未取得字元時。</p>
  </div>
  return <div className="allocation-page file-reading-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 檔案開啟與 fgets 讀取</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 09 · LESSON 01</span><h1>先確認讀到了什麼，<br />再處理這次字串。</h1><p>從 fopen 開始，逐次觀察 fgets 如何填入 buffer、保留換行與補上空字元，並在 EOF 或錯誤後完成串流清理。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>一次成功讀取，不一定是一整行。</h2><p>fgets 最多讀取 buffer 大小減一的字元，遇到換行會保留它並停止，再補上 \0。長行可能分多次取得；每次都應先檢查回傳值不是 NULL，再處理這次的字串。</p><p>NULL 可能表示 EOF，也可能是讀取錯誤。先保存 ferror 的結果，再呼叫 fclose，關閉後不再查詢串流。這課的 reads 計算成功取得字串的次數。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>成功處理幾次，最後怎麼回傳？</h2><p>目前字元串流為 {JSON.stringify(text)}，buffer 有 {config.bufferSize} 格，情境是「{FILE_READING_OUTCOMES[config.outcome].label}」。預測成功讀取次數與 main 回傳值；開啟失敗時還沒有 reads 變數，成功讀取次數為 0。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="file-reading-prediction">預測成功讀取次數、main 回傳值</label><div><input id="file-reading-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.printedValues === null ? '預測已記錄，執行到 main 回傳後揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.printedValues.join('、')}。${submitted.every((value, index) => value === frame.printedValues![index]) ? '預測正確！' : '先確認每次 fgets 的回傳值，再追蹤 I/O 狀態與回傳分支。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>文字串流、buffer 與條件判斷一起追蹤。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="文字檔讀取控制"
        playback={unlocked ? <PlaybackControls controlName="文字檔讀取執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="allocation-execution lab-panel" aria-label="文字串流與緩衝區" data-phase={frame.phase}>
          <dl className="allocation-variables"><div><dt>fp</dt><dd aria-label="指標 fp">{frame.mainInScope ? pointerLabels[frame.pointer] : '—'}</dd></div><div><dt>reads</dt><dd aria-label="目前 reads">{frame.mainInScope ? frame.reads ?? '—' : '—'}</dd></div><div><dt>EOF 指標</dt><dd aria-label="EOF 指標（布林）">{flagValue(frame.eof)}</dd></div><div><dt>錯誤指標</dt><dd aria-label="錯誤指標（布林）">{flagValue(frame.error)}</dd></div><div><dt>read_failed</dt><dd aria-label="目前 read_failed">{flagValue(frame.readFailed)}</dd></div><div><dt>close_failed</dt><dd aria-label="目前 close_failed">{flagValue(frame.closeFailed)}</dd></div></dl>
          <section className="allocation-block"><h3>虛擬 notes.txt</h3><p aria-label="串流狀態">{streamLabels[frame.streamStatus]}</p>
            {text.length === 0 ? <p>空檔案，沒有文字字元。</p> : <ol className="file-input-tokens" aria-label="虛擬文字串流">{Array.from(text, (character, index) => <li key={index} className={frame.position !== null && index < frame.position ? 'is-consumed' : frame.streamStatus === 'open' && index === frame.position ? 'is-next' : ''}><small>{index}</small><code>{character === '\n' ? '\\n' : character}</code></li>)}</ol>}
            <p aria-label="模擬輸入進度">字元索引記錄：{frame.position ?? '尚未開啟'} / {text.length}</p><p>這是模擬文字字元的進度，不是 ftell 的回傳值，也不表示磁碟位元組位置。</p>
          </section>
          <section className="allocation-block file-buffer"><h3>buffer[{config.bufferSize}]</h3><p aria-label="最近一次 fgets 回傳">最近一次 fgets 回傳：{!frame.mainInScope ? '—' : frame.readResult === 'buffer' ? '→ buffer' : frame.readResult === 'null' ? 'NULL' : '尚未呼叫'}</p>
            {frame.buffer === null ? <p>buffer 尚未宣告。</p> : <ol className="allocation-cells" aria-label="buffer 元素">{frame.buffer.map((value, index) => <li key={index} className={frame.mainInScope && terminator >= 0 && index > terminator ? 'is-tail' : ''}><code>[{index}]</code><strong aria-label={`buffer[${index}]`}>{frame.mainInScope ? showCharacter(value, frame.bufferState === 'indeterminate') : '—'}</strong></li>)}</ol>}
            <p aria-label="目前 buffer 字串">目前字串：{frame.mainInScope && frame.bufferState === 'valid' ? JSON.stringify(frame.currentString) : '不可當作這次讀到的字串使用'}</p><p>空字元後可能留有舊內容或未初始化值，不屬於目前字串。EOF 沒讀到字元時不會把舊 buffer 清空。</p>
          </section>
          <p className="allocation-condition" aria-label="目前判斷">{frame.condition ? `${frame.condition.expression} → ${frame.condition.value ? '成立' : '不成立'}` : '這一步沒有條件判斷'}</p>
          <p aria-label="main 回傳值">main 回傳值：{frame.exitCode ?? '尚未回傳'}</p>
          <div className="allocation-console"><h3>主控台輸出</h3><pre aria-label="文字檔讀取輸出">{frame.output.length ? frame.output.join('') : '尚無輸出'}</pre></div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清字串、EOF 與讀取錯誤。</h2>
      <ChallengePanel challenges={FILE_READING_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="文字檔讀取學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{FILE_READING_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateFileReadingChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`file-reading-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`file-reading-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>先檢查讀取結果，再處理字串，最後解除串流關聯。</h2><p>不要用 !feof 預測下一次讀取，也不要在 fgets 回傳 NULL 後重複處理舊 buffer。串流仍有效時先保存 ferror，再檢查 fclose 的結果；即使 fclose 回報錯誤，串流也已解除檔案關聯。</p><p>語意依據：<a href="https://www.sigbus.info/n1570#7.21.7.2" target="_blank" rel="noreferrer">C11 工作草案 N1570：fgets、fclose 與錯誤指標</a>。</p>{count === 3 && <p role="status">你已完成檔案開啟與 fgets 讀取。</p>}<div><Link className="button button-secondary" to="/learn/memory/ownership">上一課：記憶體所有權、借用與釋放</Link><Link className="button button-primary" to="/learn/files/characters">下一課：fgetc 逐字讀取與 EOF</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
