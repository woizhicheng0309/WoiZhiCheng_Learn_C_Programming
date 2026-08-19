import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Box,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Equal,
  Terminal,
  Trophy,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { FoundationRangeControl } from '../components/FoundationControls'
import { LessonQuiz, type LessonQuizQuestion } from '../components/LessonQuiz'
import {
  ARITHMETIC_OPERATORS,
  evaluateIntegerExpression,
  type ArithmeticOperator,
} from '../domain'
import { useLearningProgress } from '../hooks/useLearningProgress'

const operatorLabels: Record<ArithmeticOperator, string> = {
  '+': '加',
  '-': '減',
  '*': '乘',
  '/': '除',
  '%': '餘數',
}

const variableQuiz: readonly LessonQuizQuestion[] = [
  {
    id: 'variable-name',
    prompt: '在這行程式裡，哪一個是變數名稱？',
    code: 'int score = 80;',
    options: ['int', 'score', '80'],
    correctIndex: 1,
    explanation: 'int 是資料型別，score 是變數名稱，80 是存入的值。',
  },
  {
    id: 'integer-division',
    prompt: '兩邊都是 int 時，result 會得到多少？',
    code: 'int result = 7 / 2;',
    options: ['3', '3.5', '4'],
    correctIndex: 0,
    explanation: 'C 的整數除法會捨去小數部分，所以 7 / 2 得到 3。',
  },
  {
    id: 'remainder',
    prompt: '取餘數運算的結果是多少？',
    code: 'int remainder = 17 % 5;',
    options: ['2', '3', '12'],
    correctIndex: 0,
    explanation: '17 可以拆成 5 × 3 + 2，因此餘數是 2。',
  },
]

export function VariablesLessonPage() {
  const { progress, markLessonCompleted } = useLearningProgress()
  const completed = progress.completedLessonIds.includes('variables')
  const [leftValue, setLeftValue] = useState(8)
  const [rightValue, setRightValue] = useState(3)
  const [operator, setOperator] = useState<ArithmeticOperator>('+')
  const evaluation = useMemo(
    () => evaluateIntegerExpression(leftValue, rightValue, operator),
    [leftValue, operator, rightValue],
  )

  return (
    <div className="foundation-page variables-page">
      <section className="lab-hero foundation-hero">
        <div className="page-width">
          <div className="breadcrumbs">
            <Link to="/">首頁</Link><ChevronRight size={14} />
            <Link to="/learn">課程地圖</Link><ChevronRight size={14} />
            <span>變數與運算</span>
          </div>
          <div className="lab-title-row">
            <motion.div
              className="lab-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link className="back-link" to="/learn"><ArrowLeft size={16} /> 回到課程地圖</Link>
              <span className="section-kicker">LESSON 01 · VARIABLES &amp; OPERATORS</span>
              <h1>把資料放進變數，<br />讓運算<em>有名字</em>。</h1>
              <p>從資料型別、宣告與賦值開始，再觀察算術運算子如何產生新結果。</p>
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
              <p>{completed ? '你已通過三題理解檢查。' : '變數、賦值、運算子'}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="foundation-concepts-section">
        <div className="page-width">
          <div className="foundation-section-heading">
            <span className="section-kicker">BUILD THE MENTAL MODEL</span>
            <h2>一行宣告，其實做了三件事。</h2>
            <p>先決定要存哪種資料，給它一個名字，最後把值放進去。</p>
          </div>
          <div className="foundation-concept-grid">
            <article className="foundation-concept-card">
              <span className="concept-icon"><CircleDot size={20} /></span>
              <small>01 · TYPE</small>
              <h3>資料型別</h3>
              <p>型別告訴 C 要預留什麼樣的空間，也決定可以進行哪些運算。</p>
              <div className="concept-code-list"><code>int count;</code><code>double price;</code><code>char grade;</code></div>
            </article>
            <article className="foundation-concept-card">
              <span className="concept-icon"><Box size={20} /></span>
              <small>02 · ASSIGNMENT</small>
              <h3>宣告與賦值</h3>
              <p><code>=</code> 不是「兩邊相等」，而是先算右邊，再將結果存入左邊的變數。</p>
              <div className="assignment-diagram"><span><code>score</code><small>目的地</small></span><Equal size={18} /><span><code>60 + 20</code><small>先計算</small></span></div>
            </article>
            <article className="foundation-concept-card">
              <span className="concept-icon"><Calculator size={20} /></span>
              <small>03 · OPERATORS</small>
              <h3>算術運算子</h3>
              <p>加減乘除之外，<code>%</code> 可以取餘數。當兩邊都是 <code>int</code>，除法也只會保留整數部分。</p>
              <div className="operator-cheatsheet"><span><b>+</b>加</span><span><b>-</b>減</span><span><b>*</b>乘</span><span><b>/</b>除</span><span><b>%</b>餘數</span></div>
            </article>
          </div>
        </div>
      </section>

      <section className="foundation-workbench-section" aria-labelledby="variables-workbench-title">
        <div className="page-width">
          <div className="workbench-heading">
            <div><span className="section-kicker">TRY IT YOURSELF</span><h2 id="variables-workbench-title">整數運算實驗台</h2></div>
            <p>調整 a、b 與運算子，觀察右邊先被計算，結果再放入 result。</p>
          </div>
          <div className="foundation-workbench">
            <aside className="foundation-controls" aria-label="整數運算參數">
              <div className="foundation-controls-title"><Calculator size={18} /><div><small>CONTROL PANEL</small><h3>調整運算</h3></div></div>
              <FoundationRangeControl id="variable-a" label="變數 a" description="左邊的整數" value={leftValue} min={-10} max={20} onChange={setLeftValue} />
              <FoundationRangeControl id="variable-b" label="變數 b" description="右邊的整數" value={rightValue} min={-10} max={20} onChange={setRightValue} />
              <div className="foundation-control operator-control">
                <div className="foundation-control-heading"><span><b>運算子</b><small>選擇要做的運算</small></span></div>
                <div className="operator-button-grid" aria-label="算術運算子">
                  {ARITHMETIC_OPERATORS.map((item) => (
                    <button
                      type="button"
                      aria-pressed={operator === item}
                      className={operator === item ? 'active' : ''}
                      key={item}
                      onClick={() => setOperator(item)}
                    >
                      <strong>{item}</strong><small>{operatorLabels[item]}</small>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="foundation-stage">
              <div className="foundation-code-window">
                <div className="foundation-code-title"><Terminal size={15} /><span>variables.c</span><small>INT EXPRESSION</small></div>
                <pre aria-label="即時產生的整數運算 C 程式碼"><code>{`int a = ${leftValue};\nint b = ${rightValue};\nint result = a ${operator} b;\nprintf("%d", result);`}</code></pre>
              </div>

              <div className="memory-heading"><span>記憶體中的變數</span><small>值會隨著上方運算即時更新</small></div>
              <div className="memory-grid" aria-label="變數目前的值">
                <div><small>int</small><strong>a</strong><b>{leftValue}</b></div>
                <div><small>int</small><strong>b</strong><b>{rightValue}</b></div>
                <div className={evaluation.status === 'blocked' ? 'result blocked' : 'result'}><small>int</small><strong>result</strong><b>{evaluation.result ?? '—'}</b></div>
              </div>

              <motion.div
                className={evaluation.status === 'blocked' ? 'expression-result blocked' : 'expression-result'}
                key={`${evaluation.expression}-${evaluation.status}`}
                initial={{ opacity: 0.75, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                role="status"
              >
                <span>{evaluation.status === 'ok' ? <CheckCircle2 size={19} /> : <CircleDot size={19} />}</span>
                <div><small>計算過程</small><strong>{evaluation.expression} {evaluation.status === 'ok' ? `= ${evaluation.result}` : '無法計算'}</strong><p>{evaluation.explanation}</p></div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <LessonQuiz
        title="你看懂變數與運算了嗎？"
        description="三題都答對後，這個單元會自動記錄為完成。"
        questions={variableQuiz}
        completed={completed}
        onComplete={() => markLessonCompleted('variables')}
      />

      <section className="foundation-next-section">
        <div className="page-width foundation-next-card">
          <div><small>NEXT LESSON · 02</small><h2>當變數有了值，程式就能開始做選擇。</h2><p>下一單元將比較結果組合成 true 或 false，再交給 if/else 決定執行路線。</p></div>
          <Link className="button button-light" to="/learn/conditionals">繼續條件判斷 <ArrowRight size={18} /></Link>
        </div>
      </section>
    </div>
  )
}
