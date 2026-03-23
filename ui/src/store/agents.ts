import { create } from 'zustand'

export interface AgentEntry {
  id: string
  name: string
  type: 'main' | 'user' | 'orchestrator'
  status: 'idle' | 'thinking' | 'working' | 'stopped' | 'error'
  model: string
  createdAt: string
  systemPrompt?: string
  taskDescription?: string
}

interface AgentsState {
  agents: AgentEntry[]
  setAgents: (agents: AgentEntry[]) => void
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  setAgents: (agents) => set({ agents }),
}))
