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
import { simulateForLoop, type LoopConfig } from '../domain'
import { Reveal } from '../components/Reveal'
import { useLearningProgress } from '../hooks/useLearningProgress'

const learningSteps = [
  {
    number: '01',
    title: '調整',
    body: '改變初始值、條件與步進值，親手建立不同的迴圈。',
    icon: MousePointer2,
  },
  {
    number: '02',
    title: '預測',
    body: '先想一想輸出會是什麼，訓練閱讀程式的直覺。',
    icon: Lightbulb,
  },
  {
    number: '03',
    title: '執行',
    body: '播放或逐步前進，看見每一行程式真正做了什麼。',
    icon: CirclePlay,
  },
  {
    number: '04',
    title: '理解',
    body: '把條件、變數與輸出串起來，找到程式運作的規律。',
    icon: Sparkles,
  },
]

function PreviewControl({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="preview-control" htmlFor={id}>
      <span>{label}</span>
      <strong>{value}</strong>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function LoopPreview() {
  const [config, setConfig] = useState<LoopConfig>({
    start: 0,
    end: 5,
    comparator: '<',
    step: 1,
  })
  const simulation = useMemo(() => simulateForLoop(config), [config])
  const update = (key: 'start' | 'end' | 'step', value: number) => {
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
        <span className="demo-filename">first-loop.c</span>
        <span className="live-label"><i /> 即時預覽</span>
      </div>

      <div className="preview-code" aria-label="即時產生的 C 語言 for 迴圈程式碼">
        <span className="line-no">1</span>
        <code><b>for</b> (<em>int</em> i = <mark>{config.start}</mark>; i &lt; <mark>{config.end}</mark>; i += <mark>{config.step}</mark>) {'{'}</code>
        <span className="line-no">2</span>
        <code>&nbsp;&nbsp;printf(<q>&quot;%d &quot;</q>, i);</code>
        <span className="line-no">3</span>
        <code>{'}'}</code>
      </div>

      <div className="preview-output">
        <div className="preview-output-heading">
          <span>OUTPUT</span>
          <small>{simulation.output.length} 次迭代</small>
        </div>
        <div className="token-row" aria-live="polite" aria-label={`輸出：${simulation.output.join(' ') || '沒有輸出'}`}>
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
                {value}
              </motion.span>
            ))}
          </AnimatePresence>
          {simulation.output.length === 0 && <span className="empty-output">條件一開始就是 false</span>}
        </div>
      </div>

      <div className="preview-controls" aria-label="迴圈參數">
        <PreviewControl id="preview-start" label="從哪裡開始？" value={config.start} min={0} max={5} onChange={(value) => update('start', value)} />
        <PreviewControl id="preview-end" label="小於多少？" value={config.end} min={1} max={12} onChange={(value) => update('end', value)} />
        <PreviewControl id="preview-step" label="每次增加？" value={config.step} min={1} max={3} onChange={(value) => update('step', value)} />
      </div>
    </motion.div>
  )
}

export function HomePage() {
  const { progress } = useLearningProgress()
  const completedCount = progress.completedChallengeIds.length

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
            <p className="hero-author">作者：魏志成</p>
            <p className="hero-lead">調整參數，看見程式一步一步運行。</p>
            <p className="hero-description">
              不只背語法，而是親手改變程式、觀察結果，從每一次執行中建立真正的程式邏輯。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/learn/loops/for">
                開始探索迴圈 <ArrowRight size={18} aria-hidden="true" />
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
          <LoopPreview />
        </div>
      </section>

      <section className="section learning-method">
        <div className="page-width">
          <Reveal className="section-heading split-heading">
            <div>
              <span className="section-kicker">LEARN BY DOING</span>
              <h2>讓每一步，都看得見。</h2>
            </div>
            <p>程式不是一瞬間得到答案。跟著電腦的節奏，逐步理解變數如何改變、條件如何決定下一步。</p>
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
            <span className="section-kicker">FEATURED LAB</span>
            <h2>從一個迴圈，<br />看懂程式的節奏。</h2>
            <p>完整的 for 迴圈實驗室，把一行看似複雜的語法拆成初始化、條件判斷、執行與更新四個清楚步驟。</p>
            <ul className="feature-list">
              <li><span><Binary size={18} /></span> 程式碼逐行高亮</li>
              <li><span><Gauge size={18} /></span> 自由控制播放速度</li>
              <li><span><Braces size={18} /></span> 三個即時檢查挑戰</li>
            </ul>
            <Link className="button button-dark" to="/learn/loops/for">
              {completedCount > 0 ? '繼續學習' : '進入實驗室'} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal className="lesson-poster" delay={0.1}>
            <div className="poster-stamp">LESSON 03</div>
            <div className="poster-loop" aria-hidden="true">
              <span>i = 0</span><i>→</i><span>i &lt; 5</span><i>→</i><span>i++</span>
            </div>
            <div className="poster-main">
              <small>重複，直到條件不成立</small>
              <strong>for</strong>
              <span>迴圈</span>
            </div>
            <div className="poster-progress">
              <div>
                <span>挑戰進度</span>
                <strong>{completedCount} / 3</strong>
              </div>
              <div className="progress-track" aria-label={`已完成 ${completedCount} 個挑戰，共 3 個`}>
                <motion.span initial={false} animate={{ width: `${(completedCount / 3) * 100}%` }} />
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
            <p>變數與運算、條件判斷和迴圈已經開放，從基礎語法一步步建立程式邏輯。</p>
          </Reveal>
          <Reveal className="topic-ribbon">
            {['變數與運算', '條件判斷', '迴圈', '函式', '陣列與字串', '指標'].map((topic, index) => (
              <div className={index < 3 ? 'topic-pill available' : 'topic-pill'} key={topic}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{topic}</strong>
                <small>{index < 3 ? '現在開放' : '即將推出'}</small>
              </div>
            ))}
          </Reveal>
          <Reveal className="center-action">
            <Link className="text-link strong" to="/learn">查看完整課程地圖 <ArrowRight size={18} /></Link>
          </Reveal>
        </div>
      </section>

      <section className="closing-cta">
        <div className="page-width">
          <Reveal className="closing-card">
            <div className="closing-braces" aria-hidden="true">{'{ }'}</div>
            <span className="section-kicker light">READY TO EXPERIMENT?</span>
            <h2>不要只讀程式。<br />動手讓它跑起來。</h2>
            <Link className="button button-light" to="/learn/variables">
              開始第一個實驗 <ArrowRight size={18} />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
