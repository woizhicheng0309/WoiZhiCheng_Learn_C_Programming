import {
  useId,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { ChallengePanelItem, ChallengeTabRenderer } from './types'

export interface ChallengePanelProps<Id extends string = string>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  challenges: readonly ChallengePanelItem<Id>[]
  activeId: Id
  onSelect: (id: Id) => void
  children: (challenge: ChallengePanelItem<Id>) => ReactNode
  renderTab?: ChallengeTabRenderer<Id>
  label?: string
  orientation?: 'horizontal' | 'vertical'
}

function joinClassNames(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function ChallengePanel<Id extends string = string>({
  challenges,
  activeId,
  onSelect,
  children,
  renderTab,
  label = '學習挑戰',
  orientation = 'horizontal',
  className,
  ...rest
}: ChallengePanelProps<Id>) {
  const instanceId = safeId(useId())
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>())
  const enabledChallenges = challenges.filter((challenge) => !challenge.disabled)
  const activeChallenge = enabledChallenges.find((challenge) => challenge.id === activeId)
    ?? enabledChallenges[0]
    ?? challenges[0]

  const selectAndFocus = (challenge: ChallengePanelItem<Id> | undefined) => {
    if (!challenge || challenge.disabled) return
    onSelect(challenge.id)
    tabRefs.current.get(challenge.id)?.focus()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    challengeId: Id,
  ) => {
    if (enabledChallenges.length === 0) return
    const currentIndex = Math.max(
      0,
      enabledChallenges.findIndex((challenge) => challenge.id === challengeId),
    )
    let target: ChallengePanelItem<Id> | undefined

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = enabledChallenges[(currentIndex + 1) % enabledChallenges.length]
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        target = enabledChallenges[
          (currentIndex - 1 + enabledChallenges.length) % enabledChallenges.length
        ]
        break
      case 'Home':
        target = enabledChallenges[0]
        break
      case 'End':
        target = enabledChallenges[enabledChallenges.length - 1]
        break
      default:
        return
    }

    event.preventDefault()
    selectAndFocus(target)
  }

  return (
    <div className={joinClassNames('challenge-panel', className)} {...rest}>
      <div
        className="challenge-panel__tabs"
        role="tablist"
        aria-label={label}
        aria-orientation={orientation}
      >
        {challenges.map((challenge) => {
          const selected = challenge.id === activeChallenge?.id
          const tabId = `${instanceId}-tab-${safeId(challenge.id)}`
          const panelId = `${instanceId}-panel-${safeId(challenge.id)}`
          return (
            <button
              type="button"
              role="tab"
              className={joinClassNames(
                'challenge-panel__tab',
                selected && 'is-active',
                challenge.completed && 'is-complete',
              )}
              id={tabId}
              aria-selected={selected}
              aria-controls={panelId}
              disabled={challenge.disabled}
              tabIndex={selected ? 0 : -1}
              key={challenge.id}
              ref={(node) => {
                if (node) tabRefs.current.set(challenge.id, node)
                else tabRefs.current.delete(challenge.id)
              }}
              onClick={() => onSelect(challenge.id)}
              onKeyDown={(event) => handleKeyDown(event, challenge.id)}
            >
              {renderTab
                ? renderTab(challenge, { selected })
                : (
                    <>
                      {challenge.eyebrow && <small>{challenge.eyebrow}</small>}
                      <span>{challenge.label}</span>
                      {challenge.completed && (
                        <span className="challenge-panel__completed">已完成</span>
                      )}
                    </>
                  )}
            </button>
          )
        })}
      </div>
      {activeChallenge && (
        <div
          className="challenge-panel__content"
          role="tabpanel"
          id={`${instanceId}-panel-${safeId(activeChallenge.id)}`}
          aria-labelledby={`${instanceId}-tab-${safeId(activeChallenge.id)}`}
          tabIndex={0}
        >
          {children(activeChallenge)}
        </div>
      )}
    </div>
  )
}
