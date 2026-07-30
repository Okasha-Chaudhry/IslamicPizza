import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusCircle,
  ReceiptText,
  Package,
  FolderOpen,
  Table2,
  Users,
  BarChart3,
  Wallet,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/providers/theme-provider'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import logo from '@/assets/logo.png'

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; highlight?: boolean; adminOnly?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/new-order', label: 'New Order', icon: PlusCircle, highlight: true },
  { to: '/orders', label: 'Orders', icon: ReceiptText },
  { to: '/products', label: 'Menu', icon: Package, adminOnly: true },
  { to: '/categories', label: 'Categories', icon: FolderOpen, adminOnly: true },
  { to: '/tables', label: 'Tables', icon: Table2, adminOnly: true },
  { to: '/waiters', label: 'Waiters', icon: Users, adminOnly: true },
  { to: '/reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { to: '/expenses', label: 'Expenses', icon: Wallet, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true }
]

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

export default function MainLayout(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const visibleItems = navItems.filter((i) => !i.adminOnly || user?.role === 'admin')
  const [restaurantName, setRestaurantName] = useState('Restaurant POS')

  useEffect(() => {
    async function loadName(): Promise<void> {
      const res = await window.api.settings.get()
      if (res.ok && res.data?.restaurantName) setRestaurantName(res.data.restaurantName)
    }
    void loadName()
    const handler = (): void => void loadName()
    window.addEventListener('pos:settings-changed', handler)
    return () => window.removeEventListener('pos:settings-changed', handler)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key.toLowerCase() !== 'o' || e.ctrlKey || e.altKey || e.metaKey) return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      navigate('/new-order')
      setTimeout(() => window.dispatchEvent(new CustomEvent('pos:focus-search')), 50)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <img src={logo} alt="" className="size-9" />
          <span className="truncate text-base font-bold tracking-tight">{restaurantName}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  item.highlight && !isActive && 'text-foreground'
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-2">
          <div className="flex h-9 items-center justify-between px-3 text-xs text-muted-foreground">
            <span>{user?.name} ({user?.role})</span>
          </div>
          <Button
            variant="ghost"
            className="h-11 w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
            onClick={logout}
          >
            <Lock className="size-4" />
            Lock
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}