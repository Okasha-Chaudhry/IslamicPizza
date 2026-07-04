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