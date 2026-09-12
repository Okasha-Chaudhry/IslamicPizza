import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '../db'
import { orders, orderItems, products, variants } from '../db/schema'
import { upsertCustomerOnOrder } from './customers.service'
import type {
  CreateOrderInput,
  OrderWithItems,
  OrderStatus,
  OrderType,
  OrderFilterTab,
  OrderPayment
} from '../../shared/types'

// Local time, to match created_at (SQLite datetime('now','localtime')).
function nowStamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

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
  const discountInput = Math.max(0, Math.round(input.discountAmount ?? 0))
  const deliveryChargeInput =
    input.orderType === 'delivery' ? Math.max(0, Math.round(input.deliveryCharge ?? 0)) : 0
  // Service charge is manual and applies to any order type.
  const serviceChargeInput = Math.max(0, Math.round(input.serviceCharge ?? 0))

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
    const discount = Math.min(discountInput, subtotal)
    const discountPercent = subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0
    const total = subtotal - discount + deliveryChargeInput + serviceChargeInput
    const now = nowStamp()

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
        deliveryCharge: deliveryChargeInput,
        serviceCharge: serviceChargeInput,
        amountPaid: input.markPaid ? total : 0,
        taxAmount: 0,
        total,
        note: input.note?.trim() || null,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.orderType === 'delivery' ? (input.customerPhone?.trim() || null) : null,
        customerAddress: input.orderType === 'delivery' ? (input.customerAddress?.trim() || null) : null,
        paidAt: input.markPaid ? now : null
      })
      .returning()
      .get()

    const savedItems = resolvedItems.map((item) =>
      db.insert(orderItems).values({ ...item, orderId: order.id }).returning().get()
    )

    if (input.markPaid && total > 0) {
      sqlite
        .prepare("INSERT INTO order_payments (order_id, amount, method, created_at) VALUES (?, ?, 'cash', ?)")
        .run(order.id, total, now)
    }

    // Update search ranking counters
    const bump = sqlite.prepare(
      `UPDATE products SET times_sold = times_sold + ?, last_sold_at = ? WHERE id = ?`
    )
    for (const item of resolvedItems) {
      bump.run(item.quantity, now, item.productId)
    }

    if (input.orderType === 'delivery' && input.customerPhone?.trim()) {
      upsertCustomerOnOrder({
        phone: input.customerPhone,
        name: input.customerName,
        address: input.customerAddress
      })
    }

    return { ...order, items: savedItems }
  })

  return tx()
}

export interface OrderListFilter {
  date?: string // YYYY-MM-DD
  status?: OrderFilterTab
}

export function listOrders(filter: OrderListFilter = {}): OrderWithItems[] {
  const sqlite = getSqlite()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.date) {
    conditions.push(`date(created_at) = ?`)
    params.push(filter.date)
  }
  // 'kitchen' is not a status - it means the kitchen slip has been printed.
  if (filter.status === 'kitchen') {
    conditions.push("kitchen_printed_at IS NOT NULL AND status = 'pending'")
  } else if (filter.status && filter.status !== 'all') {
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
    deliveryCharge: r.delivery_charge,
    taxAmount: r.tax_amount,
    total: r.total,
    note: r.note,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerAddress: r.customer_address,
    serviceCharge: r.service_charge,
    amountPaid: r.amount_paid,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    kitchenPrintedAt: r.kitchen_printed_at,
    items: (itemsByOrder.get(r.id as number) ?? []).map(mapItem)
  })) as unknown as OrderWithItems[]
}

export function updateOrderItems(input: {
  orderId: number
  discountAmount: number
  orderType?: OrderType
  tableId?: number | null
  waiterId?: number | null
  customerName?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  deliveryCharge?: number
  serviceCharge?: number
  note?: string
  items: { productId: number; variantId: number | null; quantity: number; note?: string }[]
}): OrderWithItems {
  if (!input.items || input.items.length === 0) throw new Error('Order has no items')
  const discountInput = Math.max(0, Math.round(input.discountAmount ?? 0))

  const db = getDb()
  const sqlite = getSqlite()

  const tx = sqlite.transaction((): OrderWithItems => {
    const existing = db.select().from(orders).where(eq(orders.id, input.orderId)).get()
    if (!existing) throw new Error('Order not found')
    if (existing.status !== 'pending') {
      throw new Error('Only unpaid orders can be edited')
    }

    // Reverse old timesSold
    const oldItems = db.select().from(orderItems).where(eq(orderItems.orderId, input.orderId)).all()
    const unbump = sqlite.prepare(
      `UPDATE products SET times_sold = MAX(0, times_sold - ?) WHERE id = ?`
    )
    for (const item of oldItems) {
      unbump.run(item.quantity, item.productId)
    }

    db.delete(orderItems).where(eq(orderItems.orderId, input.orderId)).run()

    // Resolve new items from DB (same as create)
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
        orderId: input.orderId,
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
    const discount = Math.min(discountInput, subtotal)
    const discountPercent = subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0
    const newOrderType: OrderType = input.orderType ?? (existing.orderType as OrderType)
    const deliveryChargeInput =
      newOrderType === 'delivery' ? Math.max(0, Math.round(input.deliveryCharge ?? 0)) : 0
    const serviceChargeInput = Math.max(0, Math.round(input.serviceCharge ?? existing.serviceCharge))
    const total = subtotal - discount + deliveryChargeInput + serviceChargeInput
    const now = nowStamp()

    const savedItems = resolvedItems.map((item) =>
      db.insert(orderItems).values(item).returning().get()
    )

    const bump = sqlite.prepare(
      `UPDATE products SET times_sold = times_sold + ?, last_sold_at = ? WHERE id = ?`
    )
    for (const item of resolvedItems) {
      bump.run(item.quantity, now, item.productId)
    }

    const order = db
      .update(orders)
      .set({
        orderType: newOrderType,
        customerName: input.customerName?.trim() ?? existing.customerName ?? null,
        tableId: newOrderType === 'dine_in' ? (input.tableId ?? existing.tableId ?? null) : null,
        waiterId: newOrderType === 'dine_in' ? (input.waiterId ?? existing.waiterId ?? null) : null,
        customerPhone:
          newOrderType === 'delivery'
            ? (input.customerPhone?.trim() ?? existing.customerPhone ?? null)
            : null,
        customerAddress:
          newOrderType === 'delivery'
            ? (input.customerAddress?.trim() ?? existing.customerAddress ?? null)
            : null,
        subtotal,
        discountPercent,
        discount,
        deliveryCharge: deliveryChargeInput,
        serviceCharge: serviceChargeInput,
        total,
        note: input.note?.trim() || existing.note
      })
      .where(eq(orders.id, input.orderId))
      .returning()
      .get()

    return { ...order, items: savedItems }
  })

  return tx()
}

function withItems(id: number): OrderWithItems {
  const db = getDb()
  const order = db.select().from(orders).where(eq(orders.id, id)).get()
  if (!order) throw new Error('Order not found')
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, id)).all()
  return { ...order, items } as unknown as OrderWithItems
}

// Marking an order paid settles whatever is still owed, and records that
// settlement as a payment so the money trail stays complete.
export function updateOrderStatus(id: number, status: OrderStatus): OrderWithItems {
  const db = getDb()
  const sqlite = getSqlite()
  const now = nowStamp()

  const tx = sqlite.transaction((): OrderWithItems => {
    const existing = db.select().from(orders).where(eq(orders.id, id)).get()
    if (!existing) throw new Error('Order not found')

    const changes: Record<string, unknown> = { status }
    if (status === 'paid') {
      const owed = Math.max(0, existing.total - existing.amountPaid)
      if (owed > 0) {
        sqlite
          .prepare(
            "INSERT INTO order_payments (order_id, amount, method, created_at) VALUES (?, ?, 'cash', ?)"
          )
          .run(id, owed, now)
      }
      changes.amountPaid = existing.total
      changes.paidAt = now
    }
    db.update(orders).set(changes).where(eq(orders.id, id)).run()
    return withItems(id)
  })

  return tx()
}

// Kitchen printing is a timestamp, not a status: an order stays unpaid until
// the money is actually collected, which is what the client tracks by.
export function markKitchenPrinted(id: number): OrderWithItems {
  const db = getDb()
  const existing = db.select().from(orders).where(eq(orders.id, id)).get()
  if (!existing) throw new Error('Order not found')
  if (!existing.kitchenPrintedAt) {
    db.update(orders).set({ kitchenPrintedAt: nowStamp() }).where(eq(orders.id, id)).run()
  }
  return withItems(id)
}

// Part payment: records what the customer actually handed over. The order only
// flips to paid once the running total covers the bill.
export function addOrderPayment(input: {
  orderId: number
  amount: number
  method?: string
  note?: string
}): OrderWithItems {
  const amount = Math.round(input.amount)
  if (amount <= 0) throw new Error('Payment must be greater than zero')

  const db = getDb()
  const sqlite = getSqlite()
  const now = nowStamp()

  const tx = sqlite.transaction((): OrderWithItems => {
    const existing = db.select().from(orders).where(eq(orders.id, input.orderId)).get()
    if (!existing) throw new Error('Order not found')
    if (existing.status === 'cancelled') throw new Error('Order is cancelled')

    const owed = Math.max(0, existing.total - existing.amountPaid)
    if (owed === 0) throw new Error('Order is already fully paid')
    if (amount > owed) throw new Error('Only Rs ' + owed + ' is outstanding on this order')

    sqlite
      .prepare(
        'INSERT INTO order_payments (order_id, amount, method, note, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.orderId, amount, input.method?.trim() || 'cash', input.note?.trim() || null, now)

    const paidNow = existing.amountPaid + amount
    const settled = paidNow >= existing.total
    db.update(orders)
      .set({
        amountPaid: paidNow,
        status: settled ? 'paid' : existing.status,
        paidAt: settled ? now : existing.paidAt
      })
      .where(eq(orders.id, input.orderId))
      .run()

    return withItems(input.orderId)
  })

  return tx()
}

export function listOrderPayments(orderId: number): OrderPayment[] {
  return getSqlite()
    .prepare(
      'SELECT id, order_id as orderId, amount, method, note, created_at as createdAt FROM order_payments WHERE order_id = ? ORDER BY id ASC'
    )
    .all(orderId) as OrderPayment[]
}

// Everything still owed, newest first, for the customer-ledger screen.
export function listUnpaidOrders(query?: string): OrderWithItems[] {
  const sqlite = getSqlite()
  const params: unknown[] = []
  let where = "WHERE status = 'pending' AND amount_paid < total"
  if (query?.trim()) {
    // One box searches both: a takeaway customer has no phone, so the name is
    // the only way to find what they still owe.
    where += ' AND (customer_phone LIKE ? OR customer_name LIKE ?)'
    const q = '%' + query.trim() + '%'
    params.push(q, q)
  }
  const rows = sqlite
    .prepare('SELECT id FROM orders ' + where + ' ORDER BY id DESC LIMIT 500')
    .all(...params) as { id: number }[]
  return rows.map((r) => withItems(r.id))
}