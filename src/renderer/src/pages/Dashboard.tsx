import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, ReceiptText, RefreshCw, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SalesReport } from '../../../shared/types'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard(): React.JSX.Element {
  const navigate = useNavigate()
  const [report, setReport] = useState<SalesReport | null>(null)
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [now, setNow] = useState(new Date())

  const load = useCallback(async (): Promise<void> => {
    const t = todayStr()
    const res = await window.api.reports.sales({ from: t, to: t })
    if (res.ok && res.data) setReport(res.data)
    const eRes = await window.api.expenses.summary({ from: t, to: t })
    if (eRes.ok && eRes.data) setExpenseTotal(eRes.data.total)
  }, [])

  useEffect(() => {
    void load()
    const dataTimer = setInterval(() => void load(), 30000)
    const clockTimer = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(dataTimer)
      clearInterval(clockTimer)
    }
  }, [load])

  const s = report?.summary
  const topItem = report?.popular[0]

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}{' '}
            &middot; {now.toLocaleTimeString()}
          </p>
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => void load()}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button className="h-16 text-lg" onClick={() => navigate('/new-order')}>
          <PlusCircle className="size-5" /> New Order (O)
        </Button>
        <Button variant="outline" className="h-16 text-lg" onClick={() => navigate('/orders')}>
          <ReceiptText className="size-5" /> View Orders
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">Today&apos;s Revenue</p>
          <p className="mt-1 text-2xl font-bold">Rs {s?.paidRevenue ?? 0}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">Paid Orders</p>
          <p className="mt-1 text-2xl font-bold">{s?.paidOrders ?? 0}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">Unpaid Orders</p>
          <p className="mt-1 text-2xl font-bold">{s?.pendingOrders ?? 0}</p>
          {(s?.pendingAmount ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">Rs {s!.pendingAmount}</p>
          )}
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Order</p>
          <p className="mt-1 text-2xl font-bold">Rs {s?.avgOrderValue ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">Today&apos;s Expenses</p>
          <p className="mt-1 text-2xl font-bold">Rs {expenseTotal}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs text-muted-foreground">Today&apos;s Profit (Sales - Expenses)</p>
          <p
            className={`mt-1 text-2xl font-bold ${(s?.paidRevenue ?? 0) - expenseTotal < 0 ? 'text-destructive' : 'text-green-600 dark:text-green-500'}`}
          >
            Rs {(s?.paidRevenue ?? 0) - expenseTotal}
          </p>
        </div>
      </div>

      {topItem && (
        <div className="flex items-center gap-3 rounded-md border bg-card p-4">
          <TrendingUp className="size-8 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Top item today</p>
            <p className="font-semibold">
              {topItem.productName}
              {topItem.variantName ? ` (${topItem.variantName})` : ''} &middot; {topItem.quantity}{' '}
              sold &middot; Rs {topItem.revenue}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}