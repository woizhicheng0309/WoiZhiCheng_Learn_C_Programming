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
import {
  COURSE_TOPICS,
  LESSONS,
  getLessonById,
  isLessonAvailable,
  type LessonDefinition,
  type LessonProgressStatus,
  type TopicDefinition,
  type TopicId,
} from '../data'
import {
  getContinueLearningLesson,
  getContinueLearningPath,
  getCourseProgress,
  getLessonProgressStatus,
} from '../state'
import { Reveal } from '../components/Reveal'
import { useLearningProgress } from '../hooks/useLearningProgress'

const topicIcons: Record<TopicId, LucideIcon> = {
  variables: CircleDot,
  conditionals: GitBranch,
  loops: RotateCcw,
  functions: SquareFunction,
  'arrays-and-strings': Layers3,
  pointers: MousePointer2,
}

const progressStatusLabels: Record<LessonProgressStatus, string> = {
  'not-started': '未開始',
  'in-progress': '進行中',
  completed: '已完成',
}

function PrerequisiteNote({ lesson }: { lesson: LessonDefinition }) {
  if (lesson.prerequisiteLessonIds.length === 0) {
    return <p>建議先備：無，適合從這裡開始</p>
  }

  const titles = lesson.prerequisiteLessonIds
    .map((lessonId) => getLessonById(lessonId)?.title)
    .filter((title): title is string => Boolean(title))

  return <p>建議先備：{titles.join('、')}</p>
}

function LessonStatus({ status }: { status: LessonProgressStatus }) {
  return (
    <span className="available-label">
      {status === 'completed'
        ? <Check size={15} aria-hidden="true" />
        : <CircleDot size={15} aria-hidden="true" />}
      {progressStatusLabels[status]}
    </span>
  )
}

function LessonCard({
  lesson,
  progressStatus,
}: {
  lesson: LessonDefinition
  progressStatus: LessonProgressStatus
}) {
  const Icon = topicIcons[lesson.topicId]
  const available = isLessonAvailable(lesson)
  const content = (
    <>
      <div className="lesson-card-head">
        <span className="lesson-number">
          MODULE {String(lesson.moduleNumber).padStart(2, '0')} · LESSON {String(lesson.lessonNumber).padStart(2, '0')}
        </span>
        <span className="lesson-icon"><Icon size={21} aria-hidden="true" /></span>
      </div>
      <div className="lesson-card-copy">
        <span className="lesson-english">{lesson.englishTitle}</span>
        <h3>{lesson.title}</h3>
        <p>{lesson.description}</p>
      </div>
      <div className="lesson-topics" aria-label="涵蓋概念">
        {lesson.concepts.map((concept) => <span key={concept}>{concept}</span>)}
      </div>
      <PrerequisiteNote lesson={lesson} />
      <div className="lesson-card-foot">
        {available ? (
          <LessonStatus status={progressStatus} />
        ) : (
          <span className="soon-label"><Clock3 size={14} aria-hidden="true" /> 即將推出</span>
        )}
        <span>{lesson.estimatedMinutes} 分鐘</span>
        {available && <ArrowRight size={19} aria-hidden="true" />}
      </div>
    </>
  )

  if (available) {
    return (
      <Link
        className="lesson-map-card available-card"
        to={lesson.path}
        aria-label={`${lesson.title}，${progressStatusLabels[progressStatus]}，預估 ${lesson.estimatedMinutes} 分鐘`}
      >
        {content}
      </Link>
    )
  }

  return <article className="lesson-map-card" aria-disabled="true">{content}</article>
}

function EmptyTopicCard({ topic }: { topic: TopicDefinition }) {
  const Icon = topicIcons[topic.id]
  return (
    <article className="lesson-map-card" aria-disabled="true">
      <div className="lesson-card-head">
        <span className="lesson-number">MODULE {String(topic.order).padStart(2, '0')}</span>
        <span className="lesson-icon"><Icon size={21} aria-hidden="true" /></span>
      </div>
      <div className="lesson-card-copy">
        <span className="lesson-english">{topic.englishTitle}</span>
        <h3>{topic.title}單元</h3>
        <p>{topic.description}</p>
      </div>
      <div className="lesson-topics"><span>內容規劃中</span></div>
      <div className="lesson-card-foot">
        <span className="soon-label"><Clock3 size={14} aria-hidden="true" /> 即將推出</span>
      </div>
    </article>
  )
}

export function LearnPage() {
  const { progress } = useLearningProgress()
  const courseProgress = getCourseProgress(progress)
  const continueLesson = getContinueLearningLesson(progress)
  const continuePath = getContinueLearningPath(progress)
  const availableLessonCount = LESSONS.filter(isLessonAvailable).length

  return (
    <div className="learn-page">
      <section className="page-hero">
        <div className="page-width">
          <motion.div
            className="breadcrumbs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Link to="/">首頁</Link><ChevronRight size={14} aria-hidden="true" /><span>課程地圖</span>
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
              <p>先從程式骨架、變數與運算開始，再前往條件與迴圈。每個已開放單元都能自由進入，先備內容是學習建議，不會把你鎖在門外。</p>
            </motion.div>

            <motion.aside
              className="map-progress-card"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              aria-label="你的學習進度"
            >
              <div className="map-progress-top">
                <span>你的學習進度</span>
                <Braces size={22} aria-hidden="true" />
              </div>
              <strong>{courseProgress.completedLessons}<small>/{courseProgress.totalLessons}</small></strong>
              <p>個開放單元已完成 · {courseProgress.completedChallenges}/{courseProgress.totalChallenges} 個挑戰</p>
              <div
                className="map-progress-track"
                role="progressbar"
                aria-label="整體挑戰進度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={courseProgress.percentage}
              >
                <motion.span initial={{ width: 0 }} animate={{ width: `${courseProgress.percentage}%` }} />
              </div>
              <Link to={continuePath}>
                {progress.lastVisitedLessonId ? '繼續上次進度' : '開始第一堂課'}
                {continueLesson ? `：${continueLesson.title}` : ''}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </motion.aside>
          </div>
        </div>
      </section>

      <section className="section roadmap-section">
        <div className="page-width">
          <Reveal className="roadmap-heading">
            <div>
              <span className="section-kicker">{COURSE_TOPICS.length} CORE TOPICS</span>
              <h2>基礎程式設計路線</h2>
            </div>
            <p><Code2 size={17} aria-hidden="true" /> 本版開放 {availableLessonCount} 個互動單元，更多內容將陸續加入。</p>
          </Reveal>

          <div className="course-topic-list">
            {COURSE_TOPICS.map((topic, topicIndex) => (
              <section
                className="course-topic-group"
                aria-labelledby={`topic-${topic.id}`}
                key={topic.id}
              >
                <Reveal className="roadmap-heading" delay={topicIndex * 0.04}>
                  <div>
                    <span className="section-kicker">TOPIC {String(topic.order).padStart(2, '0')} · {topic.englishTitle}</span>
                    <h2 id={`topic-${topic.id}`}>{topic.title}</h2>
                  </div>
                  <p>{topic.description}</p>
                </Reveal>
                <div className="lesson-map-grid">
                  {topic.lessons.length > 0 ? topic.lessons.map((lesson, lessonIndex) => (
                    <Reveal key={lesson.id} delay={lessonIndex * 0.055}>
                      <LessonCard
                        lesson={lesson}
                        progressStatus={getLessonProgressStatus(progress, lesson.id)}
                      />
                    </Reveal>
                  )) : (
                    <Reveal><EmptyTopicCard topic={topic} /></Reveal>
                  )}
                </div>
              </section>
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
          <Link className="button button-dark" to={continuePath}>
            {continueLesson ? `繼續：${continueLesson.title}` : '開始第一堂課'} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  )
}
