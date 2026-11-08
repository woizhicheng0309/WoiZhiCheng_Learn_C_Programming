import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_STRING_COMPARISON_CONFIG, simulateStringComparisonProgram, validateStringComparisonConfig, type StringComparisonConfig, type StringComparisonPhase, type ComparisonSign, COMPARISON_SIGNS, STRING_COMPARISON_SAMPLES } from '../domain/stringComparison'
import { STRING_COMPARISON_CHALLENGES, evaluateStringComparisonChallenge, type StringComparisonChallengeId } from '../data/stringComparisonChallenges'

const LESSON_ID = 'arrays-string-comparison' as const
const phaseLabels: Record<StringComparisonPhase, string> = {
  'enter-main': '進入 main', 'initialize-left': '建立左字串', 'initialize-right': '建立右字串', 'initialize-i': '建立索引',
  'check-terminator': '判斷左字串結尾', 'compare-pair': '比較目前字元', 'increment-i': '前進一格', 'end-while': '停止逐字前進',
  'read-a': '讀取左側位元組', 'read-b': '讀取右側位元組', 'calculate-manual': '計算手寫比較結果', 'call-strcmp': '取得 strcmp 符號',
  'print-manual': '輸出手寫結果', 'check-negative': '判斷負值', 'check-positive': '判斷正值', 'print-relation': '輸出關係',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
const signLabels: Record<ComparisonSign, string> = { negative: '負值', zero: '零', positive: '正值' }
function readConfig(value: unknown): StringComparisonConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STRING_COMPARISON_CONFIG }
  const config = value as StringComparisonConfig
  return validateStringComparisonConfig(config).length ? { ...DEFAULT_STRING_COMPARISON_CONFIG } : { sample: config.sample, reversed: config.reversed }
}
function parsePrediction(value: string): ComparisonSign | null {
  return COMPARISON_SIGNS.includes(value as ComparisonSign) ? value as ComparisonSign : null
}

function StringStrip({ name, characters, count, columns, readIndex, matched, decisiveIndex, inScope }: {
  name: string; characters: readonly string[] | null; count: number; columns: number; readIndex: number | null; matched: readonly number[]; decisiveIndex: number | null; inScope: boolean
}) {
  return <section className="string-comparison-strip"><h3>{name}</h3><div className="string-comparison-scroll" role="region" tabIndex={0} aria-label={name + ' 記憶格，窄螢幕可水平捲動'}>
    <ol className="string-comparison-memory" aria-label={name + ' 字元陣列'} style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(72px, 1fr))' }}>{Array.from({ length: count }, (_, index) => {
      const character = characters?.[index]
      const after = characters !== null && index > characters.indexOf('\0')
      const status = !inScope ? '離開作用域' : characters === null ? '尚未宣告' : after ? '結尾後資料' : character === '\0' ? '空字元' : matched.includes(index) ? '已相同的內容' : '字元'
      const visible = inScope && characters !== null
      const value = visible ? character === '\0' ? '\\0' : character : '—'
      return <li key={index} aria-current={readIndex === index ? 'step' : undefined} aria-label={name + '[' + index + ']，' + status} className={(matched.includes(index) ? 'is-matched ' : '') + (readIndex === index ? 'is-read ' : '') + (index === decisiveIndex ? 'is-decisive ' : '') + (after ? 'is-after' : '')}>
        <code>[{index}]</code><strong>{value}</strong><small>{status}</small>{visible && <span>ASCII {character!.charCodeAt(0)}</span>}{visible && index === decisiveIndex && <b>判定位置</b>}
      </li>
    })}</ol>
  </div></section>
}

export function StringComparisonLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<ComparisonSign | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<StringComparisonChallengeId>(STRING_COMPARISON_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<StringComparisonChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<StringComparisonChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateStringComparisonProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({
    lineNumber: line.lineNumber,
    parts: line.lineNumber === 8 ? [
      { id: 'while-prefix', text: '  while (' },
      { id: 'terminator-guard', text: "left[i] != '\\0'" },
      { id: 'while-and', text: ' && ' },
      { id: 'pair-equality', text: 'left[i] == right[i]' },
      { id: 'while-suffix', text: ') {' },
    ] : [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }],
  }))
  const count = STRING_COMPARISON_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(STRING_COMPARISON_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: StringComparisonConfig) => {
    if (validateStringComparisonConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請先選擇負值、零或正值。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
    visitLesson(LESSON_ID)
  }
  const leftCount = simulation.left?.length ?? 1
  const rightCount = simulation.right?.length ?? 1
  const columns = Math.max(leftCount, rightCount)
  const controls = <div className="pointers-controls string-comparison-controls"><h2>選擇字串與左右順序</h2>
    <label htmlFor="string-comparison-sample">比較範例</label><select id="string-comparison-sample" value={config.sample} onChange={event => changeConfig({ ...config, sample: event.target.value as StringComparisonConfig['sample'] })}>{Object.entries(STRING_COMPARISON_SAMPLES).map(([value, sample]) => <option key={value} value={value}>{sample.label}</option>)}</select>
    <label className="string-comparison-toggle"><input type="checkbox" checked={config.reversed} onChange={event => changeConfig({ ...config, reversed: event.target.checked })} />交換左右字串</label>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_STRING_COMPARISON_CONFIG })}>恢復預設值</button>
    <p>先比較開頭，第一個不同位置就決定結果；如果前面完全相同，才會由結尾空字元決定前綴關係。</p>
  </div>
  return <div className="string-comparison-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 字串比較與 strcmp</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 05 · LESSON 09</span><h1>從第一格比起，<br />不同處決定順序。</h1><p>追蹤相同前綴、空字元與第一個不同的位元組，再用負值、零、正值理解 strcmp 的比較結果。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>比較內容，從第一個不同字元決定。</h2><p>前面相同時繼續前進；一旦不同，後面的字元就不影響結果。若其中一串先遇到空字元，它是另一串的前綴，排序較小。兩邊同時在相同位置結束，結果才是相等。</p><p>本課手寫版本把最後一對轉為 unsigned char，固定計算出 −1、0、1。strcmp 只保證回傳值的符號，不保證非零時的具體數值。範例採 ASCII 位元組比較，並非自然語言排序。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>左字串與右字串，會是哪種關係？</h2><p>目前使用「{STRING_COMPARISON_SAMPLES[config.sample].label}」，{config.reversed ? '已交換左右順序。' : '維持原本左右順序。'}先預測 strcmp 的結果符號。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="string-comparison-prediction">預測 strcmp 結果符號</label><div><select id="string-comparison-prediction" value={prediction} onChange={event => setPrediction(event.target.value)}><option value="">請選擇關係</option><option value="negative">負值：left 小於 right</option><option value="zero">零：兩個字串相等</option><option value="positive">正值：left 大於 right</option></select><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.librarySign === null ? '預測已記錄，執行 strcmp 後揭曉。' : `你預測${signLabels[submitted]}，實際為${signLabels[frame.librarySign]}。${submitted === frame.librarySign ? '預測正確！' : '沿著第一個不同位置或結尾空字元再看一次。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>逐字追蹤，再確認回傳值的符號。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="字串比較控制"
        playback={unlocked ? <PlaybackControls controlName="字串比較執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="string-comparison-execution lab-panel" aria-label="逐字比較與結果">
          <StringStrip name="left" characters={frame.left} count={leftCount} columns={columns} readIndex={frame.leftReadIndex} matched={frame.matchedIndices} decisiveIndex={frame.decisiveIndex} inScope={frame.mainInScope} />
          <StringStrip name="right" characters={frame.right} count={rightCount} columns={columns} readIndex={frame.rightReadIndex} matched={frame.matchedIndices} decisiveIndex={frame.decisiveIndex} inScope={frame.mainInScope} />
          <p>綠底表示已確認相同的內容；外框表示這一步實際讀取的位置。空字元後的格子仍是陣列資料，但不再屬於要比較的字串內容。</p>
          <dl className="string-comparison-state">
            <div><dt>i</dt><dd aria-label="目前比較索引">{frame.mainInScope ? frame.i ?? '—' : '—'}</dd></div>
            <div><dt>手寫 manual</dt><dd aria-label="手寫比較結果">{frame.mainInScope ? frame.manual ?? '—' : '—'}</dd></div>
            <div><dt>a（unsigned char）</dt><dd aria-label="左側位元組值">{frame.mainInScope ? frame.a ?? '—' : '—'}</dd></div>
            <div><dt>b（unsigned char）</dt><dd aria-label="右側位元組值">{frame.mainInScope ? frame.b ?? '—' : '—'}</dd></div>
          </dl>
          <p aria-label="strcmp 結果符號">{!frame.mainInScope ? 'library 已離開作用域。' : frame.librarySign === null ? 'library 尚未取得結果。' : frame.librarySign === 'zero' ? 'library 為零（0）。' : `library 為${signLabels[frame.librarySign]}；非零數值不固定。`}</p>
          <p aria-label="比較判定位置">{frame.decisiveIndex === null ? '尚未取得決定結果的兩個位元組。' : `判定位置：索引 ${frame.decisiveIndex}；前面 ${frame.matchedIndices.length} 個內容字元相同。`}</p>
          <div className="string-comparison-console"><h3>printf 輸出</h3><ol aria-label="字串比較輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，比內容，也辨認回傳契約。</h2>
      <ChallengePanel challenges={STRING_COMPARISON_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="字串比較學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{STRING_COMPARISON_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateStringComparisonChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`string-comparison-answer-${item.id}`}>你的答案（整數或選項編號）</label><input id={`string-comparison-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>判斷負、零、正，不猜特定整數。</h2><p>strcmp 比較字元內容，陣列運算式的 == 比較轉換後的位址，兩者用途不同。長度較長不代表排序較大；內嵌空字元後的差異也不影響這一次字串比較。本課來源都有合法結尾，不會讀取陣列外的資料。</p>{count === 3 && <p role="status">你已完成字串比較與 strcmp。</p>}<div><Link className="button button-secondary" to="/learn/arrays/string-copy">上一課：字串長度與安全複製</Link><Link className="button button-primary" to="/learn/pointers/basics">下一課：指標基礎</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
