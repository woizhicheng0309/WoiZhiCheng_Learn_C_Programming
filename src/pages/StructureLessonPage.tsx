import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChallengePanel, LabShell, PlaybackControls, SourceCodePanel } from '../components/lab'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { useTracePlayer, type PlaybackSpeed } from '../hooks/useTracePlayer'
import { DEFAULT_STRUCTURE_CONFIG, simulateStructureProgram, validateStructureConfig, type StructureConfig, type StructurePhase, type StructureRecord, type StructureObject, type StructureField, STRUCT_INITIALIZATIONS, STRUCT_FIELDS } from '../domain/structures'
import { STRUCTURE_CHALLENGES, evaluateStructureChallenge, type StructureChallengeId } from '../data/structureChallenges'

const LESSON_ID = 'structures-basics' as const
const phaseLabels: Record<StructurePhase, string> = {
  prepare: '準備結構型別', 'enter-main': '進入 main', 'initialize-student': '初始化原物件', 'copy-structure': '複製成員值',
  'update-member': '修改指定成員', 'print-student': '輸出原物件', 'print-backup': '輸出副本',
  'return-main': 'main 回傳', done: '執行完成', blocked: '安全停止',
}
function readConfig(value: unknown): StructureConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_STRUCTURE_CONFIG }
  const config = value as StructureConfig
  return validateStructureConfig(config).length ? { ...DEFAULT_STRUCTURE_CONFIG } : { initialization: config.initialization, target: config.target, field: config.field }
}
function parsePrediction(value: string): number[] | null {
  const tokens = value.trim().split(/[\s,，]+/)
  return tokens.length === 2 && tokens.every(token => /^-?\d+$/.test(token) && Number.isSafeInteger(Number(token))) ? tokens.map(Number) : null
}

function StructureCard({ name, record, inScope, active, activeField, selectedField }: {
  name: StructureObject; record: Readonly<StructureRecord> | null; inScope: boolean; active: boolean; activeField: StructureField | null; selectedField: StructureField
}) {
  const visible = inScope && record !== null
  return <section className={'structure-object ' + (active && activeField === null ? 'is-active' : '')} aria-label={name + ' 結構物件'}>
    <h3>{name}<small>{name === 'student' ? '原物件' : '副本'}</small></h3><p><code>struct Student</code> · {visible ? '物件已建立' : record === null ? '尚未建立' : '已離開作用域'}</p>
    <dl className="structure-members">{(Object.keys(STRUCT_FIELDS) as StructureField[]).map(field => <div key={field} className={(field === selectedField ? 'is-selected ' : '') + (active && activeField === field ? 'is-active' : '')}>
      <dt><code>{name}.{field}</code><small>{STRUCT_FIELDS[field].type}</small></dt>
      <dd aria-label={name + '.' + field}>{!visible ? '—' : field === 'grade' ? record.grade === '\0' ? "'\\0'" : "'" + record.grade + "'" : record[field]}</dd>
      {visible && field === 'grade' && <small>ASCII {record.grade.charCodeAt(0)}</small>}
    </div>)}</dl>
  </section>
}

export function StructureLessonPage() {
  const { progress, getLessonProgress, visitLesson, rememberLessonState, markGuidedRunCompleted, markChallengeCompleted } = useLearningProgress()
  const lesson = getLessonProgress(LESSON_ID)
  const [config, setConfig] = useState(() => readConfig(lesson.savedState))
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [unlocked, setUnlocked] = useState(lesson.guidedRunCompleted)
  const [prediction, setPrediction] = useState('')
  const [submitted, setSubmitted] = useState<number[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<StructureChallengeId>(STRUCTURE_CHALLENGES[0].id)
  const [answers, setAnswers] = useState<Partial<Record<StructureChallengeId, string>>>({})
  const [feedback, setFeedback] = useState<Partial<Record<StructureChallengeId, { solved: boolean; message: string }>>>({})
  const savedKey = JSON.stringify(readConfig(progress.lessons[LESSON_ID]?.savedState))
  const hasLesson = progress.lessons[LESSON_ID] !== undefined
  const sync = useRef({ savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId })
  const resetting = useRef(false)
  const simulation = useMemo(() => simulateStructureProgram(config), [config])
  const player = useTracePlayer({ frames: simulation.frames, speed, config: JSON.stringify(config) })
  const resetPlayer = player.reset
  const frame = player.frame ?? simulation.frames[0]
  const sourceLines = simulation.source.lines.map(line => ({ lineNumber: line.lineNumber, parts: [{ id: `line-${line.lineNumber}`, text: line.code || ' ' }] }))
  const count = STRUCTURE_CHALLENGES.filter(item => lesson.completedChallengeIds.includes(item.id)).length

  useEffect(() => { visitLesson(LESSON_ID) }, [visitLesson])
  useEffect(() => {
    const previous = sync.current
    const cleared = (previous.hasLesson && !hasLesson) || (previous.visited !== null && progress.lastVisitedLessonId === null)
    resetting.current = previous.savedKey !== savedKey || cleared || (previous.guided && !lesson.guidedRunCompleted)
    sync.current = { savedKey, hasLesson, guided: lesson.guidedRunCompleted, visited: progress.lastVisitedLessonId }
    if (resetting.current) {
      setConfig(readConfig(JSON.parse(savedKey))); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
      resetPlayer()
      if (cleared) { setAnswers({}); setFeedback({}); setActiveId(STRUCTURE_CHALLENGES[0].id) }
    } else if (previous.guided !== lesson.guidedRunCompleted) setUnlocked(lesson.guidedRunCompleted)
  }, [savedKey, hasLesson, lesson.guidedRunCompleted, progress.lastVisitedLessonId, resetPlayer])
  useEffect(() => {
    if (unlocked && player.atEnd && frame.phase === 'done' && progress.lastVisitedLessonId !== null && !resetting.current) markGuidedRunCompleted(LESSON_ID)
  }, [unlocked, player.atEnd, frame.phase, progress.lastVisitedLessonId, markGuidedRunCompleted])
  const changeConfig = (next: StructureConfig) => {
    if (validateStructureConfig(next).length) return
    setConfig(next); setPrediction(''); setSubmitted(null); setError(''); setUnlocked(lesson.guidedRunCompleted)
    sync.current.savedKey = JSON.stringify(next); rememberLessonState(LESSON_ID, next)
  }
  const predict = (event: FormEvent) => {
    event.preventDefault()
    const value = parsePrediction(prediction)
    if (value === null) { setError('請輸入原物件與副本的兩個整數值。'); return }
    setSubmitted(value); setError(''); setUnlocked(true); player.reset()
    visitLesson(LESSON_ID)
  }
  const controls = <div className="pointers-controls structure-controls"><h2>選擇初始化與修改對象</h2>
    <label htmlFor="structure-initialization">初始化方式</label><select id="structure-initialization" value={config.initialization} onChange={event => changeConfig({ ...config, initialization: event.target.value as StructureConfig['initialization'] })}>{Object.entries(STRUCT_INITIALIZATIONS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <label htmlFor="structure-target">要修改的物件</label><select id="structure-target" value={config.target} onChange={event => changeConfig({ ...config, target: event.target.value as StructureConfig['target'] })}><option value="student">student：原物件</option><option value="backup">backup：副本</option></select>
    <label htmlFor="structure-field">要修改的成員</label><select id="structure-field" value={config.field} onChange={event => changeConfig({ ...config, field: event.target.value as StructureConfig['field'] })}>{Object.entries(STRUCT_FIELDS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>
    <button className="functions-restore-button" onClick={() => changeConfig({ ...DEFAULT_STRUCTURE_CONFIG })}>恢復預設值</button>
    <p>先建立 student，再用它初始化另一份 backup，最後只改指定物件的一個成員。</p>
  </div>
  return <div className="structure-page pointers-page functions-page lab-page">
    <section className="pointers-hero functions-hero lab-hero"><div className="page-width">
      <nav className="breadcrumbs" aria-label="麵包屑"><Link to="/">首頁</Link><span>／</span><Link to="/learn">課程地圖</Link><span>／ 結構與成員存取</span></nav>
      <div className="functions-hero__layout"><div><span className="section-kicker">MODULE 07 · LESSON 01</span><h1>把相關資料，<br />放進同一份結構。</h1><p>用 struct Student 組合編號、分數與等第。逐步觀察成員初始化、整份結構複製，以及兩份物件各自的修改結果。</p></div><aside className="lesson-status-card" aria-label="本單元學習進度"><strong>{count}<small>/3</small></strong><p>{count === 3 ? '單元完成' : '通過三項挑戰完成單元'}</p></aside></div>
    </div></section>
    <section className="pointers-recap page-width"><h2>型別描述成員，物件保存資料。</h2><p>struct Student 定義 id、score、grade 的名稱與型別；student 與 backup 才是保存值的物件。用點運算子讀寫成員，例如 student.score。一般位置式初始化依宣告順序填值，指定成員初始化則依成員名稱對應。</p><p>用 student 初始化 backup，會複製成員的值，不是讓兩個名稱成為同一個物件。本課成員只有整數與字元，不含指標。</p></section>
    <section className="functions-prediction-section"><div className="page-width functions-prediction-card"><div><span className="section-kicker">PREDICT BEFORE RUN</span><h2>兩份物件，哪一份的成員改變？</h2><p>目前修改 {config.target}.{config.field}，預測最後 student.{config.field} 與 backup.{config.field} 的值，依序填入。</p>{config.field === 'grade' && <p>grade 以 ASCII 字元碼回答：A 是 65、B 是 66、空字元是 0。</p>}</div>
      <form className="functions-prediction-form" onSubmit={predict}><label htmlFor="structure-prediction">預測原物件、副本的成員值</label><div><input id="structure-prediction" value={prediction} onChange={event => setPrediction(event.target.value)} placeholder="兩個整數，以空白或逗號分隔" /><button className="button button-primary" type="submit">提交預測</button></div>{error && <p role="alert">{error}</p>}</form>
      {submitted !== null && <p role="status">{frame.printedValues === null ? '預測已記錄，兩份物件都輸出後揭曉。' : `你預測 ${submitted.join('、')}，實際 ${frame.printedValues.join('、')}。${submitted.every((value, index) => value === frame.printedValues![index]) ? '預測正確！' : '檢查複製發生的時機，以及修改的是哪一份物件。'}`}</p>}
    </div></section>
    <section className="functions-lab-section"><div className="page-width"><h2>複製成員值，保留兩份獨立物件。</h2>
      <LabShell className="functions-lab-shell pointers-lab-shell" controls={controls} controlsLabel="結構成員控制"
        playback={unlocked ? <PlaybackControls controlName="結構成員執行" playing={player.playing} atStart={player.atStart} atEnd={player.atEnd} speed={speed} onPlay={player.play} onPause={player.pause} onNext={player.next} onReset={player.reset} onReplay={player.replay} onSpeedChange={setSpeed} /> : <p role="status">提交上方預測後解鎖播放與單步控制。</p>}
        footer={<div className="functions-trace-footer"><strong>STEP {player.frameIndex + 1} / {simulation.frames.length}</strong><p>{frame.explanation}</p>{frame.phase === 'blocked' && <p role="alert">{simulation.message}</p>}</div>}>
        <SourceCodePanel lines={sourceLines} activeLine={frame.activeLine} activePart={frame.activePart} status={phaseLabels[frame.phase]} />
        <section className="structure-execution lab-panel" aria-label="結構物件與成員值">
          <StructureCard name="student" record={frame.student} inScope={frame.mainInScope} active={frame.activeObject === 'student'} activeField={frame.activeField} selectedField={config.field} />
          <StructureCard name="backup" record={frame.backup} inScope={frame.mainInScope} active={frame.activeObject === 'backup'} activeField={frame.activeField} selectedField={config.field} />
          <p>圖示依成員分組，不代表實際的位元組間隔。外框標記這一步正在處理的物件或成員。</p>
          <div className="structure-console"><h3>printf 輸出</h3><ol aria-label="結構成員輸出">{frame.output.map((value, index) => <li key={index}><code>{value}</code></li>)}</ol>{!frame.output.length && <p>尚無輸出</p>}</div>
        </section>
      </LabShell><p className="sr-only" aria-live="polite" aria-atomic="true">{unlocked ? frame.explanation : ''}</p>
    </div></section>
    <section className="pointers-challenges page-width"><h2>三個挑戰，分清型別、成員與副本。</h2>
      <ChallengePanel challenges={STRUCTURE_CHALLENGES.map(item => ({ id: item.id, label: item.title, completed: lesson.completedChallengeIds.includes(item.id) }))} activeId={activeId} onSelect={setActiveId} label="結構成員學習挑戰">{item => <div className="pointers-challenge-content"><h3>{item.label}</h3><p>{STRUCTURE_CHALLENGES.find(challenge => challenge.id === item.id)?.question}</p>
        <form onSubmit={event => { event.preventDefault(); const result = evaluateStructureChallenge(item.id, answers[item.id] ?? ''); setFeedback(current => ({ ...current, [item.id]: result })); if (result.solved) markChallengeCompleted(LESSON_ID, item.id) }}>
          <label htmlFor={`structure-answer-${item.id}`}>你的答案（多個整數以空白或逗號分隔）</label><input id={`structure-answer-${item.id}`} value={answers[item.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [item.id]: event.target.value }))} /><button className="button button-primary" type="submit">檢查答案</button>
        </form>{feedback[item.id] && <p role="status">{feedback[item.id]?.message}</p>}
      </div>}</ChallengePanel>
    </section>
    <section className="pointers-recap page-width"><h2>相關資料放一起，各份物件仍各自保存值。</h2><p>部分初始化會讓其餘成員得到零值：本課的 score 是 0，grade 是空字元。這與完全沒有初始化的區域物件不同。用點運算子修改單一成員，也不會自動修改其他成員或另一份物件。</p>{count === 3 && <p role="status">你已完成結構與成員存取。</p>}<div><Link className="button button-secondary" to="/learn/pointers/const">上一課：指標與 const</Link><Link className="button button-primary" to="/learn/structures/arrays">下一課：結構陣列與逐筆統計</Link><Link className="button button-secondary" to="/learn">回到課程地圖</Link></div></section>
  </div>
}
