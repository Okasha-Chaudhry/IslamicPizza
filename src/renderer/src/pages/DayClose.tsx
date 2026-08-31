import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CurrentDayTotals, BusinessDay } from '../../../shared/types'

function money(n: number): string {
  return 'Rs ' + n
}

export default function DayClose(): React.JSX.Element {
  const [totals, setTotals] = useState<CurrentDayTotals | null>(null)
  const [history, setHistory] = useState<BusinessDay[]>([])
  const [openingFloat, setOpeningFloat] = useState('0')
  const [countedCash, setCountedCash] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  async function load(): Promise<void> {
    const [t, h] = await Promise.all([window.api.closing.current(), window.api.closing.history(30)])
    if (t.ok && t.data) setTotals(t.data)
    if (h.ok && h.data) setHistory(h.data)
  }

  useEffect(() => {
    void load()
  }, [])

  async function openDay(): Promise<void> {
    setMsg('')
    const res = await window.api.closing.open(Number(openingFloat) || 0)
    if (res.ok) {
      setMsg('Day opened')
      void load()
    } else {
      setMsg('Failed: ' + res.error)
    }
  }

  async function closeDay(): Promise<void> {
    if (countedCash === '') {
      setMsg('Enter the counted cash first')
      return
    }
    setMsg('')
    const res = await window.api.closing.close(Number(countedCash) || 0, note)
    if (res.ok && res.data) {
      // Print the Z-report for this closing.
      await window.api.print.closing(res.data)
      setMsg('Day closed. Z-Report #' + res.data.zNumber + ' printed.')
      setCountedCash('')
      setNote('')
      void load()
    } else {
      setMsg('Failed: ' + (res.ok ? 'unknown' : res.error))
    }
  }

  const day = totals?.day
  const expected = totals?.expectedCash ?? 0
  const counted = Number(countedCash) || 0
  const diff = counted - expected

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Day Close</h1>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {!day && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">No open day</h2>
          <p className="text-sm text-muted-foreground">
            Start a new business day. Enter the opening cash in the drawer.
          </p>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="float">Opening Cash (float)</Label>
              <Input
                id="float"
                type="number"
                className="h-11 w-40"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
              />
            </div>
            <Button className="h-11" onClick={() => void openDay()}>
              Open Day
            </Button>
          </div>
        </section>
      )}

      {day && totals && (
        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Current Day (open)</h2>
            <span className="text-xs text-muted-foreground">Opened: {day.openedAt}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Total Orders</div><div className="text-right font-medium">{totals.totalOrders}</div>
            <div>Paid Orders</div><div className="text-right font-medium">{totals.paidOrders}</div>
            <div>Pending Orders</div><div className="text-right font-medium">{totals.pendingOrders}</div>
            <div>Revenue (paid)</div><div className="text-right font-medium">{money(totals.totalRevenue)}</div>
            <div>Discounts</div><div className="text-right font-medium">{money(totals.totalDiscount)}</div>
            <div>Opening Float</div><div className="text-right font-medium">{money(day.openingFloat)}</div>
            <div className="font-semibold">Expected Cash</div>
            <div className="text-right font-semibold">{money(expected)}</div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="counted">Counted Cash (in drawer)</Label>
            <Input
              id="counted"
              type="number"
              className="h-11 w-48"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="Count the drawer"
            />
            {countedCash !== '' && (
              <p className={'text-sm ' + (diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-destructive')}>
                Difference: {money(diff)} {diff === 0 ? '(matches)' : diff > 0 ? '(over)' : '(short)'}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" className="h-11" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button variant="destructive" className="h-11" onClick={() => void closeDay()}>
              Close Day & Print Z-Report
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Closing History</h2>
        {history.length === 0 && <p className="text-sm text-muted-foreground">No closings yet.</p>}
        {history.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <span>Z#{h.zNumber} - {h.closedAt}</span>
            <span>{money(h.totalRevenue)} / {h.paidOrders} orders</span>
            <span className={(h.cashDifference ?? 0) === 0 ? 'text-green-600' : 'text-destructive'}>
              {(h.cashDifference ?? 0) === 0 ? 'OK' : money(h.cashDifference ?? 0)}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}