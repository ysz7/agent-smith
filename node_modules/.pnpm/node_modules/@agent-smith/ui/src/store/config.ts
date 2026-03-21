import { create } from 'zustand'

export interface SkillEntry {
  enabled: boolean
  config?: Record<string, any>
}

export interface ExtensionEntry {
  enabled: boolean
  config?: Record<string, any>
}

export interface AgentConfig {
  version?: number
  agent: {
    name: string
    model: string
    systemPrompt?: string
  }
  apiKey: string // '***' when masked
  skills: Record<string, SkillEntry>
  extensions: Record<string, ExtensionEntry>
  transport: {
    port: number
    ui: boolean
    localhostOnly?: boolean
  }
  privacy?: {
    warnBeforeSendingFiles: boolean
    localAuditLog: boolean
    validateSkillsOnInstall: boolean
  }
  performance?: {
    historyWindow: number
    smartCompress: boolean
    promptCaching: boolean
    limaEnabled: boolean
  }
  system?: {
    preventSleep: boolean
    autoOpenBrowser: boolean
    darkTheme: boolean
    language: string
  }
}

interface ConfigState {
  config: AgentConfig | null
  isLoading: boolean
  hasApiKey: boolean

  fetchConfig: () => Promise<void>
  saveApiKey: (apiKey: string) => Promise<void>
  updateConfig: (patch: Partial<AgentConfig>) => Promise<void>
  toggleSkill: (name: string, enabled: boolean) => Promise<void>
  toggleExtension: (name: string, enabled: boolean) => Promise<void>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  hasApiKey: false,

  fetchConfig: async () => {
    // Only show loading spinner on the very first fetch
    if (!get().config) {
      set({ isLoading: true })
    }
    try {
      const res = await fetch('/api/config')
      const config: AgentConfig = await res.json()
      set({
        config,
        hasApiKey: config.apiKey === '***',
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  saveApiKey: async (apiKey: string) => {
    await fetch('/api/config/apikey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
    await get().fetchConfig()
  },

  updateConfig: async (patch: Partial<AgentConfig>) => {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await get().fetchConfig()
  },

  toggleSkill: async (name: string, enabled: boolean) => {
    // Optimistic update
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            skills: {
              ...state.config.skills,
              [name]: { ...(state.config.skills[name] ?? {}), enabled },
            },
          }
        : null,
    }))
    await fetch(`/api/skills/${name}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  },

  toggleExtension: async (name: string, enabled: boolean) => {
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            extensions: {
              ...state.config.extensions,
              [name]: { ...(state.config.extensions[name] ?? {}), enabled },
            },
          }
        : null,
    }))
    await fetch(`/api/extensions/${name}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  },
}))
