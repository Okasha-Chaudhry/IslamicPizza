import { useCallback, useEffect, useState } from 'react'
import { Search, CircleCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { OrderWithItems, OrderPayment } from '../../../shared/types'

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  delivery: 'Delivery'
}

function owedOn(o: OrderWithItems): number {
  return Math.max(0, o.total - o.amountPaid)
}

function fmtDateTime(raw: string): string {
  const d = new Date(raw.replace(' ', 'T'))
  if (isNaN(d.getTime())) return raw
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  let h = d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${dd}/${mm}/${d.getFullYear()}  ${h}:${min} ${ampm}`
}

export default function Ledger(): React.JSX.Element {
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [selected, setSelected] = useState<OrderWithItems | null>(null)
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [payAmount, setPayAmount] = useState('')
  const [msg, setMsg] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    const res = await window.api.orders.unpaid(phone.trim() || undefined)
    if (res.ok && res.data) {
      setOrders(res.data)
      setSelected((sel) => (sel ? (res.data!.find((o) => o.id === sel.id) ?? null) : null))
    }
  }, [phone])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!selected) {
      setPayments([])
      return
    }
    void (async () => {
      const res = await window.api.orders.payments(selected.id)
      if (res.ok && res.data) setPayments(res.data)
    })()
  }, [selected])

  async function submitPayment(order: OrderWithItems): Promise<void> {
    setMsg('')
    const amount = Math.round(Number(payAmount))
    if (!amount || amount <= 0) {
      setMsg('Enter a valid amount')
      return
    }
    const res = await window.api.orders.addPayment({ orderId: order.id, amount })
    if (!res.ok) {
      setMsg(res.error ?? 'Payment failed')
      return
    }
    setPayAmount('')
    setMsg(`Rs ${amount} received`)
    await refresh()
    const pr = await window.api.orders.payments(order.id)
    if (pr.ok && pr.data) setPayments(pr.data)
  }

  async function settleFull(order: OrderWithItems): Promise<void> {
    setMsg('')
    const res = await window.api.orders.updateStatus(order.id, 'paid')
    setMsg(res.ok ? 'Order settled' : (res.error ?? 'Failed'))
    await refresh()
  }

  const totalDue = orders.reduce((s, o) => s + owedOn(o), 0)

  // Group by phone so one glance shows who owes what across all their orders.
  const byCustomer = new Map<string, { due: number; count: number; address: string }>()
  for (const o of orders) {
    const key = o.customerPhone ?? 'Walk-in'
    const prev = byCustomer.get(key) ?? { due: 0, count: 0, address: '' }
    byCustomer.set(key, {
      due: prev.due + owedOn(o),
      count: prev.count + 1,
      address: prev.address || (o.customerAddress ?? '')
    })
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Customer Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Outstanding balances - Rs {totalDue} across {orders.length} order
              {orders.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 w-56 pl-8"
                placeholder="Search by phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => void refresh()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {byCustomer.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {[...byCustomer.entries()].map(([ph, info]) => (
              <button
                key={ph}
                className="rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => setPhone(ph === 'Walk-in' ? '' : ph)}
              >
                <span className="font-medium">{ph}</span>
                <span className="ml-2 font-bold text-amber-700 dark:text-amber-400">Rs {info.due}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {info.count} order{info.count === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="h-10 px-3 font-medium">Order #</th>
                <th className="h-10 px-3 font-medium">Date</th>
                <th className="h-10 px-3 font-medium">Type</th>
                <th className="h-10 px-3 font-medium">Phone</th>
                <th className="h-10 px-3 font-medium">Address</th>
                <th className="h-10 px-3 text-right font-medium">Total</th>
                <th className="h-10 px-3 text-right font-medium">Paid</th>
                <th className="h-10 px-3 text-right font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className={cn(
                    'cursor-pointer border-t transition-colors hover:bg-accent',
                    selected?.id === o.id && 'bg-accent'
                  )}
                  onClick={() => setSelected(o)}
                >
                  <td className="h-12 px-3 font-medium">{o.orderNumber}</td>
                  <td className="h-12 px-3 text-muted-foreground">{fmtDateTime(o.createdAt)}</td>
                  <td className="h-12 px-3">{TYPE_LABEL[o.orderType] ?? o.orderType}</td>
                  <td className="h-12 px-3 text-muted-foreground">{o.customerPhone ?? ''}</td>
                  <td
                    className="h-12 max-w-40 truncate px-3 text-muted-foreground"
                    title={o.customerAddress ?? ''}
                  >
                    {o.customerAddress ?? ''}
                  </td>
                  <td className="h-12 px-3 text-right">Rs {o.total}</td>
                  <td className="h-12 px-3 text-right text-green-700 dark:text-green-400">
                    {o.amountPaid > 0 ? `Rs ${o.amountPaid}` : '-'}
                  </td>
                  <td className="h-12 px-3 text-right font-bold text-amber-700 dark:text-amber-400">
                    Rs {owedOn(o)}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {phone.trim() ? 'No outstanding orders for this number' : 'Nothing outstanding'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex w-96 shrink-0 flex-col border-l bg-card">
        {selected ? (
          <>
            <div className="border-b p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold">{selected.orderNumber}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Rs {owedOn(selected)} due
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {TYPE_LABEL[selected.orderType] ?? selected.orderType} &middot;{' '}
                {fmtDateTime(selected.createdAt)}
              </p>
              {selected.customerPhone && (
                <p className="text-xs text-muted-foreground">Ph: {selected.customerPhone}</p>
              )}
              {selected.customerAddress && (
                <p className="text-xs text-muted-foreground">{selected.customerAddress}</p>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              <div className="space-y-1">
                {selected.items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-2 text-sm">
                    <span>
                      {i.quantity}x {i.productName}
                      {i.variantName ? ` (${i.variantName})` : ''}
                    </span>
                    <span className="whitespace-nowrap">Rs {i.lineTotal}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-t pt-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rs {selected.subtotal}</span>
                </div>
                {selected.discount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span>- Rs {selected.discount}</span>
                  </div>
                )}
                {selected.deliveryCharge > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span>+ Rs {selected.deliveryCharge}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>Rs {selected.total}</span>
                </div>
                <div className="flex justify-between text-green-700 dark:text-green-400">
                  <span>Paid</span>
                  <span>Rs {selected.amountPaid}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-700 dark:text-amber-400">
                  <span>Remaining</span>
                  <span>Rs {owedOn(selected)}</span>
                </div>
              </div>

              {payments.length > 0 && (
                <div className="space-y-1 border-t pt-2">
                  <p className="text-xs font-medium text-muted-foreground">Payment history</p>
                  {payments.map((p) => (
                    <div key={p.id} className="flex justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{fmtDateTime(p.createdAt)}</span>
                      <span className="whitespace-nowrap">Rs {p.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {msg && <p className="px-3 pb-1 text-sm">{msg}</p>}

            <div className="flex items-end gap-2 border-t p-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Received now</label>
                <Input
                  type="number"
                  min="1"
                  className="h-11"
                  placeholder="Amount"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <Button className="h-11" onClick={() => void submitPayment(selected)}>
                Add
              </Button>
            </div>

            <div className="border-t p-3">
              <Button
                variant="outline"
                className="h-11 w-full"
                onClick={() => void settleFull(selected)}
              >
                <CircleCheck className="size-4" /> Settle full Rs {owedOn(selected)}
              </Button>
            </div>
          </>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Select an order to record a payment
          </p>
        )}
      </div>
    </div>
  )
}