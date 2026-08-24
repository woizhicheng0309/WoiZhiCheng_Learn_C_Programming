import type { HTMLAttributes, ReactNode } from 'react'

export interface LabShellProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  controls: ReactNode
  controlsLabel: string
  playback?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

export function LabShell({
  controls,
  controlsLabel,
  playback,
  children,
  footer,
  className,
  ...rest
}: LabShellProps) {
  return (
    <div className={joinClassNames('lab-shell', className)} {...rest}>
      <aside className="lab-shell__controls" aria-label={controlsLabel}>
        {controls}
      </aside>
      <div className="lab-shell__execution">
        {playback && <div className="lab-shell__playback">{playback}</div>}
        <div className="lab-shell__content">{children}</div>
        {footer && <footer className="lab-shell__footer">{footer}</footer>}
      </div>
    </div>
  )
}
