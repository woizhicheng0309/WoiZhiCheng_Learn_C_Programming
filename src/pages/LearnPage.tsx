import {
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  GitBranch,
  Layers3,
  MousePointer2,
  RotateCcw,
  SquareFunction,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { LESSONS, isLessonAvailable, type LessonDefinition, type LessonId } from '../data'
import { isLessonCompleted } from '../state'
import { Reveal } from '../components/Reveal'
import { useLearningProgress } from '../hooks/useLearningProgress'

const lessonIcons: Record<LessonId, LucideIcon> = {
  variables: CircleDot,
  conditionals: GitBranch,
  loops: RotateCcw,
  functions: SquareFunction,
  'arrays-and-strings': Layers3,
  pointers: MousePointer2,
}

function LessonCard({ lesson, completed }: { lesson: LessonDefinition; completed: boolean }) {
  const Icon = lessonIcons[lesson.id]
  const available = isLessonAvailable(lesson)
  const content = (
    <>
      <div className="lesson-card-head">
        <span className="lesson-number">{String(lesson.order).padStart(2, '0')}</span>
        <span className="lesson-icon"><Icon size={21} aria-hidden="true" /></span>
      </div>
      <div className="lesson-card-copy">
        <span className="lesson-english">{lesson.englishTitle}</span>
        <h2>{lesson.title}</h2>
        <p>{lesson.description}</p>
      </div>
      <div className="lesson-topics">
        {lesson.topics.map((topic) => <span key={topic}>{topic}</span>)}
      </div>
      <div className="lesson-card-foot">
        {available ? (
          <span className="available-label">
            {completed ? <><Check size={15} /> 已完成</> : <><span className="pulse-dot" /> 現在開放</>}
          </span>
        ) : (
          <span className="soon-label"><Clock3 size={14} /> 即將推出</span>
        )}
        {available && <ArrowRight size={19} aria-hidden="true" />}
      </div>
    </>
  )

  if (available) {
    return <Link className="lesson-map-card available-card" to={lesson.path}>{content}</Link>
  }

  return <article className="lesson-map-card" aria-disabled="true">{content}</article>
}

export function LearnPage() {
  const { progress } = useLearningProgress()
  const availableLessons = LESSONS.filter(isLessonAvailable)
  const completedLessonCount = availableLessons.filter((lesson) => isLessonCompleted(progress, lesson.id)).length
  const nextLesson = availableLessons.find((lesson) => !isLessonCompleted(progress, lesson.id)) ?? availableLessons[0]
  const allAvailableLessonsCompleted = completedLessonCount === availableLessons.length

  return (
    <div className="learn-page">
      <section className="page-hero">
        <div className="page-width">
          <motion.div
            className="breadcrumbs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Link to="/">首頁</Link><ChevronRight size={14} /><span>課程地圖</span>
          </motion.div>
          <div className="learn-hero-grid">
            <motion.div
              className="page-intro"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="section-kicker">COURSE MAP</span>
              <h1>從第一行程式，<br />一路建立思考方式。</h1>
              <p>每個主題都將抽象語法轉成能觀察、能改動、能反覆實驗的學習體驗。從變數與運算開始，一路串起判斷與迴圈。</p>
            </motion.div>

            <motion.aside
              className="map-progress-card"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.12 }}
            >
              <div className="map-progress-top">
                <span>你的學習進度</span>
                <Braces size={22} aria-hidden="true" />
              </div>
              <strong>{completedLessonCount}<small>/{availableLessons.length}</small></strong>
              <p>個互動單元已完成</p>
              <div className="map-progress-track">
                <motion.span initial={{ width: 0 }} animate={{ width: `${completedLessonCount / availableLessons.length * 100}%` }} />
              </div>
              <Link to={nextLesson.path}>
                {allAvailableLessonsCompleted ? '重溫第一堂課' : completedLessonCount > 0 ? `繼續：${nextLesson.title}` : '開始第一堂課'} <ArrowRight size={16} />
              </Link>
            </motion.aside>
          </div>
        </div>
      </section>

      <section className="section roadmap-section">
        <div className="page-width">
          <Reveal className="roadmap-heading">
            <div>
              <span className="section-kicker">6 CORE TOPICS</span>
              <h2>基礎程式設計路線</h2>
            </div>
            <p><Code2 size={17} /> 目前開放 3 個互動單元，更多內容將陸續加入。</p>
          </Reveal>
          <div className="lesson-map-grid">
            {LESSONS.map((lesson, index) => (
              <Reveal key={lesson.id} delay={index * 0.055}>
                <LessonCard lesson={lesson} completed={isLessonCompleted(progress, lesson.id)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="map-note-section">
        <div className="page-width map-note">
          <div className="map-note-icon"><Check size={22} aria-hidden="true" /></div>
          <div>
            <h2>進度只留在你的瀏覽器</h2>
            <p>不需要帳號，也不會上傳姓名或學習資料。完成狀態會安全地保存在這台裝置。</p>
          </div>
          <Link className="button button-dark" to={nextLesson.path}>{allAvailableLessonsCompleted ? '重溫變數與運算' : completedLessonCount > 0 ? '繼續學習' : '開始變數與運算'} <ArrowRight size={18} /></Link>
        </div>
      </section>
    </div>
  )
}
