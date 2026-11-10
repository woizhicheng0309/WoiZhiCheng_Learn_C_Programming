import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_INTEGER_PARSING_CONFIG, INTEGER_INPUT_PRESETS, escapeIntegerInput, longModelLimits, simulateIntegerParsingProgram, validateIntegerParsingConfig, type IntegerParsingConfig, type IntegerParsingPhase } from '../domain/integerParsing'
import { INTEGER_PARSING_CHALLENGES, evaluateIntegerParsingChallenge, type IntegerParsingChallengeId } from '../data/integerParsingChallenges'

const LESSON_ID = 'files-integer-parsing' as const
const phaseLabels: Record<IntegerParsingPhase, string> = {
  prepare: '準備解析', 'enter-main': '進入 main', 'declare-input': '建立輸入', 'declare-end': '宣告 end', 'clear-errno': '清除 errno',
  'begin-conversion': '開始概念追蹤', 'skip-leading-space': '略過前導空白', 'read-sign': '讀取符號', 'read-digit': '轉換數字',
  'finish-conversion': '取得轉換結果', 'check-conversion': '檢查是否有數字', 'print-no-digits': '回報無數字', 'return-no-digits': '無數字回傳',
  'check-range': '檢查範圍', 'print-range': '回報範圍錯誤', 'return-range': '範圍錯誤回傳', 'set-policy': '設定尾端規則',
  'check-policy': '判斷尾端規則', 'tail-condition': '檢查尾端空白', 'advance-end': '移動 end', 'check-tail': '檢查剩餘資料',
  'print-tail': '回報剩餘資料', 'return-tail': '剩餘資料回傳', 'print-value': '輸出合法數值', 'return-success': '成功回傳', done: '執行完成', blocked: '停止執行',
}
function readConfig(value: unknown): IntegerParsingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_INTEGER_PARSING_CONFIG }
  const config = value as IntegerParsingConfig
  return validateIntegerParsingConfig(config).length ? { ...DEFAULT_INTEGER_PARSING_CONFIG } : { text: config.text, longBits: config.longBits, allowTrailingSpace: config.allowTrailingSpace }
}
const characterLabel = (value: string | undefined) => value === undefined ? '\\0' : value === ' ' ? '空白' : escapeIntegerInput(value)

export function IntegerParsingLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [draftText, setDraftText] = useState(config.text)
  const [configError, setConfigError] = useState('')
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<IntegerParsingChallengeId>(INTEGER_PARSING_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<IntegerParsingChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<IntegerParsingChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateIntegerParsingProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const count = INTEGER_PARSING_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length
  const limits = longModelLimits(config.longBits)
  const preset = Object.entries(INTEGER_INPUT_PRESETS).find(([, item]) => item.text === config.text)?.[0] ?? ''
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      const next = readConfig(JSON.parse(savedKey))
      setConfig(next); setDraftText(next.text); setConfigError(''); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(INTEGER_PARSING_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: IntegerParsingConfig, replaceDraft = false) => {
    const issues = validateIntegerParsingConfig(next)
    if (issues.length) { setConfigError(issues.join(' ')); return }
    setConfig(next); if (replaceDraft) setDraftText(next.text)
    setConfigError(''); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d+$/.test(prediction.trim()) || !Number.isSafeInteger(Number(prediction))) { setError('請輸入一個非負整數作為 main 回傳值。'); return }
    setSubmitted(Number(prediction)); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls allocation-controls"><h2>設定輸入與驗證規則</h2>
    <label htmlFor="integer-preset">範例文字</label><select id="integer-preset" value={preset} onChange={event => {
      const item = INTEGER_INPUT_PRESETS[event.target.value as keyof typeof INTEGER_INPUT_PRESETS]
      if (item) changeConfig({ ...config, text: item.text }, true)
    }}><option value="" disabled>自訂文字</option>{Object.entries(INTEGER_INPUT_PRESETS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="integer-text">輸入文字（套用後執行）</label><textarea id="integer-text" aria-describedby="integer-text-help" rows={3} value={draftText} onChange={event => { setDraftText(event.target.value); setConfigError('') }} />
    <p id="integer-text-help">{draftText.length} / 40 字元。限 ASCII 文字與空白，可套用空字串；未套用的編輯不影響執行。</p>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...config, text: draftText }, true)}>套用文字</button>
    {configError && <p role="alert">{configError}</p>}<p>目前套用：<code aria-label="目前套用文字">{JSON.stringify(config.text)}</code></p>
    <label htmlFor="integer-long">long 模型</label><select id="integer-long" value={config.longBits} onChange={event => changeConfig({ ...config, longBits: Number(event.target.value) as 32 | 64 })}><option value={32}>32 位元二補數</option><option value={64}>64 位元二補數</option></select>
    <label htmlFor="integer-tail">尾端規則</label><select id="integer-tail" value={String(config.allowTrailingSpace)} onChange={event => changeConfig({ ...config, allowTrailingSpace: event.target.value === 'true' })}><option value="false">數字後必須立即結束</option><option value="true">允許尾端空白</option></select>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_INTEGER_PARSING_CONFIG }, true)}>恢復預設值</button>
    <p>本課使用 C locale、base = 10。選單模擬兩種 long 範圍，不會改寫原始碼的 long 型別；實際 C 程式依執行平台的範圍判斷。</p>
    <p className="integer-range" aria-label="所選 long 範圍">{limits.min} ～ {limits.max}</p>
  </div>
  return <div className="allocation-page file-reading-page integer-parsing-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ strtol 數字解析與輸入驗證</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 09 · LESSON 03</span><h1>先轉換數字，<br />再驗證整份輸入。</h1><p>追蹤 end 指標、errno 與尾端規則，分辨合法零值、無數字、超出範圍及剩餘文字。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>42abc 可以轉換出 42，整份輸入仍可能被拒絕。</h2><p>strtol 只轉換可辨識的前綴，並透過 &amp;end 回報停止位址。先檢查 end == text 是否沒有數字，再檢查 ERANGE，最後確認剩餘字元符合程式規則。合法的「0」也回傳 0，不能只看 value 判斷失敗。</p><p>base 明確設為 10，所以「010」是十進位 10。前導空白由 strtol 略過；是否接受尾端空白，則由這份程式決定。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>這份輸入會通過哪一個分支？</h2><p>預測 main 回傳值：0＝通過，1＝沒有數字，2＝超出 long 範圍，3＝有剩餘資料。先選好下方設定，再提交預測。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="integer-prediction">預測 main 回傳值</label><div><input id="integer-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="一個非負整數" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.predictionValue === null ? '預測已記錄，執行到 main 回傳後揭曉。' : `你預測 ${submitted}，實際 ${frame.predictionValue}。${submitted === frame.predictionValue ? '預測正確！' : '依序檢查有無數字、範圍與尾端資料。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>轉換結束後，還有三道檢查。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="數字解析控制"
        playback={unlocked ? <PlaybackControls controlName="數字解析執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="allocation-execution lab-panel" aria-label="數字解析執行狀態" data-phase={frame.phase}>
          <h3>main 的變數與 errno</h3><dl className="allocation-variables">
            <div><dt>value · long</dt><dd aria-label="目前 value">{!frame.mainInScope ? '—' : frame.value ?? '尚未取得回傳值'}</dd></div>
            <div><dt>end 相對 text 的索引</dt><dd aria-label="目前 end 索引">{!frame.mainInScope ? '—' : !frame.endDeclared ? '尚未宣告' : frame.endIndex ?? '尚未取得停止位址'}</dd></div>
            <div><dt>*end</dt><dd aria-label="目前 end 字元">{frame.mainInScope && frame.endIndex !== null ? characterLabel(config.text[frame.endIndex]) : '—'}</dd></div>
            <div><dt>errno</dt><dd aria-label="目前 errno">{!frame.mainInScope ? '—' : frame.errno === 'unknown' ? '尚未清除' : frame.errno}</dd></div>
            <div><dt>allow_trailing_space</dt><dd aria-label="目前尾端規則">{frame.mainInScope && frame.allowTrailingSpace !== null ? Number(frame.allowTrailingSpace) : '—'}</dd></div>
          </dl>
          <section className="allocation-block"><h3>text 字元陣列</h3>{!frame.textDeclared || !frame.mainInScope ? <p>輸入陣列尚未建立或已離開作用域。</p> : <ol className="file-input-tokens" aria-label="輸入字元與 end">{[...config.text, undefined].map((character, index) => <li key={index} className={frame.endIndex === index ? 'is-current' : ''}><small>[{index}]</small><code>{characterLabel(character)}</code><small>{frame.endIndex === index ? '← end' : '\u00a0'}</small></li>)}</ol>}
            <p aria-label="轉換停止位置紀錄">strtol 停止位置（紀錄）：{frame.conversionEnd ?? '尚未回傳'}</p><p>這是呼叫完成時的歷史紀錄；略過尾端空白會繼續移動 end，不會改變這份紀錄。</p>
          </section>
          <section className="allocation-block"><h3>轉換概念追蹤（非 main 變數）</h3><p>這是字串分段概念示意，不代表特定 C 函式庫的內部實作。呼叫完成前，main 尚未取得 value 與 end。</p><dl className="allocation-variables"><div><dt>概念掃描索引</dt><dd aria-label="概念掃描索引">{frame.scanIndex ?? '—'}</dd></div><div><dt>數字個數</dt><dd>{frame.digitCount}</dd></div><div><dt>符號</dt><dd>{frame.sign === null ? '—' : frame.sign === -1 ? '負' : '正'}</dd></div><div><dt>概念量值</dt><dd aria-label="概念量值">{frame.magnitude ?? '—'}</dd></div></dl></section>
          <p className="allocation-condition" aria-label="目前判斷">{frame.condition ? `${frame.condition.expression} → ${frame.condition.value ? '成立' : '不成立'}` : '這一步沒有條件判斷'}</p>
          <p aria-label="main 回傳值">main 回傳值：{frame.exitCode ?? '尚未回傳'}</p>
          <div className="allocation-console"><h3>主控台輸出</h3><pre aria-label="數字解析輸出">{frame.output.length ? frame.output.join('') : '尚無輸出'}</pre></div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分開驗證值、停止位置與範圍。</h2>
      <ChallengePanel challenges={INTEGER_PARSING_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="數字解析學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{INTEGER_PARSING_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateIntegerParsingChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`integer-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`integer-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>先問有沒有轉換，再問範圍與剩餘資料。</h2><p>每次呼叫前清除 errno，呼叫後檢查 end 與 ERANGE。isspace 的引數要能以 unsigned char 表示，或是 EOF；本例先轉成 unsigned char，才檢查尾端字元。</p><p>本課明確採用 32／64 位元二補數模型；C 實作的 long 範圍與整數表示法應以該平台為準。長整數以精確十進位文字顯示，避免瀏覽器浮點精度影響示範。</p><p>語意依據：<a href="https://www.sigbus.info/n1570#7.22.1.4" target="_blank" rel="noreferrer">C11 工作草案 N1570：strtol</a>、<a href="https://www.sigbus.info/n1570#7.4" target="_blank" rel="noreferrer">字元分類函式</a>。</p>{count === 3 && <p role="status">你已完成 strtol 數字解析與輸入驗證。</p>}<div><Link className="button button-secondary" to="/learn/files/characters">上一課：fgetc 逐字讀取與 EOF</Link><Link className="button button-primary" to="/learn/files/score-statistics">下一課：檔案資料驗證與分數統計</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
