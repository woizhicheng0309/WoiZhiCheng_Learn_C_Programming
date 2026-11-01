import { buildSwitchSource, simulateSwitchProgram, type SwitchConfig } from '../domain/switchBranching'

export const SWITCH_CHALLENGE_IDS = ['predict-switch-match', 'predict-switch-fallthrough', 'identify-switch-default'] as const
export type SwitchChallengeId = (typeof SWITCH_CHALLENGE_IDS)[number]
export const SWITCH_CHALLENGES: readonly { id: SwitchChallengeId; title: string; config: SwitchConfig }[] = [
  { id: 'predict-switch-match', title: '命中 case 2', config: { choice: 2, mode: 'with-break' } },
  { id: 'predict-switch-fallthrough', title: '省略 break 的輸出', config: { choice: 1, mode: 'fall-through' } },
  { id: 'identify-switch-default', title: '沒有 case 命中', config: { choice: 4, mode: 'with-break' } },
]
export const switchChallengeSource = (id: SwitchChallengeId) => buildSwitchSource(SWITCH_CHALLENGES.find(item => item.id === id)!.config).sourceText
export function evaluateSwitchChallenge(id: SwitchChallengeId, answer: string) {
  const challenge = SWITCH_CHALLENGES.find(item => item.id === id)!
  const expected = simulateSwitchProgram(challenge.config).output
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((value, index) => value === expected[index])
  return { solved, message: solved ? `答對了！輸出依序為 ${expected.join('、')}。` : id === 'predict-switch-fallthrough' ? '沒有 break 就會往下執行，包含 default；後續標籤不會重新比對。最後也會輸出 Done。' : '先找 switch 的入口，再追蹤 break 或區塊結尾；最後別忘了 switch 後的 Done。' }
}
