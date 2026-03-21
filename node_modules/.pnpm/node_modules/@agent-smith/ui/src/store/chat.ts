import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
  attachmentName?: string
}

interface ChatState {
  messages: ChatMessage[]
  streamingContent: string | null  // Content being streamed right now
  isConnected: boolean
  statusMessage: string | null     // System status ("Compressing...")

  addMessage: (msg: ChatMessage) => void
  startStreaming: () => void
  appendChunk: (chunk: string) => void
  endStreaming: () => void
  setConnected: (connected: boolean) => void
  clearMessages: () => void
  setStatus: (msg: string | null) => void
  setHistory: (msgs: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streamingContent: null,
  isConnected: false,
  statusMessage: null,

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
}))
