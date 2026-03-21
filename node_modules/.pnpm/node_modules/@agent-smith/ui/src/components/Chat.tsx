import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Loader2, Plus, PanelTop, Layers, Square, X, Paperclip } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useChatStore } from '@/store/chat'
import { useConfigStore } from '@/store/config'
import { gateway } from '@/api/gateway'
import Message from '@/components/Message'
import SmithAvatar, { type AgentState } from '@/components/SmithAvatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useFloatingAvatar, type ResizeDir } from '@/hooks/useFloatingAvatar'

const API = import.meta.env.DEV ? 'http://localhost:3000' : ''

const MODELS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

function modelLabel(id: string) {
  return MODELS.find((m) => m.id === id)?.label ?? id
}

export default function Chat() {
  const { messages, streamingContent, statusMessage, addMessage } = useChatStore()
  const { config, updateConfig } = useConfigStore()
  const isDark = config?.system?.darkTheme ?? true
  const [input, setInput] = useState('')
  const [bgAvatarSize, setBgAvatarSize] = useState(600)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    mode: avatarMode, setMode: setAvatarMode,
    x: avatarX, y: avatarY, size: avatarSize,
    initPosition, reclamp,
    handleDragStart, handleResizeStart,
  } = useFloatingAvatar(containerRef)

  // Measure container — init floating position + background avatar size + reclamp on resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (height > 0) setBgAvatarSize(Math.round(height))
      if (width  > 0) initPosition(Math.round(width))
      reclamp()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [initPosition, reclamp])

  const isStreaming = streamingContent !== null
  const currentModel = config?.agent?.model ?? 'claude-sonnet-4-6'

  // Derive avatar state from chat activity
  const hasError = messages.length > 0 && messages[messages.length - 1].isError
  const avatarState: AgentState = hasError
    ? 'error'
    : streamingContent !== null && streamingContent.length > 0
      ? 'speaking'
      : streamingContent !== null
        ? 'thinking'
        : input.trim().length > 0
          ? 'listening'
          : 'idle'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && !pendingFile) || isStreaming) return

    setUploadError(null)

    // Upload attachment first if present
    let agentFileNote = ''
    let attachmentName: string | undefined
    if (pendingFile) {
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', pendingFile)
        const res = await fetch(`${API}/api/documents/upload`, { method: 'POST', body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? 'Upload failed')
        }
        const data = await res.json()
        attachmentName = pendingFile.name
        agentFileNote = `\n\n[File attached: ${pendingFile.name} — ${data.chunks} chunks indexed in memory, available for recall]`
      } catch (err: any) {
        setUploadError(err?.message ?? 'Upload failed')
        setUploading(false)
        return
      }
      setUploading(false)
      setPendingFile(null)
    }

    // Show only user text in chat bubble (attachment shown as chip)
    addMessage({
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: text,
      timestamp: new Date(),
      attachmentName,
    })

    // Send to agent: text + plain file note (no markdown)
    gateway.send((text + agentFileNote).trim())
    setInput('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  const handleStop = () => {
    gateway.stop()
  }

  const handleModelChange = async (modelId: string) => {
    if (!config) return
    await updateConfig({ agent: { ...config.agent, model: modelId } })
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div ref={containerRef} className="relative flex h-full flex-col bg-background">

        {/* Toggle button — top right (dark theme only) */}
        {isDark && <div className="absolute top-3 right-3 z-20">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setAvatarMode((m) => m === 'header' ? 'background' : 'header')}
              >
                {avatarMode === 'header'
                  ? <Layers className="h-3.5 w-3.5" />
                  : <PanelTop className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {avatarMode === 'header' ? 'Background mode' : 'Header mode'}
            </TooltipContent>
          </Tooltip>
        </div>}

        {/* Background mode — avatar behind everything */}
        {isDark && avatarMode === 'background' && (
          <div className="pointer-events-none absolute inset-0 select-none overflow-hidden" style={{ opacity: 0.85 }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <SmithAvatar agentState={avatarState} size={bgAvatarSize} />
            </div>
          </div>
        )}

        {/* Header mode — freely draggable & resizable floating avatar */}
        {isDark && avatarMode === 'header' && avatarX !== null && (() => {
          const E = 6 // edge hit-zone thickness px
          const edges: { dir: ResizeDir; style: React.CSSProperties }[] = [
            { dir: 'n',  style: { top: 0,    left: E,    right: E,    height: E,  cursor: 'n-resize'  } },
            { dir: 's',  style: { bottom: 0, left: E,    right: E,    height: E,  cursor: 's-resize'  } },
            { dir: 'e',  style: { right: 0,  top: E,     bottom: E,   width: E,   cursor: 'e-resize'  } },
            { dir: 'w',  style: { left: 0,   top: E,     bottom: E,   width: E,   cursor: 'w-resize'  } },
            { dir: 'nw', style: { top: 0,    left: 0,    width: E,    height: E,  cursor: 'nw-resize' } },
            { dir: 'ne', style: { top: 0,    right: 0,   width: E,    height: E,  cursor: 'ne-resize' } },
            { dir: 'sw', style: { bottom: 0, left: 0,    width: E,    height: E,  cursor: 'sw-resize' } },
            { dir: 'se', style: { bottom: 0, right: 0,   width: E,    height: E,  cursor: 'se-resize' } },
          ]
          return (
            <div
              style={{
                position: 'absolute',
                left: avatarX,
                top:  avatarY,
                width:  avatarSize,
                height: avatarSize,
                zIndex: 10,
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
              }}
              onPointerDown={handleDragStart}
            >
              <SmithAvatar agentState={avatarState} size={avatarSize} />

              {/* Bottom gradient fade */}
              <div style={{
                position: 'absolute',
                left: 0, right: 0, bottom: 0,
                height: '40%',
                background: 'linear-gradient(to bottom, transparent, var(--background))',
                pointerEvents: 'none',
              }} />

              {/* Invisible edge & corner resize zones */}
              {edges.map(({ dir, style }) => (
                <div
                  key={dir}
                  style={{ position: 'absolute', ...style }}
                  onPointerDown={(e) => { e.stopPropagation(); handleResizeStart(e, dir) }}
                />
              ))}
            </div>
          )
        })()}

        {/* Status bar */}
        {statusMessage && (
          <div className="relative flex items-center gap-2 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {statusMessage}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="relative flex-1">
          <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
            {messages.map((msg) => (
              <Message key={msg.id} message={msg} />
            ))}

            {/* Streaming */}
            {isStreaming && (
              <div className="flex gap-3">
                <div className="flex-1 pt-0.5 text-base leading-relaxed text-foreground">
                  {streamingContent ? (
                    <div className={cn(
                      'prose prose-base max-w-none dark:prose-invert',
                      'prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1',
                      'prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5',
                      'prose-code:rounded-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none',
                      'prose-pre:rounded-lg prose-pre:bg-muted prose-pre:p-3 prose-pre:text-xs',
                      'prose-strong:text-foreground prose-a:text-foreground prose-a:underline prose-hr:my-1 prose-hr:border-border',
                    )}>
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 pt-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="relative px-4 pb-1">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-card">
              {/* Attachment chip */}
              {pendingFile && (
                <div className="flex items-center gap-1.5 px-4 pt-3">
                  <div className="flex items-center gap-1.5 rounded-lg border bg-muted px-2.5 py-1 text-xs text-foreground/80">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="max-w-[200px] truncate">{pendingFile.name}</span>
                    <button
                      onClick={() => setPendingFile(null)}
                      className="text-muted-foreground hover:text-foreground ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Reply…"
                rows={1}
                disabled={isStreaming || uploading}
                className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
                style={{ maxHeight: '200px', minHeight: '44px' }}
              />

              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStreaming}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Attach file (PDF, DOCX, TXT, MD)
                  </TooltipContent>
                </Tooltip>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground font-normal"
                      >
                        {modelLabel(currentModel)}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      {MODELS.map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          onSelect={() => handleModelChange(m.id)}
                          className={cn('text-xs', currentModel === m.id && 'font-medium')}
                        >
                          {m.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {isStreaming ? (
                    <Button
                      size="icon"
                      onClick={handleStop}
                      className="h-7 w-7 rounded-lg"
                    >
                      <Square className="h-3 w-3 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      onClick={() => void handleSend()}
                      disabled={(!input.trim() && !pendingFile) || uploading}
                      className="h-7 w-7 rounded-lg"
                    >
                      {uploading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ArrowUp className="h-3.5 w-3.5" />
                      }
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {uploadError && (
              <p className="mt-1.5 text-xs text-destructive text-center">{uploadError}</p>
            )}
            <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
              Smith may make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
