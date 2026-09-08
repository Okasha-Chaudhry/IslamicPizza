import { useCallback, useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CurrentDayTotals, BusinessDay, SalesReport } from '../../../shared/types'

function money(n: number): string {
  return 'Rs ' + n
}

function fmt(raw: string | null): string {
  if (!raw) return ''
  const d = new Date(raw.replace(' ', 'T'))
  if (isNaN(d.getTime())) return raw
  const p = (n: number): string => String(n).padStart(2, '0')
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${h}:${p(d.getMinutes())} ${ampm}`
}

export default function DayClose(): React.JSX.Element {
  const [totals, setTotals] = useState<CurrentDayTotals | null>(null)
  const [history, setHistory] = useState<BusinessDay[]>([])
  const [countedCash, setCountedCash] = useState('')
  const [note, setNote] = useState('')
  const [showCash, setShowCash] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async (): Promise<void> => {
    const [t, h] = await Promise.all([window.api.closing.current(), window.api.closing.history(60)])
    if (t.ok && t.data) setTotals(t.data)
    if (h.ok && h.data) setHistory(h.data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Reports are always fetched for one business day, so a day closed after
  // midnight still reads as a single day rather than splitting at 12am.
  async function printDay(
    businessDayId: number,
    mode: 'simple' | 'sections' | 'summary'
  ): Promise<void> {
    setMsg('')
    const res = await window.api.closing.dayReport(businessDayId)
    if (!res.ok || !res.data) {
      setMsg(res.error ?? 'Could not build the report')
      return
    }
    const r: SalesReport = res.data
    const payload =
      mode === 'summary'
        ? { ...r, sectionSummaryOnly: true }
        : mode === 'sections'
          ? r
          : { ...r, bySection: [] }
    const pr = await window.api.print.report(payload)
    setMsg(pr.ok ? 'Report printed' : 'Print failed: ' + pr.error)
  }

  async function closeDay(): Promise<void> {
    setMsg('')
    const counted = showCash && countedCash !== '' ? Number(countedCash) : null
    const res = await window.api.closing.close(counted, note)
    if (res.ok && res.data) {
      await window.api.print.closing(res.data)
      setMsg('Day closed. Z-Report #' + res.data.zNumber + ' printed. New orders start a new day.')
      setCountedCash('')
      setNote('')
      void load()
    } else {
      setMsg('Failed: ' + (res.ok ? 'unknown' : res.error))
    }
  }

  const day = totals?.day
  const expected = totals?.expectedCash ?? 0
  const diff = (Number(countedCash) || 0) - expected

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Day Close</h1>
      {msg && <p className="rounded-md border bg-muted/40 p-2 text-sm">{msg}</p>}

      {!day && (
        <section className="rounded-lg border p-6 text-center">
          <p className="font-medium">No day is running</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A new day starts by itself with the first order. Nothing to do here.
          </p>
        </section>
      )}

      {day && totals && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Today so far</h2>
            <span className="text-xs text-muted-foreground">Started: {fmt(day.openedAt)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-card p-3">
              <p className="text-xs text-muted-foreground">Cash Received</p>
              <p className="mt-1 text-2xl font-bold">{money(totals.totalRevenue)}</p>
            </div>
            <div className="rounded-md border bg-card p-3">
              <p className="text-xs text-muted-foreground">Orders</p>
              <p className="mt-1 text-2xl font-bold">{totals.totalOrders}</p>
            </div>
            <div className="rounded-md border bg-card p-3">
              <p className="text-xs text-muted-foreground">Discounts</p>
              <p className="mt-1 text-2xl font-bold">{money(totals.totalDiscount)}</p>
            </div>
          </div>

          {totals.pendingOrders > 0 && (
            <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm dark:border-amber-600 dark:bg-amber-950/40">
              <span className="font-semibold">{totals.pendingOrders} unpaid order
              {totals.pendingOrders === 1 ? '' : 's'}</span> worth {money(totals.pendingAmount)} are
              still open. Collect or cancel them before closing, or they carry into the report as unpaid.
            </div>
          )}

          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Print a report for today</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11" onClick={() => void printDay(day.id, 'simple')}>
                <Printer className="size-4" /> Simple
              </Button>
              <Button variant="outline" className="h-11" onClick={() => void printDay(day.id, 'sections')}>
                <Printer className="size-4" /> Section-wise
              </Button>
              <Button variant="outline" className="h-11" onClick={() => void printDay(day.id, 'summary')}>
                <Printer className="size-4" /> Section Summary
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-3">
            <button
              className="text-xs text-muted-foreground underline"
              onClick={() => setShowCash((s) => !s)}
            >
              {showCash ? 'Hide cash count' : 'Count the cash drawer (optional)'}
            </button>
            {showCash && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <Label htmlFor="counted">Cash counted in drawer</Label>
                <Input
                  id="counted"
                  type="number"
                  className="h-11 w-48"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="Amount"
                />
                {countedCash !== '' && (
                  <p
                    className={
                      'text-sm ' +
                      (diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-destructive')
                    }
                  >
                    Expected {money(expected)} - difference {money(diff)}{' '}
                    {diff === 0 ? '(matches)' : diff > 0 ? '(over)' : '(short)'}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" className="h-11" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button className="h-12 w-full text-base" onClick={() => void closeDay()}>
              Close Day &amp; Print Z-Report
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Everything up to now is saved as today. The next order starts a new day.
            </p>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Previous Days</h2>
        {history.length === 0 && <p className="text-sm text-muted-foreground">No closed days yet.</p>}
        {history.map((h) => (
          <div key={h.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Z#{h.zNumber} &middot; {fmt(h.closedAt)}
              </span>
              <span>
                {money(h.totalRevenue)} &middot; {h.totalOrders} orders
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="h-9" onClick={() => void printDay(h.id, 'simple')}>
                Simple
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => void printDay(h.id, 'sections')}>
                Section-wise
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => void printDay(h.id, 'summary')}>
                Summary
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => void window.api.print.closing(h)}
              >
                Z-Report
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}