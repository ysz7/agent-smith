import { MessageSquare, Clock, Settings, Glasses } from 'lucide-react'
import type { View } from '@/components/Main'
import { useChatStore } from '@/store/chat'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeView: View
  onNavigate: (view: View) => void
}

const TOP_NAV: { id: View; icon: React.ElementType; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'tasks', icon: Clock, label: 'Scheduled' },
]

const BOTTOM_NAV: { id: View; icon: React.ElementType; label: string }[] = [
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const isConnected = useChatStore((s) => s.isConnected)

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="flex w-14 flex-col items-center border-r bg-background py-3">
        {/* Logo */}
        <div className="mb-3 flex h-9 w-9 items-center justify-center">
          <Glasses className="h-5 w-5 text-foreground" />
        </div>

        <Separator className="mb-3 w-8" />

        {/* Top navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {TOP_NAV.map((item) => {
            const Icon = item.icon
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'h-9 w-9',
                      activeView === item.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Bottom: settings + connection */}
        <div className="flex flex-col items-center gap-3 pb-1">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'h-9 w-9',
                      activeView === item.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  isConnected ? 'bg-green-500' : 'animate-pulse bg-yellow-500',
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {isConnected ? 'Connected' : 'Connecting…'}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
