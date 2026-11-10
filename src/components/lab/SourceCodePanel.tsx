import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from 'react'
import type { SourceCodeLine } from './types'

export interface SourceCodePanelProps<PartId extends string = string>
  extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'title'> {
  lines: readonly SourceCodeLine<PartId>[]
  activeLine: number | null
  activePart?: PartId | null
  title?: ReactNode
  status?: ReactNode
  explanation?: ReactNode
  codeLabel?: string
  followActiveLine?: boolean
}

function joinClassNames(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

export function SourceCodePanel<PartId extends string = string>({
  lines,
  activeLine,
  activePart = null,
  title = 'C 程式碼',
  status,
  explanation,
  codeLabel,
  followActiveLine = false,
  className,
  ...rest
}: SourceCodePanelProps<PartId>) {
  const titleId = useId()
  const editorRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement>(null)
  const resolvedCodeLabel = codeLabel
    ?? (activeLine === null ? 'C 程式碼' : `C 程式碼，目前執行第 ${activeLine} 行`)

  useEffect(() => {
    const editor = editorRef.current
    const line = activeLineRef.current
    if (!followActiveLine || !editor || !line) return
    const editorBounds = editor.getBoundingClientRect()
    const lineBounds = line.getBoundingClientRect()
    if (lineBounds.top < editorBounds.top) editor.scrollTop += lineBounds.top - editorBounds.top
    else if (lineBounds.bottom > editorBounds.bottom) editor.scrollTop += lineBounds.bottom - editorBounds.bottom
  }, [activeLine, followActiveLine])

  return (
    <section
      className={joinClassNames('lab-panel', 'source-code-panel', className)}
      aria-labelledby={titleId}
      {...rest}
    >
      <div className="source-code-panel__heading">
        <h2 id={titleId}>{title}</h2>
        {status && <div className="source-code-panel__status">{status}</div>}
      </div>
      <div
        ref={editorRef}
        className="source-code-panel__editor"
        aria-label={resolvedCodeLabel}
        role={followActiveLine ? 'region' : undefined}
        tabIndex={followActiveLine ? 0 : undefined}
      >
        {lines.map((line) => {
          const lineIsActive = line.lineNumber === activeLine
          return (
            <div
              ref={lineIsActive && followActiveLine ? activeLineRef : undefined}
              className={joinClassNames(
                'source-code-panel__line',
                lineIsActive && 'is-active',
              )}
              aria-current={lineIsActive ? 'step' : undefined}
              data-line={line.lineNumber}
              key={line.lineNumber}
            >
              <span className="source-code-panel__line-number" aria-hidden="true">
                {line.lineNumber}
              </span>
              <code>
                {line.parts.map((part) => {
                  const partIsActive = lineIsActive && part.id === activePart
                  return (
                    <span
                      className={joinClassNames(
                        'source-code-panel__part',
                        partIsActive && 'is-active',
                      )}
                      data-part={part.id}
                      data-active={partIsActive || undefined}
                      key={part.id}
                    >
                      {part.text}
                    </span>
                  )
                })}
              </code>
            </div>
          )
        })}
      </div>
      {explanation && (
        <div className="source-code-panel__explanation">{explanation}</div>
      )}
    </section>
  )
}
