import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Code2, Terminal, Trophy, Type } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import {
  DEFAULT_STRING_POINTER_CONFIG, STRING_POINTER_SAMPLES, simulateStringPointerProgram, validateStringPointerConfig,
  type StringPointerConfig, type StringPointerFrame, type StringPointerPhase, type StringSample, type StringStop,
} from '../domain/stringPointers'
import {
  STRING_POINTER_CHALLENGES, evaluateDigitZeroLength, evaluateEmbeddedNul, evaluateStringTerminator,
  type StringPointerChallengeId,
} from '../data/stringPointerChallenges'

const LESSON_ID = 'pointers-strings' as const
type Feedback = { solved: boolean; message: string }
const phaseLabels: Record<StringPointerPhase, string> = {
  'enter-main': '進入 main', 'initialize-string': '建立字元陣列', 'bind-pointer': '指向第一個字元',
  'initialize-length': '建立 length', condition: '讀取並比較字元', 'read-character': '輸出目前字元',
  'increment-length': '累計長度', 'advance-pointer': '移向下一個字元', 'print-length': '輸出 length',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): StringPointerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STRING_POINTER_CONFIG }
  const candidate = value as StringPointerConfig
  return validateStringPointerConfig(candidate).length === 0 ? { sample: candidate.sample, stopAt: candidate.stopAt } : { ...DEFAULT_STRING_POINTER_CONFIG }
}
function visibleCharacter(character: string) { return character === '\0' ? '\\0' : character }
function StringMemory({ frame, config }: { frame: StringPointerFrame; config: StringPointerConfig }) {
  const memory = frame.memory
  const sample = STRING_POINTER_SAMPLES.find((item) => item.id === config.sample) ?? STRING_POINTER_SAMPLES[0]
  const stripRef = useRef<HTMLDivElement>(null)
  const activePosition = memory.inScope ? memory.pointerIndex : null
  const startingFrame = frame.phase === 'enter-main' ? frame : null
  const onePast = memory.pointerIndex === sample.characters.length && memory.inScope
  const lengthPrinted = ['print-length', 'return-main', 'done'].includes(frame.phase)
  const pointerValue = memory.pointerIndex === null ? '尚未宣告' : !memory.inScope ? '離開作用域' : `text + ${memory.pointerIndex}`
  const lengthValue = memory.length === null ? '尚未宣告' : !memory.inScope ? '離開作用域' : String(memory.length)
  useEffect(() => {
    const revealPosition = () => {
      const strip = stripRef.current
      if (!strip) return
      if (startingFrame) { strip.scrollLeft = 0; return }
      if (activePosition === null) return
      const cell = strip.querySelector<HTMLElement>(`[data-position="${activePosition}"]`)
      if (!cell) return
      const bounds = strip.getBoundingClientRect()
      const cellBounds = cell.getBoundingClientRect()
      const left = bounds.left + strip.clientLeft + 3
      const right = bounds.left + strip.clientLeft + strip.clientWidth - 3
      if (cellBounds.left < left) strip.scrollLeft -= left - cellBounds.left
      else if (cellBounds.right > right) strip.scrollLeft += cellBounds.right - right
    }
    revealPosition()
    window.addEventListener('resize', revealPosition)
    return () => window.removeEventListener('resize', revealPosition)
  }, [activePosition, startingFrame])
  return <section className="string-memory lab-panel" aria-labelledby="string-memory-title">
    <div className="pointers-panel-heading"><small>CHARACTERS & THE TERMINATOR</small><h2 id="string-memory-title">看見每個字元，也看見停止的位置。</h2></div>
    <p className="pointers-address-note">索引是元素位置，text + n 是位移示意。字元 <code>'0'</code> 是數字零（ASCII 48），<code>'\0'</code> 是空字元 NUL（ASCII 0）。</p>
    <div ref={stripRef} className="string-strip-scroll" tabIndex={0} aria-label="text 字元陣列與尾後位置；窄螢幕可水平捲動">
      <div className="string-strip" role="list" aria-label="text 的字元陣列">
        {sample.characters.map((character, index) => {
          const pointed = memory.pointerIndex === index && memory.inScope
          const read = frame.readIndex === index && memory.inScope
          const comparing = read && frame.phase === 'condition'
          const emitting = read && frame.phase === 'read-character'
          const value = !memory.characters ? '尚未建立' : !memory.inScope ? '離開作用域' : visibleCharacter(character)
          const nul = character === '\0'
          return <div key={index} role="listitem" data-position={index}
            className={`string-cell${nul ? ' is-nul' : ''}${pointed ? ' is-pointed' : ''}${comparing ? ' is-comparing' : ''}${emitting ? ' is-emitting' : ''}`}
            aria-label={`text[${index}]，${value}${nul ? '，字串終止字元' : character === '0' ? '，數字零' : ''}${comparing ? '，比較讀取' : emitting ? '，輸出讀取' : pointed ? '，p 指向這格' : ''}`}>
            <span>{comparing ? '比較' : emitting ? '輸出' : pointed ? 'p 在這裡' : 'char'}</span>
            <strong>{memory.characters && memory.inScope ? visibleCharacter(character) : '—'}</strong><code>[{index}]</code>
            <small>{nul ? <>字串終止字元<br />NUL · ASCII 0</> : character === '0' ? '數字 · ASCII 48' : '可顯示字元'}</small>
          </div>
        })}
        <div className={`string-one-past${onePast ? ' is-pointed' : ''}`} data-position={sample.characters.length} aria-label={`text + ${sample.characters.length}，尾後位置，不是字元，不可解參照`}>
          <span>尾後位置</span><strong>—</strong><code>+ {sample.characters.length}</code><small>不可解參照</small>
        </div>
      </div>
    </div>
    <div className="string-state-grid">
      <div aria-label={`指標 p，${pointerValue}`}><small>{onePast ? 'p 保存尾後位置的位址' : 'p 的目前位置'}</small><code>p</code><strong>{pointerValue}</strong></div>
      <div aria-label={`累計 length，${lengthValue}`}><small>已輸出的字元數量</small><code>length</code><strong>{lengthValue}</strong></div>
    </div>
    <div className="string-condition" aria-label={`while 條件，${frame.conditionResult === null ? '本步未判斷' : frame.conditionResult ? 'true' : 'false'}`}>
      <code>*p != '{config.stopAt === 'nul' ? '\\0' : '0'}'</code><strong>{frame.conditionResult === null ? '—' : frame.conditionResult ? 'true' : 'false'}</strong>
      <span>{frame.conditionCharacter !== null ? `目前讀到 '${visibleCharacter(frame.conditionCharacter)}'` : '等到條件判斷步驟再讀取'}</span>
    </div>
    <div className="pointers-console" aria-label="字元程式輸出"><span><Terminal size={16} aria-hidden="true" /> putchar 累積輸出</span><code aria-label="putchar 已輸出的字元">{frame.outputText || '尚無輸出'}</code>
      <small>輸出中的 <code>\0</code> 代表實際輸出的不可見 NUL，不是反斜線與 0 兩個字元。</small>
      <div className="string-length-output" aria-label="printf 的 length">printf 的 length：<strong>{lengthPrinted ? memory.length : '尚未輸出'}</strong></div>
    </div>
  </section>
}

export function StringPointerLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lessonProgress = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lessonProgress.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(() => lessonProgress.guidedRunCompleted || simulateStringPointerProgram(config).status === 'blocked')
  const [prediction, setPrediction] = useState('')
  const [submittedPrediction, setSubmittedPrediction] = useState<number | null>(null)
  const [predictionError, setPredictionError] = useState('')
  const [activeChallenge, setActiveChallenge] = useState<StringPointerChallengeId>(() => STRING_POINTER_CHALLENGES.find((challenge) => !lessonProgress.completedChallengeIds.includes(challenge.id))?.id ?? STRING_POINTER_CHALLENGES[0].id)
  const [challengeLength, setChallengeLength] = useState('')
  const [terminatorAnswer, setTerminatorAnswer] = useState<'nul' | 'digit-zero' | null>(null)
  const [embeddedAnswer, setEmbeddedAnswer] = useState<'CO' | 'CODE' | null>(null)
  const [feedback, setFeedback] = useState<Partial<Record<StringPointerChallengeId, Feedback>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const syncRef = useRef({ savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId })
  const resettingProgressRef = useRef(false)
  const simulation = useMemo(() => simulateStringPointerProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = useMemo(() => simulation.source.lines.map((line) => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] })), [simulation.source])
  const completedCount = STRING_POINTER_CHALLENGES.filter((challenge) => lessonProgress.completedChallengeIds.includes(challenge.id)).length
  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = syncRef.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    syncRef.current = { savedKey, guided: lessonProgress.guidedRunCompleted, hasLesson, visited: progress.lastVisitedLessonId }
    resettingProgressRef.current = previous.savedKey !== savedKey || cleared
    const savedConfig = readConfig(JSON.parse(savedKey))
    const savedBlocked = simulateStringPointerProgram(savedConfig).status === 'blocked'
    if (resettingProgressRef.current) {
      setConfig(savedConfig)
      setPrediction('')
      setSubmittedPrediction(null)
      setPredictionError('')
      setUnlocked(lessonProgress.guidedRunCompleted || savedBlocked)
      if (cleared) { resetPlayer(); setFeedback({}); setActiveChallenge(STRING_POINTER_CHALLENGES[0].id) }
    } else if (previous.guided !== lessonProgress.guidedRunCompleted) setUnlocked(lessonProgress.guidedRunCompleted || savedBlocked)
  }, [savedKey, lessonProgress.guidedRunCompleted, hasLesson, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resettingProgressRef.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: StringPointerConfig) => {
    setConfig(next)
    setPrediction('')
    setSubmittedPrediction(null)
    setPredictionError('')
    setUnlocked(lessonProgress.guidedRunCompleted || simulateStringPointerProgram(next).status === 'blocked')
    if (validateStringPointerConfig(next).length === 0) { syncRef.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next) }
  }
  const submitPrediction = (event: FormEvent) => {
    event.preventDefault()
    const answer = prediction.trim() === '' ? Number.NaN : Number(prediction)
    if (!Number.isInteger(answer) || answer < 0) { setPredictionError('請先輸入非負整數，預測最後的 length。'); return }
    setPredictionError('')
    setSubmittedPrediction(answer)
    setUnlocked(true)
    player.reset()
  }
  const completeChallenge = (id: StringPointerChallengeId, evaluation: Feedback) => {
    setFeedback((current) => ({ ...current, [id]: evaluation }))
    if (evaluation.solved) markChallengeCompleted(LESSON_ID, id)
  }
  const controls = <div className="pointers-controls string-controls"><h2>換一個字串，檢查停止條件。</h2>
    <label htmlFor="string-sample">字串內容</label><select id="string-sample" value={config.sample} onChange={(event) => changeConfig({ ...config, sample: event.target.value as StringSample })}>{STRING_POINTER_SAMPLES.map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select>
    <label htmlFor="string-stop">停止條件</label><select id="string-stop" value={config.stopAt} onChange={(event) => changeConfig({ ...config, stopAt: event.target.value as StringStop })}><option value="nul">'\0' · 空字元 NUL</option><option value="digit-zero">'0' · 數字零（錯誤示範）</option></select>
    <button className="functions-restore-button" type="button" onClick={() => changeConfig({ ...DEFAULT_STRING_POINTER_CONFIG })}>恢復預設值</button>
    <p className="string-safety-note">錯把 '0' 當終點，可能提早停止，也可能越界。模擬器會在越界解參照前保護停止；真實 C 的越界解參照是未定義行為，語言本身不提供自動邊界檢查。</p>
  </div>
  const challengeItems = STRING_POINTER_CHALLENGES.map((challenge, index) => ({ id: challenge.id, label: challenge.title, eyebrow: `CHALLENGE 0${index + 1}`, completed: lessonProgress.completedChallengeIds.includes(challenge.id) }))
  const lengthPrinted = ['print-length', 'return-main', 'done'].includes(frame.phase)
  return <div className="string-pointers-page pointers-page functions-page lab-page">
    <section className="string-pointers-hero pointers-hero functions-hero lab-hero"><div className="page-width"><nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/learn">課程地圖</Link><ChevronRight size={14} aria-hidden="true" /><span>字串與字元指標</span></nav>
      <div className="functions-hero__layout"><div className="functions-hero__copy"><Link className="back-link" to="/learn"><ArrowLeft size={16} aria-hidden="true" />回到課程地圖</Link><span className="section-kicker">MODULE 06 · LESSON 04</span><h1>字串在哪裡結束？<br />讓 p 找到那個 '\0'。</h1><p>逐字讀取、輸出、計數，再前進。分辨數字 '0' 與空字元 '\0'，看懂 C 字串真正的終點。</p></div>
      <aside className={`lesson-status-card${completedCount === 3 ? ' complete' : ''}`} aria-label="本單元學習進度"><div><Trophy size={21} aria-hidden="true" /><span>{completedCount === 3 ? '單元完成' : '學習進度'}</span></div><strong>{completedCount}<small>/3</small></strong><p>通過三題即可完成這個單元</p></aside></div>
    </div></section>
    <section className="functions-overview page-width" aria-labelledby="string-goals-title"><div className="functions-objectives"><span className="section-kicker">LEARNING GOALS</span><h2 id="string-goals-title">看不見的字元，決定看得見的字串。</h2><ul><li><Check size={17} aria-hidden="true" />分辨 '0' 與 '\0' 的字元值。</li><li><Check size={17} aria-hidden="true" />觀察 while 先比較，再決定是否輸出。</li><li><Check size={17} aria-hidden="true" />理解陣列仍有資料，字串卻已經結束。</li></ul></div>
      <div className="functions-concepts"><article><span><Type size={20} aria-hidden="true" /></span><small>01 · 可顯示字元</small><h3>'0' 也佔一個字元</h3><p><code>"C0DE"</code> 中的 0 是數字字元。它會被輸出，也會計入長度。</p></article><article><span><Code2 size={20} aria-hidden="true" /></span><small>02 · 終止字元</small><h3>'\0' 是 NUL，不是數字</h3><p>字串常值會在尾端補上 NUL。條件讀到它後，應在輸出前結束迴圈。</p></article><article><span><ArrowRight size={20} aria-hidden="true" /></span><small>03 · 第一個 NUL</small><h3>後面有資料，也要停</h3><p><code>"CO\0DE"</code> 的字元陣列保留 D、E，但字串在第一個 NUL 就結束了。</p></article></div>
    </section>
    <section className="functions-prediction-section" aria-labelledby="string-prediction-title"><div className="page-width functions-prediction-card"><div className="functions-prediction-card__copy"><span className="section-kicker">PREDICT BEFORE RUN</span><h2 id="string-prediction-title">這次的 length 最後會是多少？</h2><p>{simulation.status === 'blocked' ? '這個停止條件會走到陣列外。直接觀察安全停止；越界之後沒有可預測的完整結果。' : '先預測最後的計數，再逐步檢查每個字元。答案等程式輸出 length 時揭曉。'}</p></div>
      {simulation.status === 'completed' && <form className="functions-prediction-form" onSubmit={submitPrediction}><label htmlFor="string-prediction">預測最後的 length</label><div><input id="string-prediction" type="number" min={0} step={1} value={prediction} onChange={(event) => setPrediction(event.target.value)} /><button className="button button-primary" type="submit">提交長度預測 <ArrowRight size={17} aria-hidden="true" /></button></div>{predictionError && <p className="functions-form-error" role="alert">{predictionError}</p>}</form>}
      {submittedPrediction !== null && <p className="pointers-prediction-feedback" role="status">{!lengthPrinted ? '預測已記錄。輸出 length 時再比對結果。' : `你預測 ${submittedPrediction}，實際 length = ${frame.memory.length}。${submittedPrediction === frame.memory.length ? '預測正確！' : '數一數真正被輸出的字元，再試一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section" aria-labelledby="string-lab-title"><div className="page-width"><div className="functions-section-heading"><span className="section-kicker">FOLLOW EACH CHARACTER</span><h2 id="string-lab-title"><span>先比較，再輸出，</span><span>最後才前進。</span></h2><p>「比較」與「輸出」都會讀取字元。條件為 false 時，該字元不會被輸出，也不會增加 length。</p></div>
      <LabShell className="functions-lab-shell pointers-lab-shell string-lab-shell" controls={controls} controlsLabel="字串指標控制"
        playback={unlocked ? <PlaybackControls controlName="字串執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p className="functions-player-lock" role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><div><small>STEP {player.frameIndex + 1} / {simulation.frames.length}</small><strong>{phaseLabels[frame.phase]}</strong></div><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p className="functions-blocked-message" role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} title={<><Code2 size={17} aria-hidden="true" />C 程式碼</>} status={phaseLabels[frame.phase]} /><StringMemory frame={frame} config={config} />
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? `${phaseLabels[frame.phase]}。${frame.explanation}` : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width" aria-labelledby="string-challenges-title"><div className="functions-section-heading"><span className="section-kicker">TRY IT YOURSELF</span><h2 id="string-challenges-title">三個挑戰，找對字串的終點。</h2></div>
      <ChallengePanel challenges={challengeItems} activeId={activeChallenge} onSelect={setActiveChallenge} label="字串指標學習挑戰">{(challenge) => <div className="pointers-challenge-content"><h3>{challenge.label}</h3><p>{STRING_POINTER_CHALLENGES.find((item) => item.id === challenge.id)?.description}</p>
        {challenge.id === 'predict-digit-zero-length' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateDigitZeroLength(challengeLength.trim() === '' ? null : Number(challengeLength))) }}><pre className="functions-challenge-code">{'char text[] = "C0DE";\n/* 遇到 \'\\0\' 才停止 */'}</pre><label htmlFor="string-challenge-length">C0DE 的字串長度</label><input id="string-challenge-length" type="number" min={0} step={1} value={challengeLength} onChange={(event) => setChallengeLength(event.target.value)} /><button className="button button-primary" type="submit">檢查字串長度</button></form>}
        {challenge.id === 'choose-string-terminator' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateStringTerminator(terminatorAnswer)) }}><fieldset><legend>C 字串以哪個字元結束？</legend><label><input type="radio" name="string-terminator-answer" checked={terminatorAnswer === 'digit-zero'} onChange={() => setTerminatorAnswer('digit-zero')} />'0' · 數字零（ASCII 48）</label><label><input type="radio" name="string-terminator-answer" checked={terminatorAnswer === 'nul'} onChange={() => setTerminatorAnswer('nul')} />'\0' · NUL（ASCII 0）</label></fieldset><button className="button button-primary" type="submit">檢查終止字元</button></form>}
        {challenge.id === 'identify-embedded-nul' && <form onSubmit={(event) => { event.preventDefault(); completeChallenge(challenge.id, evaluateEmbeddedNul(embeddedAnswer)) }}><pre className="functions-challenge-code">{'char text[] = "CO\\0DE";\nprintf("%s", text);'}</pre><fieldset><legend>printf 的 %s 會輸出什麼？</legend><label><input type="radio" name="string-embedded-answer" checked={embeddedAnswer === 'CODE'} onChange={() => setEmbeddedAnswer('CODE')} />CODE · 繼續讀完後面的字元</label><label><input type="radio" name="string-embedded-answer" checked={embeddedAnswer === 'CO'} onChange={() => setEmbeddedAnswer('CO')} />CO · 在第一個 NUL 停止</label></fieldset><button className="button button-primary" type="submit">檢查內嵌 NUL</button></form>}
        {feedback[challenge.id] && <p className={`functions-challenge-feedback ${feedback[challenge.id]?.solved ? 'is-success' : 'is-hint'}`} role="status">{feedback[challenge.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>讀到 '\0'，字串就到這裡。</h2><p>數字 '0' 是資料，NUL 是終止字元。正確的條件會讀到 NUL 來確認終點，卻不會把它輸出或算進字串長度。</p><div><Link className="button button-secondary" to="/learn/pointers/traversal"><ArrowLeft size={17} aria-hidden="true" />上一課：陣列與指標走訪</Link><Link className="button button-primary" to="/learn">回到課程地圖 <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
  </div>
}
