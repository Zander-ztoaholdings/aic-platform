'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import { SessionGuard } from './components/SessionGuard'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <SessionGuard />
    </SessionProvider>
  )
}
