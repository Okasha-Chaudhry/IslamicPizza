import { useCallback, useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SalesReport } from '../../../shared/types'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Reports(): React.JSX.Element {
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<SalesReport | null>(null)
  const [expSummary, setExpSummary] = useState<{ total: number; byCategory: { category: string; total: number }[]; byItem: { itemName: string; purchases: number; total: number; lastDate: string }[] } | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setMsg('')
    const res = await window.api.reports.sales({ from, to })
    if (res.ok && res.data) setReport(res.data)
    else setMsg(res.error ?? 'Failed to load report')
    const eRes = await window.api.expenses.summary({ from, to })
    if (eRes.ok && eRes.data) setExpSummary(eRes.data)
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  function setQuickRange(days: number): void {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    const fmt = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setFrom(fmt(start))
    setTo(fmt(end))
  }

  async function printIt(): Promise<void> {
    if (!report) return
    setMsg('')
    const res = await window.api.print.report(report)
    setMsg(res.ok ? 'Report printed' : `Print failed: ${res.error}`)
  }

  const s = report?.summary

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Button variant="outline" className="h-11" onClick={() => void printIt()} disabled={!report}>
          <Printer className="size-4" /> Print Report
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="h-10 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" className="h-10 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="ml-2 flex gap-1.5">
          <Button variant="outline" size="sm" className="h-10" onClick={() => { setFrom(todayStr()); setTo(todayStr()) }}>
            Today
          </Button>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setQuickRange(7)}>
            7 Days
          </Button>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setQuickRange(30)}>
            30 Days
          </Button>
        </div>
      </div>

      {msg && <p className="text-sm">{msg}</p>}

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground">Revenue (Paid)</p>
              <p className="mt-1 text-2xl font-bold">Rs {s.paidRevenue}</p>
            </div>
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground">Paid Orders</p>
              <p className="mt-1 text-2xl font-bold">{s.paidOrders}</p>
            </div>
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground">Avg Order</p>
              <p className="mt-1 text-2xl font-bold">Rs {s.avgOrderValue}</p>
            </div>
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground">Discounts</p>
              <p className="mt-1 text-2xl font-bold">Rs {s.totalDiscount}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground">Unpaid (pending + kitchen)</p>
              <p className="mt-1 text-lg font-bold">
                {s.pendingOrders} orders &middot; Rs {s.pendingAmount}
              </p>
            </div>
            <div className="rounded-md border bg-card p-4">
              <p className="text-xs text-muted-foreground">Cancelled</p>
              <p className="mt-1 text-lg font-bold">{s.cancelledOrders} orders</p>
            </div>
          </div>

          {expSummary && (
            <div className="rounded-md border bg-card p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Sales (paid)</p>
                  <p className="mt-1 text-xl font-bold">Rs {s.paidRevenue}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expenses</p>
                  <p className="mt-1 text-xl font-bold">Rs {expSummary.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p
                    className={`mt-1 text-xl font-bold ${s.paidRevenue - expSummary.total < 0 ? 'text-destructive' : 'text-green-600 dark:text-green-500'}`}
                  >
                    Rs {s.paidRevenue - expSummary.total}
                  </p>
                </div>
              </div>
            </div>
          )}

          {expSummary && expSummary.byCategory.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="overflow-hidden rounded-md border">
                <div className="border-b bg-muted/50 px-3 py-2 text-sm font-semibold">
                  Expenses by Category
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {expSummary.byCategory.map((c) => (
                      <tr key={c.category} className="border-t">
                        <td className="px-3 py-2 capitalize">{c.category}</td>
                        <td className="px-3 py-2 text-right font-medium">Rs {c.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-hidden rounded-md border">
                <div className="border-b bg-muted/50 px-3 py-2 text-sm font-semibold">
                  Purchases by Item
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {expSummary.byItem.map((i) => (
                      <tr key={i.itemName} className="border-t">
                        <td className="px-3 py-2">{i.itemName}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {i.purchases}x
                        </td>
                        <td className="px-3 py-2 text-right font-medium">Rs {i.total}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          {i.lastDate}
                        </td>
                      </tr>
                    ))}
                    {expSummary.byItem.length === 0 && (
                      <tr>
                        <td className="p-4 text-center text-muted-foreground">
                          No item-tracked purchases
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-md border">
              <div className="border-b bg-muted/50 px-3 py-2 text-sm font-semibold">
                Popular Items (paid)
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {report!.popular.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">
                        {p.productName}
                        {p.variantName ? ` (${p.variantName})` : ''}
                      </td>
                      <td className="px-3 py-2 text-right">{p.quantity}x</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">Rs {p.revenue}</td>
                    </tr>
                  ))}
                  {report!.popular.length === 0 && (
                    <tr>
                      <td className="p-6 text-center text-muted-foreground">No paid orders in range</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="border-b bg-muted/50 px-3 py-2 text-sm font-semibold">
                Daily Breakdown (paid)
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {report!.daily.map((d) => (
                    <tr key={d.date} className="border-t">
                      <td className="px-3 py-2">{d.date}</td>
                      <td className="px-3 py-2 text-right">{d.orders} orders</td>
                      <td className="px-3 py-2 text-right font-medium">Rs {d.revenue}</td>
                    </tr>
                  ))}
                  {report!.daily.length === 0 && (
                    <tr>
                      <td className="p-6 text-center text-muted-foreground">No data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}