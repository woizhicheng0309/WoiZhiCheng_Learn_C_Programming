import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_STRUCTURE_POINTER_CONFIG, STRUCTURE_POINTER_SYNTAXES, simulateStructurePointerProgram, validateStructurePointerConfig, type StructurePointerConfig, type StructurePointerObject, type StructurePointerPhase, type PointerStudent } from '../domain/structurePointers'
import { STRUCTURE_POINTER_CHALLENGES, evaluateStructurePointerChallenge, type StructurePointerChallengeId } from '../data/structurePointerChallenges'

const LESSON_ID = 'structures-pointers' as const
const phaseLabels: Record<StructurePointerPhase, string> = {
  prepare: '準備結構與指標', 'enter-main': '進入 main', 'initialize-first': '建立 first', 'initialize-second': '建立 second',
  'bind-p': '保存物件位址', 'copy-pointer': '複製指標值', 'write-via-q': '透過 q 修改成員', 'rebind-p': '改變 p 的指向',
  'check-pointer': '檢查空指標', 'write-via-p': '透過 p 修改成員', print: '輸出成員值',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): StructurePointerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STRUCTURE_POINTER_CONFIG }
  const config = value as StructurePointerConfig
  return validateStructurePointerConfig(config).length ? { ...DEFAULT_STRUCTURE_POINTER_CONFIG }
    : { syntax: config.syntax, initialTarget: config.initialTarget, target: config.target, aliasScore: config.aliasScore, pointedScore: config.pointedScore }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 2 && tokens.every(token => /^\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}
function ObjectCard({ name, record, inScope, active, writing }: {
  name: StructurePointerObject; record: Readonly<PointerStudent> | null; inScope: boolean; active: boolean; writing: boolean
}) {
  const visible = inScope && record !== null
  return <section className={'structure-object ' + (active ? 'is-active' : '')} aria-label={`${name} 結構物件`}>
    <h3>{name}</h3><p><code>struct Student</code> · {visible ? '物件已建立' : record === null ? '尚未建立' : '已離開作用域'}</p>
    <dl className="structure-members">{(['id', 'score'] as const).map(field => <div key={field} className={writing && field === 'score' ? 'is-selected' : ''}>
      <dt><code>{name}.{field}</code><small>int</small></dt><dd aria-label={`${name}.${field}`}>{visible ? record[field] : '—'}</dd>
    </div>)}</dl>
  </section>
}

export function StructurePointerLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<StructurePointerChallengeId>(STRUCTURE_POINTER_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<StructurePointerChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<StructurePointerChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateStructurePointerProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = STRUCTURE_POINTER_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(STRUCTURE_POINTER_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: StructurePointerConfig) => {
    if (validateStructurePointerConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請依序輸入 first、second 的分數，使用兩個非負整數。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset(); visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls structure-controls"><h2>設定寫法、指向與分數</h2>
    <label htmlFor="structure-pointer-syntax">成員存取寫法</label><select id="structure-pointer-syntax" value={config.syntax} onChange={event => changeConfig({ ...config, syntax: event.target.value as StructurePointerConfig['syntax'] })}>{Object.entries(STRUCTURE_POINTER_SYNTAXES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="structure-pointer-initial">p 的初始指向</label><select id="structure-pointer-initial" value={config.initialTarget} onChange={event => changeConfig({ ...config, initialTarget: event.target.value as StructurePointerObject })}><option value="first">&first</option><option value="second">&second</option></select>
    <label htmlFor="structure-pointer-target">p 的新指向</label><select id="structure-pointer-target" value={config.target} onChange={event => changeConfig({ ...config, target: event.target.value as StructurePointerConfig['target'] })}><option value="first">&first</option><option value="second">&second</option><option value="null">NULL：略過 p 的成員修改</option></select>
    <label htmlFor="structure-pointer-alias-score">透過 q 寫入的分數</label><div className="structure-pointer-range"><input id="structure-pointer-alias-score" type="range" min="0" max="100" step="1" value={config.aliasScore} onChange={event => changeConfig({ ...config, aliasScore: Number(event.target.value) })} /><output htmlFor="structure-pointer-alias-score">{config.aliasScore}</output></div>
    <label htmlFor="structure-pointer-pointed-score">透過 p 寫入的分數</label><div className="structure-pointer-range"><input id="structure-pointer-pointed-score" type="range" min="0" max="100" step="1" value={config.pointedScore} disabled={config.target === 'null'} onChange={event => changeConfig({ ...config, pointedScore: Number(event.target.value) })} /><output htmlFor="structure-pointer-pointed-score">{config.pointedScore}</output></div>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_STRUCTURE_POINTER_CONFIG })}>恢復預設值</button>
    <p>first、second 原始分數為 80、60。q 先複製 p 的初始位址並改值，再改變 p 的指向。{config.target === 'null' && 'p 為 NULL 時，分支內的修改會被略過。'}</p>
  </div>
  const aliasMessage = !frame.mainInScope ? '指標尚未建立或已離開作用域。'
    : frame.q === null ? 'q 尚未建立。'
      : frame.p === frame.q ? `p 與 q 指向同一份 ${frame.q} 結構。`
        : `q 仍指向 ${frame.q}，不會隨 p 的改指向而改變。`
  return <div className="structure-page structure-pointer-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 指向結構的指標</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 07 · LESSON 03</span><h1>沿著指標，<br />找到結構的成員。</h1><p>比較箭頭與解參照寫法，追蹤兩個指標共用一份物件、改指向與空指標分支，分清楚位址和成員值。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>物件用點，指標用箭頭。</h2><p>first.score 直接讀取物件成員；p-&gt;score 透過指標存取成員，等同 (*p).score，括號不能省略。struct Student *q = p 複製的是位址，沒有建立第三份結構物件。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>兩個指標，最後改到哪份物件？</h2><p>q 指向 {config.initialTarget}，先寫入 {config.aliasScore}；p 再{config.target === 'null' ? '改為 NULL，略過修改' : `指向 ${config.target}，寫入 ${config.pointedScore}`}。依序預測 first.score、second.score。</p></div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="structure-pointer-prediction">預測 first、second 的分數</label><div><input id="structure-pointer-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.printedValues === null ? '預測已記錄，執行到 printf 後揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.printedValues.join('、')}。${submitted.every((value, index) => value === frame.printedValues![index]) ? '預測正確！' : '沿著 p、q 保存的位址，確認每次修改發生在哪份物件。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>指標各自保存位址，物件保存成員值。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="結構指標控制"
        playback={unlocked ? <PlaybackControls controlName="結構指標執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="structure-execution lab-panel" aria-label="結構指標與物件值" data-phase={frame.phase}>
          <dl className="structure-pointer-links">{(['p', 'q'] as const).map(pointer => <div key={pointer} className={frame.activePointer === pointer ? 'is-active' : ''}><dt>{pointer}<small>struct Student *</small></dt><dd aria-label={`${pointer} 指向`}>{!frame.mainInScope ? '—' : frame[pointer] === null ? '尚未建立' : frame[pointer] === 'null' ? 'NULL' : `→ &${frame[pointer]}`}</dd></div>)}</dl>
          <p aria-label="兩個指標的關係">{aliasMessage}</p>
          {(['first', 'second'] as const).map(name => <ObjectCard key={name} name={name} record={frame[name]} inScope={frame.mainInScope} active={frame.activeObject === name} writing={frame.activeObject === name && (frame.phase === 'write-via-p' || frame.phase === 'write-via-q')} />)}
          <p aria-label="空指標判斷">{frame.condition === null ? '執行到 if 時檢查 p != NULL。' : `p != NULL → ${frame.condition ? '成立，執行修改' : '不成立，略過修改'}`}</p>
          <p>以 &amp;first、&amp;second 表示位址關係，不表示實際位址或位元組配置。本例只會產生指向有效物件的指標或 NULL；一般程式中，非空指標仍可能失效。</p>
          <div className="structure-console"><h3>printf 輸出</h3><ol aria-label="結構指標輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清成員、位址與分支。</h2>
      <ChallengePanel challenges={STRUCTURE_POINTER_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="結構指標學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{STRUCTURE_POINTER_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateStructurePointerChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`structure-pointer-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`structure-pointer-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>複製指標值，仍然共用原物件。</h2><p>q = p 讓兩個指標保存同一個位址。之後重新指定 p，不會改掉 q，也不會搬移結構。透過任一有效指標寫入成員，改變的都是它當下指向的那份物件。</p><p>可以把 NULL 存入指標，但不能透過空指標存取成員。本例用 if 決定是否執行修改；NULL 情境仍能正常輸出兩份物件的分數。</p>{count === 3 && <p role="status">你已完成指向結構的指標。</p>}<div><Link className="button button-secondary" to="/learn/structures/arrays">上一課：結構陣列與逐筆統計</Link><Link className="button button-primary" to="/learn/memory/allocation">下一課：動態記憶體配置與釋放</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
