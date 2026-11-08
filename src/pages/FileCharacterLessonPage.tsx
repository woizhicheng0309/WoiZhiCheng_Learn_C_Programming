import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_FILE_CHARACTER_CONFIG, FILE_CHARACTER_DATASETS, simulateFileCharacterProgram, validateFileCharacterConfig, type FileCharacterConfig, type FileCharacterPhase } from '../domain/fileCharacters'
import { FILE_READING_OUTCOMES, type FileStreamStatus } from '../domain/fileReading'
import { FILE_CHARACTER_CHALLENGES, evaluateFileCharacterChallenge, type FileCharacterChallengeId } from '../data/fileCharacterChallenges'

const LESSON_ID = 'files-characters' as const
const phaseLabels: Record<FileCharacterPhase, string> = {
  prepare: '準備逐字讀取', 'enter-main': '進入 main', open: '開啟二進位串流', 'check-open': '檢查開啟結果',
  'print-open-failure': '輸出開啟失敗', 'return-open-failure': '開啟失敗回傳', 'declare-ch': '建立 int ch',
  'initialize-counters': '計數歸零', 'set-stop': '設定提早停止', 'read-attempt': '讀取並指定 ch',
  'while-condition': '先比較 EOF', 'check-stop': '檢查換行停止', break: '提早離開迴圈', 'count-byte': '處理資料加一',
  'check-digit': '檢查數字字元', 'count-digit': '數字字元加一', 'print-code': '輸出資料值',
  'capture-read-error': '保存讀取錯誤', close: '解除串流關聯', 'check-errors': '檢查 I/O 狀態',
  'print-io-failure': '輸出 I/O 失敗', 'return-io-failure': 'I/O 失敗回傳', 'print-summary': '輸出統計',
  'return-success': '正常回傳', done: '執行完成', blocked: '安全停止',
}
const streamLabels: Record<FileStreamStatus, string> = { 'not-opened': '尚未開啟', open: '已開啟', closed: '已成功關閉', disassociated: '解除關聯，關閉回報錯誤' }
const pointerLabels = { undeclared: '尚未建立', stream: '→ 有效二進位串流', null: 'NULL', invalidated: '不可再使用' }
function readConfig(value: unknown): FileCharacterConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_FILE_CHARACTER_CONFIG }
  const config = value as FileCharacterConfig
  return validateFileCharacterConfig(config).length ? { ...DEFAULT_FILE_CHARACTER_CONFIG }
    : { dataset: config.dataset, outcome: config.outcome, stopAtNewline: config.stopAtNewline }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 2 && tokens.every(token => /^\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}
function byteLabel(value: number) {
  return value === 0 ? "'\\0'" : value === 10 ? "'\\n'" : value === 255 ? '0xFF' : `'${String.fromCharCode(value)}'`
}

export function FileCharacterLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<FileCharacterChallengeId>(FILE_CHARACTER_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<FileCharacterChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<FileCharacterChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateFileCharacterProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = FILE_CHARACTER_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length
  const bytes = FILE_CHARACTER_DATASETS[config.dataset].bytes
  const flag = (value: boolean | null) => frame.mainInScope && value !== null ? Number(value) : '—'
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: line.lineNumber === 12 ? [
    { id: 'while-prefix', text: '  while (' }, { id: 'fgetc-call', text: '(ch = fgetc(fp))' },
    { id: 'eof-check', text: ' != EOF' }, { id: 'while-suffix', text: ') {' },
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
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(FILE_CHARACTER_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: FileCharacterConfig) => {
    if (validateFileCharacterConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請依序輸入處理資料量與數字字元數，使用兩個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls allocation-controls"><h2>設定資料與停止方式</h2>
    <label htmlFor="file-character-dataset">位元組資料</label><select id="file-character-dataset" value={config.dataset} onChange={event => changeConfig({ ...config, dataset: event.target.value as FileCharacterConfig['dataset'] })}>{Object.entries(FILE_CHARACTER_DATASETS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="file-character-outcome">I/O 情境</label><select id="file-character-outcome" value={config.outcome} onChange={event => changeConfig({ ...config, outcome: event.target.value as FileCharacterConfig['outcome'] })}>{Object.entries(FILE_READING_OUTCOMES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="file-character-stop">停止方式</label><select id="file-character-stop" value={String(config.stopAtNewline)} onChange={event => changeConfig({ ...config, stopAtNewline: event.target.value === 'true' })}><option value="false">持續處理到 EOF</option><option value="true">遇換行提早 break，不把換行計入 count</option></select>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_FILE_CHARACTER_CONFIG })}>恢復預設值</button>
    <p>資料為虛擬 bytes.bin，每位元組有 8 位元，字元採 ASCII 示意。使用 rb 模式逐位元組讀取；一次 fgetc 不代表一個完整 Unicode 字元。讀取失敗情境發生在第一次讀取尚未取得資料時。</p>
  </div>
  return <div className="allocation-page file-reading-page file-character-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ fgetc 逐字讀取與 EOF</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 09 · LESSON 02</span><h1>用 int 接住回傳值，<br />再分辨資料與 EOF。</h1><p>逐位元組追蹤資料值、EOF 判斷、數字字元統計與 break，觀察已讀取和已處理的數量何時不同。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>fgetc 回傳 int，先比較 EOF，再處理資料。</h2><p>資料以 unsigned char 的值轉成 int 回傳。這個模型中 0 到 255 都是有效資料，包含 0x00 與 0xFF。EOF 是負的 int 常數，不是檔案中的一個位元組；這裡使用符號 EOF，不假設它一定等於 -1。</p><p>先存入 char 可能縮小可表示範圍，讓資料與結束值的判斷失去資訊。char 的正負號依實作而異；本例直接使用 int ch。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>讀到了資料，就一定會計入嗎？</h2><p>預測 count 與 digits：前者計算通過停止檢查的資料位元組，後者計算其中的數字字元。{config.stopAtNewline ? '換行已讀取，但會在 count++ 之前 break。' : '持續處理到 EOF，EOF 本身不計入。'}開啟失敗時尚未宣告兩個計數變數，實際處理事件數皆為 0。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="file-character-prediction">預測處理資料量、數字字元數</label><div><input id="file-character-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.printedValues === null ? '預測已記錄，執行到 main 回傳後揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.printedValues.join('、')}。${submitted.every((value, index) => value === frame.printedValues![index]) ? '預測正確！' : '先區分已讀與已處理的資料，再檢查數字字元與 I/O 分支。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>讀取、比較 EOF、檢查停止，再處理。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="逐字讀取控制"
        playback={unlocked ? <PlaybackControls controlName="逐字讀取執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="allocation-execution lab-panel" aria-label="逐字讀取與 int 回傳值" data-phase={frame.phase}>
          <dl className="allocation-variables"><div><dt>fp</dt><dd aria-label="指標 fp">{frame.mainInScope ? pointerLabels[frame.pointer] : '—'}</dd></div><div><dt>ch · int</dt><dd aria-label="目前 ch（int）">{!frame.mainInScope ? '—' : !frame.chDeclared ? '尚未宣告' : frame.ch === null ? '未初始化' : frame.ch}</dd></div><div><dt>資料表示</dt><dd aria-label="目前資料字元">{frame.mainInScope && typeof frame.ch === 'number' ? byteLabel(frame.ch) : '—'}</dd></div><div><dt>count</dt><dd aria-label="目前 count">{frame.mainInScope ? frame.count ?? '—' : '—'}</dd></div><div><dt>digits</dt><dd aria-label="目前 digits">{frame.mainInScope ? frame.digits ?? '—' : '—'}</dd></div><div><dt>EOF 指標</dt><dd aria-label="EOF 指標（布林）">{flag(frame.eof)}</dd></div><div><dt>錯誤指標</dt><dd aria-label="錯誤指標（布林）">{flag(frame.error)}</dd></div><div><dt>read_failed</dt><dd aria-label="目前 read_failed">{flag(frame.readFailed)}</dd></div><div><dt>close_failed</dt><dd aria-label="目前 close_failed">{flag(frame.closeFailed)}</dd></div></dl>
          <section className="allocation-block"><h3>虛擬 bytes.bin</h3><p aria-label="串流狀態">{streamLabels[frame.streamStatus]}</p>
            {bytes.length === 0 ? <p>空檔案，沒有資料位元組。</p> : <ol className="file-input-tokens" aria-label="虛擬位元組串流">{bytes.map((value, index) => {
              const processed = index < frame.processed.length
              const readOnly = !processed && index < frame.retrieved.length
              return <li key={index} className={`${processed ? 'is-consumed' : readOnly ? 'is-read-only' : ''} ${frame.activeByte === index ? 'is-current' : ''}`}><small>[{index}]</small><code>0x{value.toString(16).toUpperCase().padStart(2, '0')}</code><span>{byteLabel(value)}</span><small>{processed ? '已處理' : readOnly ? '已讀，未計入' : '尚未讀取'}</small></li>
            })}</ol>}
            <p aria-label="模擬讀取進度">讀取位置記錄：{frame.position ?? '尚未開啟'} / {bytes.length}</p><p>外框是本步資料；EOF 不佔檔案中的一格。這是模擬位置記錄，不是額外呼叫 ftell。</p>
          </section>
          <p className="allocation-condition" aria-label="目前判斷">{frame.condition ? `${frame.condition.expression} → ${frame.condition.value ? '成立' : '不成立'}` : '這一步沒有條件判斷'}</p>
          <p aria-label="main 回傳值">main 回傳值：{frame.exitCode ?? '尚未回傳'}</p>
          <div className="allocation-console"><h3>主控台輸出</h3><pre aria-label="逐字讀取輸出">{frame.output.length ? frame.output.join('') : '尚無輸出'}</pre></div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清回傳值、資料與停止時機。</h2>
      <ChallengePanel challenges={FILE_CHARACTER_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="逐字讀取學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{FILE_CHARACTER_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateFileCharacterChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`file-character-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`file-character-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>EOF 是回傳訊號，0 與 255 是本課的有效資料。</h2><p>fgetc 回傳 EOF 時，也可能是讀取錯誤，要在串流仍有效時保存 ferror。提早 break 則不會自動把剩餘資料讀完，也不會自動設定 EOF。最後檢查 fclose 並解除串流關聯。</p><p>語意依據：<a href="https://www.sigbus.info/n1570#7.21.7.1" target="_blank" rel="noreferrer">C11 工作草案 N1570：fgetc 與 EOF</a>。</p>{count === 3 && <p role="status">你已完成 fgetc 逐字讀取與 EOF。</p>}<div><Link className="button button-secondary" to="/learn/files/reading">上一課：檔案開啟與 fgets 讀取</Link><Link className="button button-primary" to="/learn/files/integer-parsing">下一課：strtol 數字解析與輸入驗證</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
