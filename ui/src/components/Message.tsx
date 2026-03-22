import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Paperclip } from 'lucide-react'
import type { ChatMessage } from '@/store/chat'
import { cn } from '@/lib/utils'

const API = import.meta.env.DEV ? 'http://localhost:3000' : ''

// Match screenshot paths saved by computer-use extension
const SCREENSHOT_RE = /[^\s`"']+[\\/]\.agent-smith[\\/]screenshots[\\/](screenshot-[^\s`"']+\.png)/gi

interface ContextMenu {
  x: number
  y: number
  filePath: string
  filename: string
}

function ScreenshotChip({ filePath, filename }: { filePath: string; filename: string }) {
  const [menu, setMenu] = useState<ContextMenu | null>(null)
  const [revealed, setRevealed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, filePath, filename })
  }

  const handleReveal = useCallback(async () => {
    setMenu(null)
    try {
      await fetch(`${API}/api/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      })
      setRevealed(true)
      setTimeout(() => setRevealed(false), 1500)
    } catch { /* ignore */ }
  }, [filePath])

  // Close menu on outside click
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  return (
    <span className="block my-2">
      {/* Inline image */}
      <img
        src={`${API}/api/screenshots/${filename}`}
        alt={filename}
        onContextMenu={handleContextMenu}
        className="max-w-full rounded-lg border border-border cursor-context-menu"
        style={{ maxHeight: '400px' }}
      />

      {/* File path chip */}
      <span
        onContextMenu={handleContextMenu}
        className="inline-flex items-center gap-1.5 mt-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground cursor-context-menu select-none"
        title="Right-click for options"
      >
        <Paperclip className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-xs">{filePath}</span>
        {revealed && <span className="text-emerald-500 shrink-0">✓</span>}
      </span>

      {/* Context menu */}
      {menu && (
        <span
          ref={menuRef}
          style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 9999 }}
          className="block min-w-[160px] rounded-lg border border-border bg-popover shadow-lg py-1 text-sm"
        >
          <button
            onClick={handleReveal}
            className="w-full text-left px-3 py-1.5 hover:bg-accent text-foreground"
          >
            Reveal in folder
          </button>
          <a
            href={`${API}/api/screenshots/${filename}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenu(null)}
            className="block px-3 py-1.5 hover:bg-accent text-foreground"
          >
            Open image
          </a>
        </span>
      )}
    </span>
  )
}

function renderWithScreenshots(content: string) {
  const parts: React.ReactNode[] = []
  let last = 0
  SCREENSHOT_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = SCREENSHOT_RE.exec(content)) !== null) {
    const [fullMatch, filename] = match
    const start = match.index

    if (start > last) {
      parts.push(
        <ReactMarkdown key={`md-${last}`}>{content.slice(last, start)}</ReactMarkdown>
      )
    }

    parts.push(
      <ScreenshotChip key={`ss-${start}`} filePath={fullMatch.replace(/`/g, '')} filename={filename} />
    )
    last = start + fullMatch.length
  }

  if (last < content.length) {
    parts.push(
      <ReactMarkdown key={`md-${last}`}>{content.slice(last)}</ReactMarkdown>
    )
  }

  return parts.length > 0 ? parts : null
}

interface MessageProps {
  message: ChatMessage
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
          {message.attachmentName && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-black/10 dark:bg-white/10 px-2.5 py-1.5 text-xs">
              <Paperclip className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate opacity-80">{message.attachmentName}</span>
            </div>
          )}
          {message.content && (
            <p className="whitespace-pre-wrap leading-relaxed text-base">{message.content}</p>
          )}
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  const proseClass = cn(
    'prose prose-base max-w-none dark:prose-invert text-foreground',
    'prose-p:my-1.5 prose-p:leading-relaxed',
    'prose-headings:mt-4 prose-headings:mb-1.5 prose-headings:font-semibold prose-headings:text-foreground',
    'prose-h1:text-base prose-h2:text-sm prose-h3:text-sm',
    'prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5 prose-li:my-0.5',
    'prose-code:rounded-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none',
    'prose-pre:rounded-lg prose-pre:bg-muted prose-pre:p-3 prose-pre:text-xs prose-pre:text-foreground',
    'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:text-muted-foreground prose-blockquote:pl-4',
    'prose-strong:font-semibold prose-strong:text-foreground',
    'prose-a:text-foreground prose-a:underline prose-a:underline-offset-2',
    'prose-hr:border-border',
  )

  const screenshotParts = !message.isError ? renderWithScreenshots(message.content) : null

  return (
    <div>
      {message.isError ? (
        <p className="text-sm text-destructive">{message.content}</p>
      ) : screenshotParts ? (
        <div className={proseClass}>{screenshotParts}</div>
      ) : (
        <div className={proseClass}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
