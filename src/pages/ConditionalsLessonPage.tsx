import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronRight,
  Circle,
  GitBranch,
  ListChecks,
  Split,
  Terminal,
  ToggleLeft,
  Trophy,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { FoundationRangeControl } from '../components/FoundationControls'
import { LessonQuiz, type LessonQuizQuestion } from '../components/LessonQuiz'
import {
  ATTENDANCE_THRESHOLD,
  evaluateCourseCondition,
  LOGICAL_OPERATORS,
  SCORE_THRESHOLD,
  type LogicalOperator,
} from '../domain'
import { useLearningProgress } from '../hooks/useLearningProgress'

const conditionalQuiz: readonly LessonQuizQuestion[] = [
  {
    id: 'else-branch',
    prompt: 'if 的條件是 false，而且程式有 else 時，會執行哪裡？',
    options: ['if 區塊', 'else 區塊', '兩個都執行'],
    correctIndex: 1,
    explanation: 'if/else 每次只會選一條路；條件是 false 時選擇 else。',
  },
  {
    id: 'logical-and',
    prompt: '這個表達式會得到 true 還是 false？',
    code: '80 >= 60 && 65 >= 70',
    options: ['true', 'false'],
    correctIndex: 1,
    explanation: '左邊是 true，右邊是 false；&& 需要兩邊都是 true，結果才會是 true。',
  },
  {
    id: 'logical-or',
    prompt: '當 x 是 120 時，這個表達式的結果是？',
    code: 'x < 0 || x > 100',
    options: ['true', 'false'],
    correctIndex: 0,
    explanation: '120 > 100 成立；|| 只要有一邊是 true，整體就是 true。',
  },
]

function TruthValue({ value }: { value: boolean }) {
  return (
    <span className={value ? 'truth-value true' : 'truth-value false'}>
      {value ? <Check size={14} /> : <Circle size={12} />}{value ? 'TRUE' : 'FALSE'}
    </span>
  )
}

export function ConditionalsLessonPage() {
  const { progress, markLessonCompleted } = useLearningProgress()
  const completed = progress.completedLessonIds.includes('conditionals')
  const [score, setScore] = useState(72)
  const [attendance, setAttendance] = useState(80)
  const [logicalOperator, setLogicalOperator] = useState<LogicalOperator>('&&')
  const evaluation = useMemo(
    () => evaluateCourseCondition(score, attendance, logicalOperator),
    [attendance, logicalOperator, score],
  )

  return (
    <div className="foundation-page conditionals-page">
      <section className="lab-hero foundation-hero">
        <div className="page-width">
          <div className="breadcrumbs">
            <Link to="/">首頁</Link><ChevronRight size={14} />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} />
            <span>條件判斷</span>
          </div>
          <div className="lab-title-row">
            <motion.div
              className="lab-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link className="back-link" to="/learn"><ArrowLeft size={16} /> 回到課程地圖</Link>
              <span className="section-kicker">LESSON 02 · CONDITIONALS</span>
              <h1>把問題變成真假，<br />讓程式<em>選一條路</em>。</h1>
              <p>先用比較運算子得到 true 或 false，再用 if、else 與邏輯運算子描述程式的決策規則。</p>
            </motion.div>
            <motion.div
              className={completed ? 'lesson-status-card complete' : 'lesson-status-card'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div>
                {completed ? <Trophy size={21} /> : <BookOpenCheck size={21} />}
                <span>{completed ? '單元完成' : '本節重點'}</span>
              </div>
              <strong>3<small>個概念</small></strong>
              <p>{completed ? '你已通過三題理解檢查。' : '比較、分支、邏輯運算'}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="foundation-concepts-section">
        <div className="page-width">
          <div className="foundation-section-heading">
            <span className="section-kicker">FROM BOOLEAN TO BRANCH</span>
            <h2>程式不是在猜，而是照著真假選路。</h2>
            <p>每個比較都會有明確結果，分支只負責依照結果執行對應的程式碼。</p>
          </div>
          <div className="foundation-concept-grid">
            <article className="foundation-concept-card">
              <span className="concept-icon"><ListChecks size={20} /></span>
              <small>01 · COMPARISON</small>
              <h3>比較產生真假</h3>
              <p><code>==</code>、<code>!=</code>、<code>&lt;</code>、<code>&gt;</code>、<code>&lt;=</code>、<code>&gt;=</code> 會將兩個值拿來比較，結果只有 true 或 false。</p>
              <div className="comparison-reminder"><code>=</code><span>把值存進變數</span><code>==</code><span>比較兩邊是否相等</span></div>
            </article>
            <article className="foundation-concept-card">
              <span className="concept-icon"><Split size={20} /></span>
              <small>02 · BRANCH</small>
              <h3>if / else 選擇分支</h3>
              <p><code>if</code> 內的條件為 true 就執行第一區塊；否則跳到 <code>else</code>。同一次判斷只會執行其中一條路。</p>
              <div className="mini-branch"><span><b>TRUE</b><small>if 區塊</small></span><GitBranch size={20} /><span><b>FALSE</b><small>else 區塊</small></span></div>
            </article>
            <article className="foundation-concept-card">
              <span className="concept-icon"><ToggleLeft size={20} /></span>
              <small>03 · LOGIC</small>
              <h3>組合多個條件</h3>
              <p><code>&amp;&amp;</code> 要求兩邊都成立，<code>||</code> 只要一邊成立，<code>!</code> 則會將 true 與 false 對調。</p>
              <div className="logic-cheatsheet"><span><b>&amp;&amp;</b>而且</span><span><b>||</b>或者</span><span><b>!</b>不是</span></div>
            </article>
          </div>
        </div>
      </section>

      <section className="foundation-workbench-section" aria-labelledby="conditionals-workbench-title">
        <div className="page-width">
          <div className="workbench-heading">
            <div><span className="section-kicker">FOLLOW THE DECISION</span><h2 id="conditionals-workbench-title">if / else 分支實驗台</h2></div>
            <p>調整分數、出席率和邏輯運算子，每一步看見條件如何組合並選中分支。</p>
          </div>
          <div className="foundation-workbench conditional-workbench">
            <aside className="foundation-controls" aria-label="條件判斷參數">
              <div className="foundation-controls-title"><GitBranch size={18} /><div><small>CONTROL PANEL</small><h3>調整條件</h3></div></div>
              <FoundationRangeControl id="score" label="分數 score" description={`通過標準 ${SCORE_THRESHOLD} 分`} value={score} min={0} max={100} onChange={setScore} />
              <FoundationRangeControl id="attendance" label="出席率 attendance" description={`通過標準 ${ATTENDANCE_THRESHOLD}%`} value={attendance} min={0} max={100} onChange={setAttendance} />
              <div className="foundation-control operator-control">
                <div className="foundation-control-heading"><span><b>邏輯運算子</b><small>如何組合兩個比較</small></span></div>
                <div className="logic-button-grid" aria-label="邏輯運算子">
                  {LOGICAL_OPERATORS.map((item) => (
                    <button
                      type="button"
                      aria-pressed={logicalOperator === item}
                      className={logicalOperator === item ? 'active' : ''}
                      key={item}
                      onClick={() => setLogicalOperator(item)}
                    >
                      <strong>{item}</strong><span>{item === '&&' ? '兩個都要' : '一個就好'}</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="foundation-stage conditional-stage">
              <div className="foundation-code-window">
                <div className="foundation-code-title"><Terminal size={15} /><span>condition.c</span><small>LIVE BRANCH</small></div>
                <pre aria-label="即時產生的條件判斷 C 程式碼"><code>{`int score = ${score};\nint attendance = ${attendance};\n\nif (score >= ${SCORE_THRESHOLD} ${logicalOperator} attendance >= ${ATTENDANCE_THRESHOLD}) {\n  printf("通過");\n} else {\n  printf("再練習");\n}`}</code></pre>
              </div>

              <div className="decision-flow" aria-label="條件計算過程">
                <div className="decision-step">
                  <small>COMPARISON A</small><code>{score} &gt;= {SCORE_THRESHOLD}</code><TruthValue value={evaluation.scorePasses} />
                </div>
                <span className="decision-connector">{logicalOperator}</span>
                <div className="decision-step">
                  <small>COMPARISON B</small><code>{attendance} &gt;= {ATTENDANCE_THRESHOLD}</code><TruthValue value={evaluation.attendancePasses} />
                </div>
                <span className="decision-arrow"><ArrowRight size={18} /></span>
                <div className="decision-step result">
                  <small>FINAL CONDITION</small><code>{evaluation.result ? 'true' : 'false'}</code><TruthValue value={evaluation.result} />
                </div>
              </div>

              <div className="branch-preview">
                <motion.div className={evaluation.selectedBranch === 'if' ? 'branch-card active' : 'branch-card'} animate={{ opacity: evaluation.selectedBranch === 'if' ? 1 : 0.48 }}>
                  <span><b>IF</b><TruthValue value /></span><code>printf(&quot;通過&quot;);</code><small>{evaluation.selectedBranch === 'if' ? '← 這次執行這裡' : '這次跳過'}</small>
                </motion.div>
                <motion.div className={evaluation.selectedBranch === 'else' ? 'branch-card active' : 'branch-card'} animate={{ opacity: evaluation.selectedBranch === 'else' ? 1 : 0.48 }}>
                  <span><b>ELSE</b><TruthValue value={false} /></span><code>printf(&quot;再練習&quot;);</code><small>{evaluation.selectedBranch === 'else' ? '← 這次執行這裡' : '這次跳過'}</small>
                </motion.div>
              </div>

              <motion.div className="condition-output" key={`${evaluation.expression}-${evaluation.result}`} initial={{ opacity: 0.75, y: 5 }} animate={{ opacity: 1, y: 0 }} role="status">
                <span><Terminal size={18} /></span>
                <div><small>PRINTF OUTPUT</small><strong>{evaluation.output}</strong><p>{evaluation.explanation}</p></div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <LessonQuiz
        title="你能跟上程式的決策嗎？"
        description="三題都答對後，這個單元會自動記錄為完成。"
        questions={conditionalQuiz}
        completed={completed}
        onComplete={() => markLessonCompleted('conditionals')}
      />

      <section className="foundation-next-section">
        <div className="page-width foundation-next-card">
          <div><small>NEXT LESSON · 03</small><h2>已經會判斷要不要執行，下一步就是讓它重複發生。</h2><p>進入 for 迴圈實驗室，將變數、運算與條件判斷組合成完整的執行流程。</p></div>
          <Link className="button button-light" to="/learn/loops/for">進入 for 迴圈 <ArrowRight size={18} /></Link>
        </div>
      </section>
    </div>
  )
}
