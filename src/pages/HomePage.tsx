import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Binary,
  Braces,
  Check,
  ChevronRight,
  CirclePlay,
  Gauge,
  Lightbulb,
  MousePointer2,
  Sparkles,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { COURSE_TOPICS, VARIABLE_CHALLENGE_IDS, isLessonAvailable } from '../data'
import {
  DEFAULT_VARIABLE_CONFIG,
  formatVariableNumber,
  simulateVariableProgram,
  type ArithmeticOperator,
  type VariableConfig,
} from '../domain'
import { isLessonCompleted } from '../state'
import { Reveal } from '../components/Reveal'
import { useLearningProgress } from '../hooks/useLearningProgress'

const previewOperators: readonly ArithmeticOperator[] = ['+', '-', '*', '/', '%']

const learningSteps = [
  {
    number: '01',
    title: '預測',
    body: '先猜猜算式會輸出什麼，練習像電腦一樣讀程式。',
    icon: Lightbulb,
  },
  {
    number: '02',
    title: '調整',
    body: '改變變數與運算子，親手觀察每個參數如何影響結果。',
    icon: MousePointer2,
  },
  {
    number: '03',
    title: '執行',
    body: '播放或逐步前進，看見資料從宣告、計算到輸出的過程。',
    icon: CirclePlay,
  },
  {
    number: '04',
    title: '理解',
    body: '比較預測與實際結果，建立型別、賦值與運算的直覺。',
    icon: Sparkles,
  },
]

function PreviewControl({
  id,
  label,
  value,
  displayValue = value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string
  label: string
  value: number
  displayValue?: number | string
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="preview-control" htmlFor={id}>
      <span>{label}</span>
      <strong>{displayValue}</strong>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function VariablePreview() {
  const [config, setConfig] = useState<VariableConfig>({
    ...DEFAULT_VARIABLE_CONFIG,
  })
  const simulation = useMemo(() => simulateVariableProgram(config), [config])
  const operatorIndex = previewOperators.indexOf(config.operator)

  const updateNumber = (key: 'x' | 'y', value: number) => {
    setConfig((current) => ({ ...current, [key]: value }))
  }

  return (
    <motion.div
      className="hero-demo"
      initial={{ opacity: 0, y: 24, rotate: 0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="demo-topbar">
        <div className="window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="demo-filename">variables.c</span>
        <span className="live-label"><i /> 即時預覽</span>
      </div>

      <div className="preview-code" aria-label="即時產生的 C 語言變數與運算程式碼">
        <span className="line-no">1</span>
        <code><em>int</em> main(void) {'{'}</code>
        <span className="line-no">2</span>
        <code>&nbsp;&nbsp;<em>int</em> x = <mark>{config.x}</mark>;</code>
        <span className="line-no">3</span>
        <code>&nbsp;&nbsp;<em>int</em> y = <mark>{config.y}</mark>;</code>
        <span className="line-no">4</span>
        <code>&nbsp;&nbsp;<em>int</em> result = x <mark>{config.operator}</mark> y;</code>
        <span className="line-no">5</span>
        <code>&nbsp;&nbsp;printf(<q>&quot;%d\n&quot;</q>, result);</code>
        <span className="line-no">6</span>
        <code>{'}'}</code>
      </div>

      <div className="preview-output">
        <div className="preview-output-heading">
          <span>OUTPUT</span>
          <small>{simulation.status === 'completed' ? '執行完成' : '安全阻止'}</small>
        </div>
        <div
          className="token-row"
          aria-live="polite"
          aria-label={simulation.status === 'completed'
            ? `輸出：${simulation.output.map(formatVariableNumber).join(' ')}`
            : `無法執行：${simulation.message}`}
        >
          <AnimatePresence mode="popLayout">
            {simulation.output.map((value, index) => (
              <motion.span
                className="output-token"
                key={`${value}-${index}`}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.86 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 360, damping: 27 }}
              >
                {formatVariableNumber(value)}
              </motion.span>
            ))}
          </AnimatePresence>
          {simulation.status === 'blocked' && (
            <span className="empty-output">{simulation.message}</span>
          )}
        </div>
      </div>

      <div className="preview-controls" aria-label="變數與運算參數">
        <PreviewControl
          id="preview-x"
          label="x 的值"
          value={config.x}
          min={-10}
          max={10}
          onChange={(value) => updateNumber('x', value)}
        />
        <PreviewControl
          id="preview-y"
          label="y 的值"
          value={config.y}
          min={-10}
          max={10}
          onChange={(value) => updateNumber('y', value)}
        />
        <PreviewControl
          id="preview-operator"
          label="運算子"
          value={operatorIndex}
          displayValue={config.operator}
          min={0}
          max={previewOperators.length - 1}
          onChange={(value) => setConfig((current) => ({
            ...current,
            operator: previewOperators[value],
          }))}
        />
      </div>
    </motion.div>
  )
}

export function HomePage() {
  const { progress, getLessonProgress } = useLearningProgress()
  const lessonProgress = getLessonProgress('variables-basics')
  const completedCount = VARIABLE_CHALLENGE_IDS.filter((challengeId) =>
    lessonProgress.completedChallengeIds.includes(challengeId),
  ).length
  const lessonCompleted = isLessonCompleted(progress, 'variables-basics')

  return (
    <>
      <section className="hero-section">
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />
        <div className="hero-grid page-width">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="eyebrow"><span>C PROGRAMMING LAB</span><i /></div>
            <h1><em>程式設計基礎</em><br />學習網站</h1>
            <div className="hero-author" aria-label="作者：魏志成">
              <span className="hero-author-mark" aria-hidden="true">魏</span>
              <span className="hero-author-copy">
                <small>AUTHOR</small>
                <strong>作者：魏志成</strong>
              </span>
            </div>
            <p className="hero-lead">調整參數，看見程式一步一步運行。</p>
            <p className="hero-description">
              不只背語法，而是親手改變程式、觀察結果，從每一次執行中建立真正的程式邏輯。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/learn/variables/basics">
                開始探索變數 <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="text-link" to="/learn">
                查看課程地圖 <ChevronRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="hero-proof" aria-label="網站特色">
              <span><Check size={15} aria-hidden="true" /> 免登入</span>
              <span><Check size={15} aria-hidden="true" /> 即時回饋</span>
              <span><Check size={15} aria-hidden="true" /> 適合初學者</span>
            </div>
          </motion.div>
          <VariablePreview />
        </div>
      </section>

      <section className="section learning-method">
        <div className="page-width">
          <Reveal className="section-heading split-heading">
            <div>
              <span className="section-kicker">LEARN BY DOING</span>
              <h2>讓每一步，都看得見。</h2>
            </div>
            <p>程式不是一瞬間得到答案。跟著電腦的節奏，逐步理解資料如何進入記憶體、算式如何產生結果。</p>
          </Reveal>
          <div className="method-grid">
            {learningSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <Reveal className="method-card" delay={index * 0.07} key={step.number}>
                  <div className="method-card-top">
                    <span>{step.number}</span>
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section course-highlight">
        <div className="page-width highlight-grid">
          <Reveal className="highlight-copy">
            <span className="section-kicker">FIRST LESSON</span>
            <h2>從三個記憶盒，<br />看懂程式怎麼算。</h2>
            <p>完整的變數與運算實驗室，帶你從 main 函式開始，依序看見宣告、初始化、計算、賦值與輸出。</p>
            <ul className="feature-list">
              <li><span><Binary size={18} aria-hidden="true" /></span> 程式碼與記憶盒同步高亮</li>
              <li><span><Gauge size={18} aria-hidden="true" /></span> 自由調整型別、數值與運算</li>
              <li><span><Braces size={18} aria-hidden="true" /></span> 預測、調參與找錯三種挑戰</li>
            </ul>
            <Link className="button button-dark" to="/learn/variables/basics">
              {lessonProgress.guidedRunCompleted ? '繼續變數單元' : '進入第一堂課'} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal className="lesson-poster" delay={0.1}>
            <div className="poster-stamp">MODULE 01 · LESSON 01</div>
            <div className="poster-loop" aria-hidden="true">
              <span>x = 5</span><i>+</i><span>y = 2</span><i>→</i><span>result = 7</span>
            </div>
            <div className="poster-main">
              <small>資料進入、計算，再輸出</small>
              <strong>int</strong>
              <span>變數與運算</span>
            </div>
            <div className="poster-progress">
              <div>
                <span>{lessonCompleted ? '單元已完成' : '挑戰進度'}</span>
                <strong>{completedCount} / {VARIABLE_CHALLENGE_IDS.length}</strong>
              </div>
              <div className="progress-track" aria-label={`已完成 ${completedCount} 個挑戰，共 ${VARIABLE_CHALLENGE_IDS.length} 個`}>
                <motion.span
                  initial={false}
                  animate={{ width: `${(completedCount / VARIABLE_CHALLENGE_IDS.length) * 100}%` }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section topics-preview">
        <div className="page-width">
          <Reveal className="section-heading center-heading">
            <span className="section-kicker">LEARNING PATH</span>
            <h2>一張持續成長的學習地圖</h2>
            <p>先建立變數基礎，再前往條件、迴圈、函式與陣列；已開放單元都能自由進入，不會被先備課程鎖住。</p>
          </Reveal>
          <Reveal className="topic-ribbon">
            {COURSE_TOPICS.map((topic) => {
              const available = topic.lessons.some(isLessonAvailable)
              return (
                <div className={available ? 'topic-pill available' : 'topic-pill'} key={topic.id}>
                  <span>{String(topic.order).padStart(2, '0')}</span>
                  <strong>{topic.title}</strong>
                  <small>{available ? '現在開放' : '即將推出'}</small>
                </div>
              )
            })}
          </Reveal>
          <Reveal className="center-action">
            <Link className="text-link strong" to="/learn">查看完整課程地圖 <ArrowRight size={18} aria-hidden="true" /></Link>
          </Reveal>
        </div>
      </section>

      <section className="closing-cta">
        <div className="page-width">
          <Reveal className="closing-card">
            <div className="closing-braces" aria-hidden="true">{'{ }'}</div>
            <span className="section-kicker light">READY TO EXPERIMENT?</span>
            <h2>不要只讀程式。<br />動手讓它跑起來。</h2>
            <Link className="button button-light" to="/learn/variables/basics">
              開始第一個實驗 <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
