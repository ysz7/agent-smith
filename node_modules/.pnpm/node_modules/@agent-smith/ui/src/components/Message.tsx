import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '@/store/chat'
import { cn } from '@/lib/utils'

interface MessageProps {
  message: ChatMessage
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
          <p className="whitespace-pre-wrap leading-relaxed text-base">{message.content}</p>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {message.isError ? (
        <p className="text-sm text-destructive">{message.content}</p>
      ) : (
        <div className={cn(
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
        )}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
