import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_STRING_COPY_CONFIG, simulateStringCopyProgram, validateStringCopyConfig, type StringCopyConfig, type StringCopyPhase, STRING_COPY_SAMPLES, STRING_COPY_CAPACITIES } from '../domain/stringCopy'
import { STRING_COPY_CHALLENGES, evaluateStringCopyChallenge, type StringCopyChallengeId } from '../data/stringCopyChallenges'

const LESSON_ID = 'arrays-string-copy' as const
const phaseLabels: Record<StringCopyPhase, string> = {
  'enter-main': '進入 main', 'initialize-source': '建立來源字串', 'declare-destination': '保留目的容量',
  'measure-length': '計算字串長度', 'print-sizes': '輸出長度與容量', 'check-capacity': '檢查結尾空字元是否放得下',
  'initialize-i': '建立複製索引', 'copy-condition': '判斷是否還有字元', 'copy-character': '複製一格',
  'increment-i': '更新索引', 'finish-copy': '結束複製迴圈', 'print-string': '輸出目的字串',
  'reject-copy': '容量不足，拒絕複製', 'end-if': '離開判斷區塊', 'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): StringCopyConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STRING_COPY_CONFIG }
  const config = value as StringCopyConfig
  return validateStringCopyConfig(config).length ? { ...DEFAULT_STRING_COPY_CONFIG } : { sample: config.sample, capacity: config.capacity }
}
function parseLength(value: string): number | null {
  return /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) ? Number(value) : null
}

function CharacterStrip({ name, characters, count, activeIndex, inScope }: {
  name: string; characters: readonly (string | null)[] | null; count: number; activeIndex: number | null; inScope: boolean
}) {
  return <section className="string-copy-strip"><h3>{name}</h3>
    <div className="string-copy-scroll" role="region" tabIndex={0} aria-label={`${name} 記憶格，窄螢幕可水平捲動`}>
      <ol className="string-copy-memory" aria-label={`${name} 陣列`} style={{ gridTemplateColumns: `repeat(${count}, minmax(70px, 1fr))` }}>
        {Array.from({ length: count }, (_, index) => {
          const character = characters?.[index]
          const status = !inScope ? '離開作用域' : characters === null ? '尚未宣告' : character === null ? '未初始化' : character === '\0' ? '空字元' : '字元'
          const value = !inScope || characters === null || character === null ? '—' : character === '\0' ? '\\0' : character
          return <li key={index} className={activeIndex === index ? 'is-active' : ''} aria-current={activeIndex === index ? 'step' : undefined} aria-label={`${name}[${index}]，${status}`}>
            <code>[{index}]</code><strong>{value}</strong><small>{status}</small>
          </li>
        })}
      </ol>
    </div>
  </section>
}

export function StringCopyLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<StringCopyChallengeId>(STRING_COPY_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<StringCopyChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<StringCopyChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateStringCopyProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = STRING_COPY_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(STRING_COPY_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: StringCopyConfig) => {
    if (validateStringCopyConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parseLength(prediction)
    if (value === null) { setError('請輸入一個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
  }
  const controls = <div className="pointers-controls string-copy-controls"><h2>選擇字串與目的容量</h2>
    <label htmlFor="string-copy-sample">來源字串</label><select id="string-copy-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as StringCopyConfig['sample'] })}>{Object.entries(STRING_COPY_SAMPLES).map(([value, sample]) => <option key={value} value={value}>{sample.label}</option>)}</select>
    <label htmlFor="string-copy-capacity">目的陣列容量</label><select id="string-copy-capacity" value={config.capacity} onChange={event => changeConfig({ ...config, capacity: Number(event.target.value) as StringCopyConfig['capacity'] })}>{STRING_COPY_CAPACITIES.map(value => <option key={value} value={value}>{value} 格 char</option>)}</select>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_STRING_COPY_CONFIG })}>恢復預設值</button>
    <p>先比較長度與容量。放不下完整字串時，程式會拒絕複製；目的格子不會被改寫。</p>
  </div>
  return <div className="string-copy-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 字串長度與安全複製</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 08</span><h1>內容算長度，<br />結尾也要留位置。</h1><p>比較 strlen 與陣列容量，逐格複製包含結尾空字元的字串。看見哪一些記憶格有資料，哪一些仍未初始化。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>長度不含結尾，容量必須包含。</h2><p>strlen 從第一格讀到第一個空字元，但不把空字元算進長度。sizeof 在本課直接用於 char 陣列，得到整個陣列的位元組數。複製長度為 n 的內容，需要至少 n + 1 格，最後一格存放結尾空字元。</p><p>本課的 size_t 是 strlen 與 sizeof 使用的無號整數型別，printf 用 %zu 輸出；字串常值會自動附加一個結尾空字元。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>這個字串有多長？</h2><p>目前使用「{STRING_COPY_SAMPLES[config.sample].label}」。先預測 strlen(source)，再觀察結尾空字元與容量判斷。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="string-copy-prediction">預測 strlen 長度</label><div><input id="string-copy-prediction" inputMode="numeric" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="不計結尾空字元" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.length === null ? '預測已記錄，執行 strlen 時揭曉。' : `你預測 ${submitted}，實際長度 ${frame.length}。${submitted === frame.length ? '預測正確！' : '在第一個空字元之前，數一數可見內容。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>把結尾一起複製，才能安全輸出。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="字串複製控制"
        playback={unlocked ? <PlaybackControls controlName="字串複製執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="string-copy-execution lab-panel" aria-label="字串記憶體與輸出">
          <CharacterStrip name="source" characters={frame.source} count={STRING_COPY_SAMPLES[config.sample].characters.length} activeIndex={frame.activeIndex} inScope={frame.mainInScope} />
          <CharacterStrip name="destination" characters={frame.destination} count={config.capacity} activeIndex={frame.activeIndex} inScope={frame.mainInScope} />
          <dl className="string-copy-state">
            <div><dt>strlen(source)</dt><dd aria-label="目前字串長度">{frame.mainInScope ? frame.length ?? '—' : '—'}</dd></div>
            <div><dt>sizeof source</dt><dd aria-label="來源陣列大小">{frame.mainInScope && frame.source ? frame.source.length : '—'}</dd></div>
            <div><dt>sizeof destination</dt><dd aria-label="目的陣列容量">{frame.mainInScope && frame.destination ? frame.destination.length : '—'}</dd></div>
            <div><dt>i</dt><dd aria-label={`i，${frame.iInScope ? frame.i : '不在作用域'}`}>{frame.iInScope ? frame.i : '—'}</dd></div>
          </dl>
          <p aria-label="容量判斷">{frame.fits === null ? '尚未判斷容量。' : frame.fits ? '容量足夠：可容納內容與結尾空字元。' : '容量不足：拒絕複製，目的陣列保持未初始化。'}</p>
          <p>已複製 {frame.copiedCount} 格，包含已寫入的結尾空字元。未初始化的格子用 — 表示，不等於空字元。</p>
          <div className="string-copy-console"><h3>printf 輸出</h3><ol aria-label="字串複製輸出">{frame.output.map((value, index) => <li key={index}><code>{value === '' ? '（空字串，只輸出換行）' : value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清長度、大小與結尾。</h2>
      <ChallengePanel challenges={STRING_COPY_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="字串複製學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{STRING_COPY_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateStringCopyChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`string-copy-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`string-copy-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>先確認容量，再複製完整結尾。</h2><p>字元 '0' 是內容，空字元 <code>{"'\\0'"}</code> 才是結尾。空字串長度是 0，仍需要一格結尾空字元。內嵌空字元後的資料仍屬於來源陣列，但不屬於 strlen 算出的字串內容。</p><p>本課只使用已知有結尾的來源陣列。一般使用 strlen 前，也必須確保來源含有可合法讀取的結尾空字元。</p>{count === 3 && <p role="status">你已完成字串長度與安全複製。</p>}<div><Link className="button button-secondary" to="/learn/arrays/bubble-sort">上一課：氣泡排序</Link><Link className="button button-primary" to="/learn/arrays/string-comparison">下一課：字串比較</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
