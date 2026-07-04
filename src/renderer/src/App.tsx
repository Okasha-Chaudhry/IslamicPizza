import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/providers/theme-provider'
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

function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/waiters" element={<Waiters />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App