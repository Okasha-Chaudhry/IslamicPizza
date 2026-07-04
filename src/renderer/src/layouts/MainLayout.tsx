import { useEffect } from 'react'
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
  Settings as SettingsIcon,
  Moon,
  Sun
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/providers/theme-provider'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/new-order', label: 'New Order', icon: PlusCircle, highlight: true },
  { to: '/orders', label: 'Orders', icon: ReceiptText },
  { to: '/products', label: 'Menu', icon: Package },
  { to: '/categories', label: 'Categories', icon: FolderOpen },
  { to: '/tables', label: 'Tables', icon: Table2 },
  { to: '/waiters', label: 'Waiters', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
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
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-base font-bold tracking-tight">Restaurant POS</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => (
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