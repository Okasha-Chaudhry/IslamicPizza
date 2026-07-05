import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/providers/theme-provider'
import { useAuthStore } from '@/stores/auth-store'
import LoginScreen from '@/pages/LoginScreen'
import ActivationScreen from '@/pages/ActivationScreen'
import { useEffect, useState } from 'react'
import type { LicenseStatus } from '../../shared/types'
import MainLayout from '@/layouts/MainLayout'
import Dashboard from '@/pages/Dashboard'
import NewOrder from '@/pages/NewOrder'
import Orders from '@/pages/Orders'
import Products from '@/pages/Products'
import Categories from '@/pages/Categories'
import Tables from '@/pages/Tables'
import Waiters from '@/pages/Waiters'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'

function AdminOnly({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function App(): React.JSX.Element {
  const user = useAuthStore((s) => s.user)
  const [license, setLicense] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await window.api.license.status()
      if (res.ok && res.data) setLicense(res.data)
    })()
  }, [])

  if (license === null) {
    return (
      <ThemeProvider>
        <div className="flex h-screen items-center justify-center bg-background" />
      </ThemeProvider>
    )
  }

  if (!license.activated) {
    return (
      <ThemeProvider>
        <ActivationScreen
          status={license}
          onActivated={() => {
            void window.api.license.status().then((r) => {
              if (r.ok && r.data) setLicense(r.data)
            })
          }}
        />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      {user === null ? (
        <LoginScreen />
      ) : (
        <HashRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-order" element={<NewOrder />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/products" element={<AdminOnly><Products /></AdminOnly>} />
              <Route path="/categories" element={<AdminOnly><Categories /></AdminOnly>} />
              <Route path="/tables" element={<AdminOnly><Tables /></AdminOnly>} />
              <Route path="/waiters" element={<AdminOnly><Waiters /></AdminOnly>} />
              <Route path="/reports" element={<AdminOnly><Reports /></AdminOnly>} />
              <Route path="/settings" element={<AdminOnly><Settings /></AdminOnly>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      )}
    </ThemeProvider>
  )
}

export default App