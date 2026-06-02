import { ReactNode } from 'react'
import { AuthProvider } from '@/auth/AuthContext'
import { RequireAuth } from '@/auth/RequireAuth'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <TopBar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </RequireAuth>
    </AuthProvider>
  )
}
