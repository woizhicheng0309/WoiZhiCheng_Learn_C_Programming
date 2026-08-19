import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Braces,
  Check,
  Circle,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  StepForward,
  Terminal,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { FoundationRangeControl } from './FoundationControls'
import {
  MULTIPLICATION_TABLE_LIMITS,
  simulateNestedMultiplicationTable,
} from '../domain'

const speedOptions = [
  { value: 'slow', label: '慢速', delay: 620 },
  { value: 'normal', label: '標準', delay: 280 },
  { value: 'fast', label: '快速', delay: 110 },
] as const

type PlaybackSpeed = (typeof speedOptions)[number]['value']

export function NestedLoopLab() {
  const [rows, setRows] = useState<number>(MULTIPLICATION_TABLE_LIMITS.defaultRows)
  const [columns, setColumns] = useState<number>(MULTIPLICATION_TABLE_LIMITS.defaultColumns)
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>('normal')
  const simulation = useMemo(
    () => simulateNestedMultiplicationTable(rows, columns),
    [columns, rows],
  )
  const boundedIndex = Math.min(frameIndex, simulation.frames.length - 1)
  const frame = simulation.frames[boundedIndex]
  const atEnd = boundedIndex >= simulation.frames.length - 1
  const rowValues = Array.from({ length: simulation.rows }, (_, index) => index + 1)
  const columnValues = Array.from({ length: simulation.columns }, (_, index) => index + 1)
  const completionPercent = Math.round((frame.completedCells / simulation.cells.length) * 100)
  const currentRowPercent = frame.phase === 'done'
    ? 100
    : frame.phase === 'cell' ? Math.round((frame.innerValue / simulation.columns) * 100) : 0

  useEffect(() => {
    if (!playing || atEnd) return
    const delay = speedOptions.find((option) => option.value === speed)?.delay ?? 280
    const nextIndex = Math.min(boundedIndex + 1, simulation.frames.length - 1)
    const timer = window.setTimeout(() => {
      setFrameIndex(nextIndex)
      if (nextIndex >= simulation.frames.length - 1) setPlaying(false)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [atEnd, boundedIndex, playing, simulation.frames.length, speed])

  const changeDimension = (dimension: 'rows' | 'columns', value: number) => {
    setPlaying(false)
    setFrameIndex(0)
    if (dimension === 'rows') setRows(value)
    else setColumns(value)
  }

  const restart = () => {
    setPlaying(false)
    setFrameIndex(0)
  }

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (atEnd) setFrameIndex(0)
    setPlaying(true)
  }

  const nextFrame = () => {
    setPlaying(false)
    setFrameIndex((current) => Math.min(current + 1, simulation.frames.length - 1))
  }

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
          <aside className="nested-loop-controls" aria-label="巢狀迴圈乘法表參數">
            <div className="nested-controls-title"><SlidersHorizontal size={18} /><div><small>TABLE SIZE</small><h3>調整 a × b</h3></div></div>
            <FoundationRangeControl
              id="nested-rows"
              label="外層上限 a"
              description="i 要產生幾列？"
              value={rows}
              min={MULTIPLICATION_TABLE_LIMITS.min}
              max={MULTIPLICATION_TABLE_LIMITS.max}
              onChange={(value) => changeDimension('rows', value)}
            />
            <FoundationRangeControl
              id="nested-columns"
              label="內層上限 b"
              description="j 每列走幾格？"
              value={columns}
              min={MULTIPLICATION_TABLE_LIMITS.min}
              max={MULTIPLICATION_TABLE_LIMITS.max}
              onChange={(value) => changeDimension('columns', value)}
            />
            <div className="nested-speed-control">
              <span><Gauge size={15} /> 動畫速度</span>
              <div>
                {speedOptions.map((option) => (
                  <button
                    type="button"
                    aria-pressed={speed === option.value}
                    className={speed === option.value ? 'active' : ''}
                    key={option.value}
                    onClick={() => setSpeed(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="nested-size-summary">
              <small>目前大小</small>
              <strong>{simulation.rows} <span>×</span> {simulation.columns}</strong>
              <p>共執行 <b>{simulation.cells.length}</b> 次內層迴圈</p>
            </div>
          </aside>

          <div className="nested-loop-stage">
            <div className="nested-playback-bar">
              <div className="nested-playback-buttons">
                <button type="button" aria-label="巢狀迴圈回到起點" onClick={restart}><RotateCcw size={17} /></button>
                <button type="button" className="nested-play-button" aria-label={playing ? '暫停巢狀迴圈動畫' : '開始巢狀迴圈動畫'} onClick={togglePlayback}>
                  {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button type="button" aria-label="巢狀迴圈執行下一步" onClick={nextFrame} disabled={atEnd}><StepForward size={17} /></button>
              </div>
              <div className="nested-total-progress">
                <div><span>整張表進度</span><strong>{frame.completedCells} / {simulation.cells.length}</strong></div>
                <div className="nested-progress-track"><motion.span animate={{ width: `${completionPercent}%` }} /></div>
              </div>
            </div>

            <div className="nested-execution-grid">
              <section className="nested-code-panel" aria-labelledby="nested-code-title">
                <div className="nested-panel-title"><Terminal size={16} /><h3 id="nested-code-title">nested-table.c</h3><small>{simulation.rows} × {simulation.columns}</small></div>
                <div className="nested-source" aria-label="巢狀 for 迴圈 C 程式碼">
                  {simulation.sourceLines.map((line, index) => (
                    <div className={frame.activeLine === index + 1 ? 'active' : ''} key={`${index}-${line}`}>
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

              <section className="multiplication-table-panel" aria-labelledby="multiplication-table-title">
                <div className="nested-panel-title"><Braces size={16} /><h3 id="multiplication-table-title">{simulation.rows} × {simulation.columns} 乘法表</h3><small>{completionPercent}%</small></div>
                <div className="multiplication-table-scroll">
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
                              <td className={active ? 'active' : revealed ? 'revealed' : ''} key={column} aria-label={`${row} 乘以 ${column} 等於 ${cell.product}${revealed ? '，已產生' : '，尚未執行'}`}>
                                <small>{row}×{column}</small>
                                <AnimatePresence mode="wait">
                                  <motion.strong key={revealed ? cell.product : 'waiting'} initial={{ opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }}>{revealed ? cell.product : '·'}</motion.strong>
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
            </div>

            <motion.div className={`nested-explanation ${frame.phase}`} key={frame.index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} aria-label="巢狀迴圈目前狀態" aria-live="polite">
              <span>{frame.phase === 'done' ? <Check size={18} /> : frame.phase === 'cell' ? <Sparkles size={18} /> : <Circle size={14} />}</span>
              <div><small>{frame.phase === 'ready' ? 'READY' : frame.phase === 'done' ? 'COMPLETE' : `CELL ${frame.completedCells}`}</small><p>{frame.explanation}</p></div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
