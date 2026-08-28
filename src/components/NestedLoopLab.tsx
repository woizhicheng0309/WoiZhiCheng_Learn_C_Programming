import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Braces,
  Check,
  Circle,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { PlaybackControls } from './lab'
import {
  MULTIPLICATION_TABLE_LIMITS,
  simulateNestedMultiplicationTable,
} from '../domain/nestedLoopSimulator'
import {
  useTracePlayer,
  type PlaybackSpeed,
} from '../hooks/useTracePlayer'

function NestedRangeControl({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string
  label: string
  description: string
  value: number
  onChange: (value: number) => void
}) {
  const { min, max } = MULTIPLICATION_TABLE_LIMITS
  const commitValue = (valueToCommit: number) => {
    if (!Number.isFinite(valueToCommit)) return
    onChange(Math.min(max, Math.max(min, Math.trunc(valueToCommit))))
  }

  return (
    <div className="foundation-control">
      <div className="foundation-control-heading">
        <label htmlFor={`${id}-number`}>
          <span>{label}</span>
          <small>{description}</small>
        </label>
        <input
          id={`${id}-number`}
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => commitValue(Number(event.target.value))}
        />
      </div>
      <input
        className="foundation-range"
        type="range"
        aria-label={`${label}滑桿`}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => commitValue(Number(event.target.value))}
      />
      <div className="foundation-range-bounds" aria-hidden="true">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

export function NestedLoopLab() {
  const [rows, setRows] = useState<number>(MULTIPLICATION_TABLE_LIMITS.defaultRows)
  const [columns, setColumns] = useState<number>(MULTIPLICATION_TABLE_LIMITS.defaultColumns)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const simulation = useMemo(
    () => simulateNestedMultiplicationTable(rows, columns),
    [columns, rows],
  )
  const player = useTracePlayer({
    frames: simulation.frames,
    speed,
    config: `${simulation.rows}:${simulation.columns}`,
    baseDelayMs: 560,
  })
  const frame = player.frame ?? simulation.frames[0]
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const activeCellRef = useRef<HTMLTableCellElement>(null)
  const activeCellIndex = frame.activeCell?.index ?? null
  const rowValues = Array.from({ length: simulation.rows }, (_, index) => index + 1)
  const columnValues = Array.from({ length: simulation.columns }, (_, index) => index + 1)
  const completionPercent = Math.round((frame.completedCells / simulation.cells.length) * 100)
  const currentRowPercent = frame.phase === 'done'
    ? 100
    : frame.phase === 'cell' ? Math.round((frame.innerValue / simulation.columns) * 100) : 0

  const changeDimension = (dimension: 'rows' | 'columns', value: number) => {
    if (dimension === 'rows') setRows(value)
    else setColumns(value)
  }
  const liveMessage = player.playing
    ? '正在自動播放巢狀迴圈；完成後會播報結果。'
    : frame.explanation

  useEffect(() => {
    const scroller = tableScrollRef.current
    if (!scroller) return

    if (frame.phase === 'ready') {
      scroller.scrollLeft = 0
      scroller.scrollTop = 0
      return
    }

    const cell = activeCellRef.current
    if (!cell) return

    const gutter = 12
    const viewportLeft = scroller.scrollLeft
    const viewportRight = viewportLeft + scroller.clientWidth
    const cellLeft = cell.offsetLeft
    const cellRight = cellLeft + cell.offsetWidth

    if (cellLeft < viewportLeft + gutter) {
      scroller.scrollLeft = Math.max(0, cellLeft - gutter)
    } else if (cellRight > viewportRight - gutter) {
      scroller.scrollLeft = cellRight - scroller.clientWidth + gutter
    }

  }, [activeCellIndex, frame.phase])

  return (
    <section className="nested-loop-section" aria-labelledby="nested-loop-title">
      <div className="page-width">
        <div className="nested-loop-heading">
          <div>
            <span className="section-kicker">NESTED LOOP · MULTIPLICATION TABLE</span>
            <h2 id="nested-loop-title">一個迴圈走過每一列，<br />另一個迴圈填滿每一列。</h2>
          </div>
          <p>巢狀迴圈是把一個 <code>for</code> 放進另一個 <code>for</code>。用乘法表觀察外層 <code>i</code> 與內層 <code>j</code> 如何合作。</p>
        </div>

        <div className="nested-loop-concepts" aria-label="巢狀迴圈三個執行重點">
          <article><span>01</span><Braces size={19} /><h3>外層決定列</h3><p><code>i</code> 從 1 走到 a，每個 i 對應乘法表的一列。</p></article>
          <article><span>02</span><RotateCcw size={19} /><h3>內層每列重來</h3><p>每當 i 改變，<code>j</code> 都會重新從 1 走到 b。</p></article>
          <article><span>03</span><Sparkles size={19} /><h3>每一格計算 i × j</h3><p>兩層迴圈每相遇一次，就產生乘法表的一格。</p></article>
        </div>

        <div className="nested-loop-lab">
          <details className="nested-loop-controls" open>
            <summary className="nested-controls-title">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <div><small>TABLE SIZE</small><h3>調整 a × b</h3></div>
              <span className="nested-controls-hint" aria-hidden="true">展開／收合</span>
            </summary>
            <div className="nested-controls-body" aria-label="巢狀迴圈乘法表參數">
              <NestedRangeControl
                id="nested-rows"
                label="外層上限 a"
                description="i 要產生幾列？"
                value={rows}
                onChange={(value) => changeDimension('rows', value)}
              />
              <NestedRangeControl
                id="nested-columns"
                label="內層上限 b"
                description="j 每列走幾格？"
                value={columns}
                onChange={(value) => changeDimension('columns', value)}
              />
              <div className="nested-size-summary">
                <small>目前大小</small>
                <strong>{simulation.rows} <span>×</span> {simulation.columns}</strong>
                <p>共執行 <b>{simulation.cells.length}</b> 次內層迴圈</p>
              </div>
            </div>
          </details>

          <div className="nested-loop-stage">
            <div className="nested-playback-bar">
              <PlaybackControls
                className="nested-playback-controls"
                aria-label="巢狀迴圈執行控制"
                controlName="巢狀迴圈"
                playing={player.playing}
                atStart={player.atStart}
                atEnd={player.atEnd}
                speed={speed}
                onPlay={player.play}
                onPause={player.pause}
                onNext={player.next}
                onReset={player.reset}
                onReplay={player.replay}
                onSpeedChange={setSpeed}
              />
              <div className="nested-total-progress">
                <div><span>整張表進度</span><strong>{frame.completedCells} / {simulation.cells.length}</strong></div>
                <div className="nested-progress-track"><motion.span animate={{ width: `${completionPercent}%` }} /></div>
              </div>
            </div>

            <div className="nested-execution-grid">
              <section className="multiplication-table-panel" aria-labelledby="multiplication-table-title">
                <div className="nested-panel-title"><Braces size={16} /><h3 id="multiplication-table-title">{simulation.rows} × {simulation.columns} 乘法表</h3><small>{completionPercent}%</small></div>
                <div
                  className="multiplication-table-scroll"
                  ref={tableScrollRef}
                  role="region"
                  tabIndex={0}
                  aria-label={`${simulation.rows} × ${simulation.columns} 乘法表檢視區；小螢幕可左右捲動`}
                >
                  <table aria-label={`${simulation.rows} × ${simulation.columns} 乘法表，已完成 ${frame.completedCells} 格`}>
                    <thead><tr><th scope="col">i × j</th>{columnValues.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
                    <tbody>
                      {rowValues.map((row) => (
                        <tr key={row}>
                          <th scope="row">{row}</th>
                          {columnValues.map((column) => {
                            const cellIndex = (row - 1) * simulation.columns + column - 1
                            const cell = simulation.cells[cellIndex]
                            const revealed = cellIndex < frame.completedCells
                            const active = frame.activeCell?.index === cellIndex
                            return (
                              <td
                                ref={active ? activeCellRef : undefined}
                                className={active ? 'active' : revealed ? 'revealed' : ''}
                                key={column}
                                aria-current={active ? 'step' : undefined}
                                aria-label={active
                                  ? `${row} 乘以 ${column} 等於 ${cell.product}，目前執行`
                                  : revealed
                                    ? `${row} 乘以 ${column} 等於 ${cell.product}，已產生`
                                    : `${row} 乘以 ${column}，尚未執行`}
                              >
                                <small>{row}×{column}</small>
                                <AnimatePresence mode="wait">
                                  <motion.strong key={revealed ? cell.product : 'waiting'} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>{revealed ? cell.product : '·'}</motion.strong>
                                </AnimatePresence>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="nested-code-panel" aria-labelledby="nested-code-title">
                <div className="nested-panel-title"><Terminal size={16} /><h3 id="nested-code-title">核心迴圈片段</h3><small>{simulation.rows} × {simulation.columns}</small></div>
                <div className="nested-source" aria-label="巢狀 for 迴圈 C 程式片段">
                  {simulation.sourceLines.map((line, index) => (
                    <div
                      className={frame.activeLine === index + 1 ? 'active' : ''}
                      aria-current={frame.activeLine === index + 1 ? 'step' : undefined}
                      data-active-part={frame.activeLine === index + 1 ? frame.activePart : undefined}
                      key={`${index}-${line}`}
                    >
                      <span>{index + 1}</span><code>{line || ' '}</code>
                    </div>
                  ))}
                </div>
                <div className="nested-loop-values">
                  <div className="outer-value"><small>OUTER LOOP</small><span>i</span><strong>{frame.phase === 'done' ? '完成' : frame.outerValue}</strong></div>
                  <ArrowRight size={18} />
                  <div className="inner-value"><small>INNER LOOP</small><span>j</span><strong>{frame.phase === 'done' ? '完成' : frame.innerValue}</strong></div>
                  <ArrowRight size={18} />
                  <div className="product-value"><small>PRODUCT</small><span>i × j</span><strong>{frame.activeCell?.product ?? '—'}</strong></div>
                </div>
                <div className="nested-row-progress">
                  <div><span>目前這一列的內層進度</span><strong>{frame.phase === 'cell' ? `${frame.innerValue}/${simulation.columns}` : frame.phase === 'done' ? `${simulation.columns}/${simulation.columns}` : `0/${simulation.columns}`}</strong></div>
                  <div className="nested-progress-track"><motion.span animate={{ width: `${currentRowPercent}%` }} /></div>
                </div>
              </section>
            </div>

            <motion.div className={`nested-explanation ${frame.phase}`} key={frame.index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} aria-label="巢狀迴圈目前狀態">
              <span>{frame.phase === 'done' ? <Check size={18} /> : frame.phase === 'cell' ? <Sparkles size={18} /> : <Circle size={14} />}</span>
              <div><small>{frame.phase === 'ready' ? 'READY' : frame.phase === 'done' ? 'COMPLETE' : `CELL ${frame.completedCells}`}</small><p>{frame.explanation}</p></div>
            </motion.div>
            <p className="sr-only" aria-live="polite">{liveMessage}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
