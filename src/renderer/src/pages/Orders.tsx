import { useCallback, useEffect, useState } from 'react'
import { Printer, ChefHat, Ban, CircleCheck, RefreshCw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useCartStore } from '@/stores/cart-store'
import type { OrderWithItems, OrderStatus } from '../../../shared/types'

const STATUS_TABS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'kitchen_printed', label: 'Kitchen' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' }
]

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  kitchen_printed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
}

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  delivery: 'Delivery'
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Orders(): React.JSX.Element {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [date, setDate] = useState(todayStr())
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [selected, setSelected] = useState<OrderWithItems | null>(null)
  const [msg, setMsg] = useState('')
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  const navigate = useNavigate()
  const cart = useCartStore()

  const refresh = useCallback(async (): Promise<void> => {
    const res = await window.api.orders.list({ date, status })
    if (res.ok && res.data) {
      setOrders(res.data)
      setSelected((sel) => (sel ? (res.data!.find((o) => o.id === sel.id) ?? null) : null))
    }
  }, [date, status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function setOrderStatus(order: OrderWithItems, newStatus: OrderStatus): Promise<void> {
    setMsg('')
    const res = await window.api.orders.updateStatus(order.id, newStatus)
    if (!res.ok) setMsg(res.error ?? 'Failed')
    await refresh()
  }

  async function reprint(order: OrderWithItems, kind: 'receipt' | 'kitchen'): Promise<void> {
    setMsg('')
    const res =
      kind === 'receipt'
        ? await window.api.print.receipt(order)
        : await window.api.print.kitchen(order)
    setMsg(res.ok ? `${kind === 'receipt' ? 'Receipt' : 'Kitchen slip'} printed` : `Print failed: ${res.error}`)
    if (kind === 'kitchen' && res.ok && order.status === 'pending') {
      await window.api.orders.updateStatus(order.id, 'kitchen_printed')
      await refresh()
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Orders</h1>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="h-10 w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => void refresh()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-1.5">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.key}
              variant={status === t.key ? 'default' : 'outline'}
              size="sm"
              className="h-10"
              onClick={() => setStatus(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="h-10 px-3 font-medium">Order #</th>
                <th className="h-10 px-3 font-medium">Time</th>
                <th className="h-10 px-3 font-medium">Type</th>
                <th className="h-10 px-3 font-medium">Items</th>
                <th className="h-10 px-3 text-right font-medium">Total</th>
                <th className="h-10 px-3 font-medium">Status</th>
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
                  <td className="h-12 px-3 text-muted-foreground">
                    {o.createdAt.slice(11, 16)}
                  </td>
                  <td className="h-12 px-3">{TYPE_LABEL[o.orderType]}</td>
                  <td className="h-12 px-3 text-muted-foreground">
                    {o.items.reduce((s, i) => s + i.quantity, 0)}
                  </td>
                  <td className="h-12 px-3 text-right font-medium">Rs {o.total}</td>
                  <td className="h-12 px-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[o.status]
                      )}
                    >
                      {o.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No orders for this date/filter
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
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_STYLE[selected.status]
                  )}
                >
                  {selected.status.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {TYPE_LABEL[selected.orderType]} &middot; {selected.createdAt}
              </p>
              {selected.customerPhone && (
                <p className="text-xs text-muted-foreground">Ph: {selected.customerPhone}</p>
              )}
              {selected.customerAddress && (
                <p className="text-xs text-muted-foreground">{selected.customerAddress}</p>
              )}
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {selected.items.map((i) => (
                <div key={i.id} className="flex justify-between gap-2 text-sm">
                  <span>
                    {i.quantity}x {i.productName}
                    {i.variantName ? ` (${i.variantName})` : ''}
                    {i.note && <span className="block text-xs italic text-muted-foreground">** {i.note}</span>}
                  </span>
                  <span className="whitespace-nowrap">Rs {i.lineTotal}</span>
                </div>
              ))}
              <div className="mt-3 space-y-1 border-t pt-2 text-sm">
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
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>Rs {selected.total}</span>
                </div>
              </div>
            </div>

            {msg && <p className="px-3 pb-1 text-sm">{msg}</p>}

            <div className="grid grid-cols-2 gap-2 border-t p-3">
              <Button variant="outline" className="h-11" onClick={() => void reprint(selected, 'receipt')}>
                <Printer className="size-4" /> Receipt
              </Button>
              <Button variant="outline" className="h-11" onClick={() => void reprint(selected, 'kitchen')}>
                <ChefHat className="size-4" /> Kitchen
              </Button>
              {selected.status !== 'paid' && selected.status !== 'cancelled' && (
                <Button className="h-11" onClick={() => void setOrderStatus(selected, 'paid')}>
                  <CircleCheck className="size-4" /> Mark Paid
                </Button>
              )}
              {(selected.status === 'pending' || selected.status === 'kitchen_printed') && (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    cart.clear()
                    cart.startEditing(selected.id, selected.orderNumber)
                    cart.setOrderType(selected.orderType)
                    if (selected.tableId) cart.setTableId(selected.tableId)
                    if (selected.waiterId) cart.setWaiterId(selected.waiterId)
                    cart.setCustomerName('')
                    if (selected.customerPhone) cart.setCustomerPhone(selected.customerPhone)
                    if (selected.customerAddress) cart.setCustomerAddress(selected.customerAddress)
                    cart.setDiscountAmount(selected.discount)
                    cart.setDeliveryCharge(selected.deliveryCharge)
                    for (const item of selected.items) {
                      for (let q = 0; q < item.quantity; q++) {
                        cart.addLine({
                          productId: item.productId,
                          variantId: item.variantId,
                          productName: item.productName,
                          variantName: item.variantName,
                          unitPrice: item.unitPrice
                        })
                      }
                      if (item.note) cart.setNote(`${item.productId}:${item.variantId ?? 'base'}`, item.note)
                    }
                    navigate('/new-order')
                  }}
                >
                  <Pencil className="size-4" /> Edit Order
                </Button>
              )}
              {isAdmin && selected.status !== 'cancelled' && selected.status !== 'paid' && (
                <Button
                  variant="destructive"
                  className="h-11"
                  onClick={() => void setOrderStatus(selected, 'cancelled')}
                >
                  <Ban className="size-4" /> Cancel
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Select an order to view details
          </p>
        )}
      </div>
    </div>
  )
}