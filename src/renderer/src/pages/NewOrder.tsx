import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import VariantPickerDialog from '@/components/orders/VariantPickerDialog'
import { useCartStore, cartSubtotal } from '@/stores/cart-store'
import { cn } from '@/lib/utils'
import type {
  Category,
  NamedEntity,
  ProductWithVariants,
  Variant,
  OrderType,
  CreateOrderInput
} from '../../../shared/types'

function rankProducts(products: ProductWithVariants[], query: string): ProductWithVariants[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  const scored = products
    .map((p) => {
      const name = p.name.toLowerCase()
      let score = -1
      if (name.startsWith(q)) score = 3
      else if (name.split(' ').some((w) => w.startsWith(q))) score = 2
      else if (name.includes(q)) score = 1
      return { p, score }
    })
    .filter((x) => x.score > 0)
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.p.timesSold - a.p.timesSold ||
      (b.p.lastSoldAt ?? '').localeCompare(a.p.lastSoldAt ?? '')
  )
  return scored.map((x) => x.p)
}

export default function NewOrder(): React.JSX.Element {
  const cart = useCartStore()
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tables, setTables] = useState<NamedEntity[]>([])
  const [waiters, setWaiters] = useState<NamedEntity[]>([])
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [variantProduct, setVariantProduct] = useState<ProductWithVariants | null>(null)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    void (async () => {
      const [p, c, t, w] = await Promise.all([
        window.api.products.list(),
        window.api.categories.list(),
        window.api.tables.list(),
        window.api.waiters.list()
      ])
      if (p.ok && p.data) setProducts(p.data.filter((x) => x.isActive))
      if (c.ok && c.data) setCategories(c.data.filter((x) => x.isActive))
      if (t.ok && t.data) setTables(t.data.filter((x) => x.isActive))
      if (w.ok && w.data) setWaiters(w.data.filter((x) => x.isActive))
    })()
  }, [])

  useEffect(() => {
    function focusSearch(): void {
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey && (e.key === 'k' || e.key === 'f')) || e.key === 'F3') {
        e.preventDefault()
        focusSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pos:focus-search', focusSearch)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pos:focus-search', focusSearch)
    }
  }, [])

  const visible = useMemo(() => {
    return query.trim() !== ''
      ? rankProducts(products, query)
      : activeCat === null
        ? products
        : products.filter((p) => p.categoryId === activeCat)
  }, [products, query, activeCat])

  useEffect(() => {
    btnRefs.current = btnRefs.current.slice(0, visible.length)
  }, [visible])

  function gridCols(): number {
    if (!gridRef.current) return 3
    return getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length
  }

  function focusCard(i: number): void {
    const el = btnRefs.current[i]
    if (el) {
      el.focus()
      el.scrollIntoView({ block: 'nearest' })
    }
  }

  function onGridKey(e: React.KeyboardEvent, i: number): void {
    const c = gridCols()
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusCard(Math.min(i + 1, visible.length - 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusCard(Math.max(i - 1, 0))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusCard(Math.min(i + c, visible.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (i - c < 0) searchRef.current?.focus()
      else focusCard(i - c)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      searchRef.current?.focus()
    }
  }

  function pickProduct(p: ProductWithVariants): void {
    if (p.hasVariants) {
      setVariantProduct(p)
    } else {
      cart.addLine({
        productId: p.id,
        variantId: null,
        productName: p.name,
        variantName: null,
        unitPrice: p.price
      })
      setQuery('')
      searchRef.current?.focus()
    }
  }

  function pickVariant(v: Variant): void {
    if (!variantProduct) return
    cart.addLine({
      productId: variantProduct.id,
      variantId: v.id,
      productName: variantProduct.name,
      variantName: v.name,
      unitPrice: v.price
    })
    setVariantProduct(null)
    setQuery('')
    searchRef.current?.focus()
  }

  const subtotal = cartSubtotal(cart.lines)
  const discountAmount = Math.round((subtotal * cart.discountPercent) / 100)
  const total = subtotal - discountAmount

  async function saveOrder(
    action: 'paid_print' | 'paid_only' | 'kitchen_slip' | 'print_receipt'
  ): Promise<void> {
    setError('')
    setSavedMsg('')
    if (cart.lines.length === 0) {
      setError('Cart is empty')
      return
    }
    setSaving(true)
    const markPaid = action === 'paid_print' || action === 'paid_only'
    const input: CreateOrderInput = {
      orderType: cart.orderType,
      tableId: cart.tableId,
      waiterId: cart.waiterId,
      customerPhone: cart.customerPhone,
      customerAddress: cart.customerAddress,
      discountPercent: cart.discountPercent,
      markPaid,
      items: cart.lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        note: l.note || undefined
      }))
    }
    const res = await window.api.orders.create(input)
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Failed to save order')
      setSaving(false)
      return
    }
    let order = res.data
    if (action === 'kitchen_slip') {
      const up = await window.api.orders.updateStatus(order.id, 'kitchen_printed')
      if (up.ok && up.data) order = up.data
    }
    let printNote = ''
    if (action === 'paid_print' || action === 'print_receipt') {
      const pr = await window.api.print.receipt(order)
      printNote = pr.ok ? ' - receipt printed' : ` - PRINT FAILED: ${pr.error}`
    } else if (action === 'kitchen_slip') {
      const pr = await window.api.print.kitchen(order)
      printNote = pr.ok ? ' - kitchen slip printed' : ` - PRINT FAILED: ${pr.error}`
    }
    setSavedMsg(`Order ${order.orderNumber} saved (${order.status.replace('_', ' ')}) - Rs ${order.total}${printNote}`)
    cart.clear()
    setQuery('')
    setSaving(false)
    searchRef.current?.focus()
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex gap-2">
          {(
            [
              ['dine_in', 'Dine In'],
              ['take_away', 'Take Away'],
              ['delivery', 'Delivery']
            ] as [OrderType, string][]
          ).map(([type, label]) => (
            <Button
              key={type}
              variant={cart.orderType === type ? 'default' : 'outline'}
              className="h-11 flex-1 text-base"
              onClick={() => cart.setOrderType(type)}
            >
              {label}
            </Button>
          ))}
        </div>

        {cart.orderType === 'dine_in' && (
          <div className="flex gap-2">
            <Select
              value={cart.tableId ? String(cart.tableId) : ''}
              onValueChange={(v) => cart.setTableId(Number(v))}
            >
              <SelectTrigger className="h-11 flex-1">
                <SelectValue placeholder="Select Table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={cart.waiterId ? String(cart.waiterId) : ''}
              onValueChange={(v) => cart.setWaiterId(Number(v))}
            >
              <SelectTrigger className="h-11 flex-1">
                <SelectValue placeholder="Select Waiter" />
              </SelectTrigger>
              <SelectContent>
                {waiters.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {cart.orderType === 'delivery' && (
          <div className="flex gap-2">
            <Input
              className="h-11 w-48"
              placeholder="Customer Phone"
              value={cart.customerPhone}
              onChange={(e) => cart.setCustomerPhone(e.target.value)}
            />
            <Input
              className="h-11 flex-1"
              placeholder="Delivery Address"
              value={cart.customerAddress}
              onChange={(e) => cart.setCustomerAddress(e.target.value)}
            />
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="h-11 pl-9 text-base"
            placeholder="Search menu... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && visible.length > 0) {
                e.preventDefault()
                pickProduct(visible[0])
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                focusCard(0)
              } else if (e.key === 'Escape') {
                setQuery('')
              }
            }}
            autoFocus
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setQuery('')}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {query.trim() === '' && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={activeCat === null ? 'default' : 'outline'}
              size="sm"
              className="h-10"
              onClick={() => setActiveCat(null)}
            >
              All
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={activeCat === c.id ? 'default' : 'outline'}
                size="sm"
                className="h-10"
                onClick={() => setActiveCat(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        )}

        <div
          ref={gridRef}
          className="grid flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto xl:grid-cols-4"
        >
          {visible.map((p, i) => (
            <button
              key={p.id}
              ref={(el) => {
                btnRefs.current[i] = el
              }}
              className={cn(
                'flex min-h-20 flex-col items-start justify-between rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                query && i === 0 && 'ring-2 ring-ring'
              )}
              onClick={() => pickProduct(p)}
              onKeyDown={(e) => onGridKey(e, i)}
            >
              <span className="text-sm font-medium leading-tight">{p.name}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {p.hasVariants
                  ? `Rs ${Math.min(...p.variants.map((v) => v.price))}+`
                  : `Rs ${p.price}`}
              </span>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="col-span-full p-8 text-center text-sm text-muted-foreground">
              No items found
            </p>
          )}
        </div>
      </div>

      <div className="flex w-80 shrink-0 flex-col border-l bg-card">
        <div className="flex h-12 items-center justify-between border-b px-3">
          <span className="font-bold">Cart</span>
          {cart.lines.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => cart.clear()}
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {cart.lines.map((l) => (
            <div key={l.key} className="rounded-md border p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.productName}</p>
                  {l.variantName && (
                    <p className="text-xs text-muted-foreground">{l.variantName}</p>
                  )}
                </div>
                <button
                  className="mt-0.5 text-muted-foreground"
                  onClick={() => cart.removeLine(l.key)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => cart.decrement(l.key)}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{l.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => cart.increment(l.key)}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
                <span className="text-sm font-bold">Rs {l.unitPrice * l.quantity}</span>
              </div>
              <input
                className="mt-2 h-8 w-full rounded border border-input bg-background px-2 text-xs"
                placeholder="Note (optional)"
                value={l.note}
                onChange={(e) => cart.setNote(l.key, e.target.value)}
              />
            </div>
          ))}
          {cart.lines.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Cart is empty</p>
          )}
        </div>

        <div className="space-y-2 border-t p-3">
          <div className="flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span>Rs {subtotal}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>Discount %</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                className="h-8 w-16 text-right"
                value={cart.discountPercent === 0 ? '' : cart.discountPercent}
                placeholder="0"
                onChange={(e) => cart.setDiscountPercent(Number(e.target.value))}
              />
              <span className="w-16 text-right text-muted-foreground">- Rs {discountAmount}</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-lg font-bold">
            <span>Total</span>
            <span>Rs {total}</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {savedMsg && <p className="text-sm text-green-600 dark:text-green-500">{savedMsg}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button className="h-12" disabled={saving} onClick={() => void saveOrder('paid_print')}>
              Paid + Print
            </Button>
            <Button
              className="h-12"
              variant="secondary"
              disabled={saving}
              onClick={() => void saveOrder('paid_only')}
            >
              Paid Only
            </Button>
            <Button
              className="h-12"
              variant="outline"
              disabled={saving}
              onClick={() => void saveOrder('kitchen_slip')}
            >
              Kitchen Slip
            </Button>
            <Button
              className="h-12"
              variant="outline"
              disabled={saving}
              onClick={() => void saveOrder('print_receipt')}
            >
              Print Receipt
            </Button>
          </div>
        </div>
      </div>

      <VariantPickerDialog
        product={variantProduct}
        onPick={pickVariant}
        onClose={() => setVariantProduct(null)}
      />
    </div>
  )
}