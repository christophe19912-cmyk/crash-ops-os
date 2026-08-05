import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx'
import { ApplicationContextProvider, useApplicationContextStatus } from './auth/ApplicationContext.tsx'
import AuthScreen from './auth/AuthScreen.tsx'
import ConfigurationScreen from './auth/ConfigurationScreen.tsx'
import FirstRunSetup from './auth/FirstRunSetup.tsx'
import { isSupabaseConfigured } from './lib/supabase.ts'

function ProtectedApplication() {
  const status = useApplicationContextStatus()

  if (status.loading) {
    return <div className="application-loading"><span className="loading-mark">CO</span><p>Loading organization…</p></div>
  }

  if (status.needsSetup) {
    return <FirstRunSetup onComplete={status.refresh} />
  }

  return <App />
}

function ApplicationRoot() {
  const { session, loading, passwordRecovery } = useAuth()

  if (loading) {
    return <div className="application-loading"><span className="loading-mark">CO</span><p>Securing your workspace…</p></div>
  }

  if (!session || passwordRecovery) return <AuthScreen />

  return (
    <ApplicationContextProvider>
      <ProtectedApplication />
    </ApplicationContextProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <AuthProvider>
        <ApplicationRoot />
      </AuthProvider>
    ) : (
      <ConfigurationScreen />
    )}
  </StrictMode>,
)
