export interface FunctionConfig {
  x: number
  y: number
}

export const FUNCTION_LIMITS = {
  x: { min: -20, max: 20 },
  y: { min: -20, max: 20 },
} as const

export const DEFAULT_FUNCTION_CONFIG: Readonly<FunctionConfig> = {
  x: 4,
  y: 3,
}
