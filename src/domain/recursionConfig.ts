export interface RecursionConfig { n: number }
export const DEFAULT_RECURSION_CONFIG: Readonly<RecursionConfig> = { n: 4 }
export function validateRecursionConfig(config: RecursionConfig = DEFAULT_RECURSION_CONFIG): readonly string[] {
  return Number.isInteger(config.n) && config.n >= 0 && config.n <= 6 ? [] : ['n 必須是 0 到 6 的整數。']
}
