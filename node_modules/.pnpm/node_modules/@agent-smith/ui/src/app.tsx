import { useEffect } from 'react'
import { gateway } from '@/api/gateway'
import { useConfigStore } from '@/store/config'
import Onboarding from '@/components/Onboarding'
import Main from '@/components/Main'

export default function App() {
  const { config, hasApiKey, isLoading, fetchConfig } = useConfigStore()

  useEffect(() => {
    const isDark = config?.system?.darkTheme ?? true
    document.documentElement.classList.toggle('dark', isDark)
  }, [config?.system?.darkTheme])

  useEffect(() => {
    fetchConfig()
    gateway.connect()
    return () => gateway.disconnect()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  return hasApiKey ? <Main /> : <Onboarding />
}
