import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, ArrowUp, Square } from 'lucide-react'
import { useChatStore } from '@/store/chat'
import { gateway } from '@/api/gateway'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import Message from '@/components/Message'
import type { AgentEntry } from '@/store/agents'
import { cn } from '@/lib/utils'

interface Props {
  agent: AgentEntry
  onClose: () => void
}

export default function AgentChatPanel({ agent, onClose }: Props) {
  const [input, setInput] = useState('')
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const messages = useChatStore(s => s.agentMessages[agent.id] ?? [])
  const streamingContent = useChatStore(s => s.agentStreamingContent[agent.id] ?? null)
  const isStreaming = streamingContent !== null

  // Load history once on mount
  useEffect(() => {
    if (!historyLoaded) {
      setHistoryLoaded(true)
      gateway.loadAgentHistory(agent.id)
    }
  }, [agent.id, historyLoaded])

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [])

  const handleSend = useCallback(() => {
    const content = input.trim()
    if (!content || isStreaming) return

    useChatStore.getState().addAgentMessage(agent.id, {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content,
      timestamp: new Date(),
    })

    gateway.sendToAgent(agent.id, content)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, isStreaming, agent.id])

  const handleStop = useCallback(() => {
    gateway.stop()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{agent.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{agent.model}</span>
        </div>
        <div className={cn(
          'ml-auto h-2 w-2 rounded-full shrink-0',
          agent.status === 'thinking' || agent.status === 'working' ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500',
        )} />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-1">
          {messages.length === 0 && !isStreaming && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Start a conversation with {agent.name}
            </p>
          )}
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}
          {isStreaming && (
            <Message
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingContent ?? '',
                timestamp: new Date(),
              }}
              isStreaming
            />
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}…`}
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 max-h-40"
            style={{ height: 'auto' }}
          />
          {isStreaming ? (
            <Button size="sm" variant="secondary" className="h-9 w-9 p-0 shrink-0" onClick={handleStop}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
