import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '../db'
import { orders, orderItems, products, variants } from '../db/schema'
import type {
  CreateOrderInput,
  OrderWithItems,
  OrderStatus
} from '../../shared/types'

function nextOrderNumber(): string {
  const today = new Date()
  const y = today.getFullYear()
  const mo = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const datePart = `${y}${mo}${d}`
  const row = getSqlite()
    .prepare(`SELECT COUNT(*) as c FROM orders WHERE order_number LIKE ?`)
    .get(`${datePart}-%`) as { c: number }
  return `${datePart}-${String(row.c + 1).padStart(3, '0')}`
}

export function createOrder(input: CreateOrderInput): OrderWithItems {
  if (!input.items || input.items.length === 0) throw new Error('Order has no items')
  if (input.orderType === 'dine_in' && !input.tableId) throw new Error('Select a table for dine-in')
  const discountPercent = Math.round(input.discountPercent ?? 0)
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100')
  }

  const db = getDb()
  const sqlite = getSqlite()

  const tx = sqlite.transaction((): OrderWithItems => {
    // Resolve prices/names from DB - never trust the renderer
    const resolvedItems = input.items.map((item) => {
      const product = db.select().from(products).where(eq(products.id, item.productId)).get()
      if (!product) throw new Error(`Product ${item.productId} not found`)
      if (item.quantity < 1) throw new Error('Quantity must be at least 1')

      let unitPrice = product.price
      let variantName: string | null = null
      if (item.variantId != null) {
        const variant = db.select().from(variants).where(eq(variants.id, item.variantId)).get()
        if (!variant || variant.productId !== product.id) throw new Error('Invalid variant')
        unitPrice = variant.price
        variantName = variant.name
      } else if (product.hasVariants) {
        throw new Error(`${product.name} requires a variant`)
      }

      return {
        productId: product.id,
        variantId: item.variantId ?? null,
        productName: product.name,
        variantName,
        unitPrice,
        quantity: Math.round(item.quantity),
        note: item.note?.trim() || null,
        lineTotal: unitPrice * Math.round(item.quantity)
      }
    })

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0)
    const discount = Math.round((subtotal * discountPercent) / 100)
    const total = subtotal - discount
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    const order = db
      .insert(orders)
      .values({
        userId: input.userId ?? null,
        orderNumber: nextOrderNumber(),
        orderType: input.orderType,
        tableId: input.orderType === 'dine_in' ? (input.tableId ?? null) : null,
        waiterId: input.orderType === 'dine_in' ? (input.waiterId ?? null) : null,
        status: input.markPaid ? 'paid' : 'pending',
        subtotal,
        discountPercent,
        discount,
        taxAmount: 0,
        total,
        note: input.note?.trim() || null,
        customerPhone: input.orderType === 'delivery' ? (input.customerPhone?.trim() || null) : null,
        customerAddress: input.orderType === 'delivery' ? (input.customerAddress?.trim() || null) : null,
        paidAt: input.markPaid ? now : null
      })
      .returning()
      .get()

    const savedItems = resolvedItems.map((item) =>
      db.insert(orderItems).values({ ...item, orderId: order.id }).returning().get()
    )

    // Update search ranking counters
    const bump = sqlite.prepare(
      `UPDATE products SET times_sold = times_sold + ?, last_sold_at = ? WHERE id = ?`
    )
    for (const item of resolvedItems) {
      bump.run(item.quantity, now, item.productId)
    }

    return { ...order, items: savedItems }
  })

  return tx()
}

export interface OrderListFilter {
  date?: string // YYYY-MM-DD
  status?: OrderStatus | 'all'
}

export function listOrders(filter: OrderListFilter = {}): OrderWithItems[] {
  const sqlite = getSqlite()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.date) {
    conditions.push(`date(created_at) = ?`)
    params.push(filter.date)
  }
  if (filter.status && filter.status !== 'all') {
    conditions.push(`status = ?`)
    params.push(filter.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderRows = sqlite
    .prepare(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT 500`)
    .all(...params) as Record<string, unknown>[]

  if (orderRows.length === 0) return []

  const ids = orderRows.map((o) => o.id as number)
  const itemRows = sqlite
    .prepare(
      `SELECT * FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')})`
    )
    .all(...ids) as Record<string, unknown>[]

  const itemsByOrder = new Map<number, Record<string, unknown>[]>()
  for (const item of itemRows) {
    const oid = item.order_id as number
    const arr = itemsByOrder.get(oid) ?? []
    arr.push(item)
    itemsByOrder.set(oid, arr)
  }

  const mapItem = (r: Record<string, unknown>): Record<string, unknown> => ({
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    variantId: r.variant_id,
    productName: r.product_name,
    variantName: r.variant_name,
    unitPrice: r.unit_price,
    quantity: r.quantity,
    note: r.note,
    lineTotal: r.line_total
  })

  return orderRows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    orderType: r.order_type,
    tableId: r.table_id,
    waiterId: r.waiter_id,
    status: r.status,
    subtotal: r.subtotal,
    discountPercent: r.discount_percent,
    discount: r.discount,
    taxAmount: r.tax_amount,
    total: r.total,
    note: r.note,
    customerPhone: r.customer_phone,
    customerAddress: r.customer_address,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    items: (itemsByOrder.get(r.id as number) ?? []).map(mapItem)
  })) as unknown as OrderWithItems[]
}

export function updateOrderStatus(id: number, status: OrderStatus): OrderWithItems {
  const db = getDb()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const changes: Record<string, unknown> = { status }
  if (status === 'paid') changes.paidAt = now
  const order = db.update(orders).set(changes).where(eq(orders.id, id)).returning().get()
  if (!order) throw new Error('Order not found')
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, id)).all()
  return { ...order, items }
}