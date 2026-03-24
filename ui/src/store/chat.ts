import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
  isProactive?: boolean
  attachmentName?: string
  attachmentImage?: string // base64 data URL for inline image preview
}

interface ChatState {
  messages: ChatMessage[]
  streamingContent: string | null  // Content being streamed right now
  isConnected: boolean
  statusMessage: string | null     // System status ("Compressing...")

  // Per-agent chat state (keyed by agentId)
  agentMessages: Record<string, ChatMessage[]>
  agentStreamingContent: Record<string, string | null>

  addMessage: (msg: ChatMessage) => void
  startStreaming: () => void
  appendChunk: (chunk: string) => void
  endStreaming: () => void
  setConnected: (connected: boolean) => void
  clearMessages: () => void
  setStatus: (msg: string | null) => void
  setHistory: (msgs: ChatMessage[]) => void

  addAgentMessage: (agentId: string, msg: ChatMessage) => void
  startAgentStreaming: (agentId: string) => void
  appendAgentChunk: (agentId: string, chunk: string) => void
  endAgentStreaming: (agentId: string) => void
  setAgentHistory: (agentId: string, msgs: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streamingContent: null,
  isConnected: false,
  statusMessage: null,
  agentMessages: {},
  agentStreamingContent: {},

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  startStreaming: () =>
    set({ streamingContent: '' }),

  appendChunk: (chunk) =>
    set((state) => ({
      streamingContent: state.streamingContent !== null ? state.streamingContent + chunk : chunk,
    })),

  endStreaming: () => {
    const { streamingContent } = get()
    if (streamingContent === null) return

    // Don't add an empty message if stopped before any text arrived
    if (!streamingContent.trim()) {
      set({ streamingContent: null })
      return
    }

    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'assistant',
      content: streamingContent,
      timestamp: new Date(),
    }
    set((state) => ({
      messages: [...state.messages, msg],
      streamingContent: null,
    }))
  },

  setConnected: (isConnected) => set({ isConnected }),

  clearMessages: () => set({ messages: [] }),

  setStatus: (statusMessage) => set({ statusMessage }),

  setHistory: (msgs) => set({ messages: msgs }),

  addAgentMessage: (agentId, msg) =>
    set((state) => ({
      agentMessages: {
        ...state.agentMessages,
        [agentId]: [...(state.agentMessages[agentId] ?? []), msg],
      },
    })),

  startAgentStreaming: (agentId) =>
    set((state) => ({
      agentStreamingContent: { ...state.agentStreamingContent, [agentId]: '' },
    })),

  appendAgentChunk: (agentId, chunk) =>
    set((state) => ({
      agentStreamingContent: {
        ...state.agentStreamingContent,
        [agentId]: (state.agentStreamingContent[agentId] ?? '') + chunk,
      },
    })),

  endAgentStreaming: (agentId) => {
    const { agentStreamingContent, agentMessages } = get()
    const content = agentStreamingContent[agentId]
    if (content === null || content === undefined) return
    const updated = { ...agentStreamingContent, [agentId]: null }
    if (!content.trim()) {
      set({ agentStreamingContent: updated })
      return
    }
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'assistant',
      content,
      timestamp: new Date(),
    }
    set({
      agentMessages: { ...agentMessages, [agentId]: [...(agentMessages[agentId] ?? []), msg] },
      agentStreamingContent: updated,
    })
  },

  setAgentHistory: (agentId, msgs) =>
    set((state) => ({
      agentMessages: { ...state.agentMessages, [agentId]: msgs },
    })),
}))
