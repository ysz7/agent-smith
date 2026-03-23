import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Chat from '@/components/Chat'
import Settings from '@/components/Settings'
import ScheduledTasks from '@/components/ScheduledTasks'
import AgentsOffice from '@/components/AgentsOffice'

export type View = 'chat' | 'settings' | 'tasks' | 'agents'

export default function Main() {
  const [view, setView] = useState<View>('chat')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={view} onNavigate={setView} />
      <main className="flex flex-1 flex-col overflow-hidden">
        {view === 'chat' && <Chat />}
        {view === 'settings' && <Settings />}
        {view === 'tasks' && <ScheduledTasks />}
        {view === 'agents' && <AgentsOffice />}
      </main>
    </div>
  )
}
