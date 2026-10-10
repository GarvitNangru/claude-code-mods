export type RunStatus = 'running' | 'done' | 'stopped' | 'failed'

export type AgentRun = {
  id: string
  type: string
  description: string
  model: string
  effort?: string
  status: RunStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  costUsd: number
  steps: number
}

export type Wave = {
  ids: string[]
  isHidden: boolean
}

export type Plan = {
  title: string
  steps: string[]
  done: number
  startedAt: number
  endedAt?: number
  isStale: boolean
  isHidden: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'agent-monitor': {
      runs: AgentRun[]
      wave: Wave
      plan: Plan | null
      isDoneCollapsed: boolean
      now: number
    }
  }
}
