import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '../db'
import { customers } from '../db/schema'
import type { Customer } from '../../shared/types'

export function searchCustomers(query: string): Customer[] {
  const q = query.trim()
  if (q.length < 3) return []
  return getSqlite()
    .prepare(
      `SELECT id, name, phone, address, times_ordered AS timesOrdered,
              last_order_at AS lastOrderAt, created_at AS createdAt
       FROM customers
       WHERE phone LIKE ? OR LOWER(COALESCE(name,'')) LIKE LOWER(?)
       ORDER BY times_ordered DESC, last_order_at DESC
       LIMIT 6`
    )
    .all(`%${q}%`, `%${q}%`) as Customer[]
}

/** Called on order save (delivery with a phone). Creates or updates the customer. */
export function upsertCustomerOnOrder(input: {
  phone: string
  name?: string | null
  address?: string | null
}): void {
  const phone = input.phone.trim()
  if (!phone) return
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const db = getDb()
  const existing = db.select().from(customers).where(eq(customers.phone, phone)).get()
  if (existing) {
    db.update(customers)
      .set({
        name: input.name?.trim() || existing.name,
        address: input.address?.trim() || existing.address,
        timesOrdered: existing.timesOrdered + 1,
        lastOrderAt: now
      })
      .where(eq(customers.id, existing.id))
      .run()
  } else {
    db.insert(customers)
      .values({
        phone,
        name: input.name?.trim() || null,
        address: input.address?.trim() || null,
        timesOrdered: 1,
        lastOrderAt: now
      })
      .run()
  }
}