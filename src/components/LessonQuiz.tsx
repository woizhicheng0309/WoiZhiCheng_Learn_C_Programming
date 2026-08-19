import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, Circle, Sparkles, Trophy } from 'lucide-react'
import { motion } from 'motion/react'

export interface LessonQuizQuestion {
  id: string
  prompt: string
  code?: string
  options: readonly string[]
  correctIndex: number
  explanation: string
}

export function LessonQuiz({
  title,
  description,
  questions,
  completed,
  onComplete,
}: {
  title: string
  description: string
  questions: readonly LessonQuizQuestion[]
  completed: boolean
  onComplete: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const correctCount = useMemo(
    () => questions.filter((question) => answers[question.id] === question.correctIndex).length,
    [answers, questions],
  )
  const allCorrect = correctCount === questions.length
  const displayCount = completed ? questions.length : correctCount

  useEffect(() => {
    if (allCorrect && !completed) onComplete()
  }, [allCorrect, completed, onComplete])

  return (
    <section className="lesson-quiz-section" aria-labelledby="lesson-quiz-title">
      <div className="page-width">
        <div className="lesson-quiz-heading">
          <div>
            <span className="section-kicker"><Sparkles size={14} /> CHECK YOUR UNDERSTANDING</span>
            <h2 id="lesson-quiz-title">{title}</h2>
            <p>{description}</p>
          </div>
          <div className={completed || allCorrect ? 'quiz-score complete' : 'quiz-score'}>
            {completed || allCorrect ? <Trophy size={20} /> : <CheckCircle2 size={20} />}
            <strong>{displayCount}<small>/{questions.length}</small></strong>
            <span>{completed || allCorrect ? '單元完成' : '目前答對'}</span>
          </div>
        </div>

        <div className="lesson-question-list">
          {questions.map((question, questionIndex) => {
            const selectedIndex = answers[question.id]
            const answered = selectedIndex !== undefined
            const correct = selectedIndex === question.correctIndex

            return (
              <fieldset className={correct ? 'lesson-question correct' : 'lesson-question'} key={question.id}>
                <legend>
                  <span>{String(questionIndex + 1).padStart(2, '0')}</span>
                  <strong>{question.prompt}</strong>
                </legend>
                {question.code && <pre><code>{question.code}</code></pre>}
                <div className="quiz-options" role="radiogroup" aria-label={question.prompt}>
                  {question.options.map((option, optionIndex) => {
                    const selected = selectedIndex === optionIndex
                    const optionCorrect = answered && optionIndex === question.correctIndex
                    const optionWrong = selected && !correct
                    const className = optionCorrect
                      ? 'quiz-option correct'
                      : optionWrong ? 'quiz-option wrong' : selected ? 'quiz-option selected' : 'quiz-option'

                    return (
                      <label className={className} key={option}>
                        <input
                          type="radio"
                          name={`quiz-${question.id}`}
                          value={optionIndex}
                          checked={selected}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                        />
                        <span>{selected || optionCorrect ? <Check size={15} /> : <Circle size={13} />}</span>
                        <span>{option}</span>
                      </label>
                    )
                  })}
                </div>
                {answered && (
                  <motion.p
                    className={correct ? 'quiz-explanation correct' : 'quiz-explanation wrong'}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    aria-live="polite"
                  >
                    <strong>{correct ? '答對了。' : '再想一次。'}</strong> {question.explanation}
                  </motion.p>
                )}
              </fieldset>
            )
          })}
        </div>
      </div>
    </section>
  )
}
