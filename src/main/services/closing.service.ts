import { getSqlite } from '../db'
import type { BusinessDay } from '../../shared/types'

const DAY_COLS = `
  id, opened_at AS openedAt, closed_at AS closedAt, opening_float AS openingFloat,
  status, z_number AS zNumber, total_orders AS totalOrders, paid_orders AS paidOrders,
  total_revenue AS totalRevenue, total_discount AS totalDiscount, expected_cash AS expectedCash,
  counted_cash AS countedCash, cash_difference AS cashDifference, note
`

export function getCurrentDay(): BusinessDay | null {
  const row = getSqlite()
    .prepare(`SELECT ${DAY_COLS} FROM business_days WHERE status = 'open' ORDER BY id DESC LIMIT 1`)
    .get() as BusinessDay | undefined
  return row ?? null
}

// Called automatically by the first order of a day, so the client never has to
// remember to start one. Passing a float is optional and only used if they do.
export function openDay(openingFloat: number): BusinessDay {
  const sqlite = getSqlite()
  const existing = getCurrentDay()
  if (existing) return existing
  const info = sqlite
    .prepare(`INSERT INTO business_days (opening_float) VALUES (?)`)
    .run(Math.round(openingFloat || 0))
  return sqlite
    .prepare(`SELECT ${DAY_COLS} FROM business_days WHERE id = ?`)
    .get(info.lastInsertRowid) as BusinessDay
}

// Money actually received counts, whether the order is fully settled or not -
// a part-paid order still put cash in the drawer.
function totalsFor(businessDayId: number): {
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  totalRevenue: number
  totalDiscount: number
  pendingAmount: number
  serviceCharges: number
} {
  return getSqlite()
    .prepare(
      `SELECT
        COUNT(*) AS totalOrders,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paidOrders,
        COUNT(CASE WHEN status = 'pending' AND amount_paid < total THEN 1 END) AS pendingOrders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN amount_paid END), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN discount END), 0) AS totalDiscount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN total - amount_paid END), 0) AS pendingAmount,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN service_charge END), 0) AS serviceCharges
      FROM orders WHERE business_day_id = ?`
    )
    .get(businessDayId) as {
    totalOrders: number
    paidOrders: number
    pendingOrders: number
    totalRevenue: number
    totalDiscount: number
    pendingAmount: number
    serviceCharges: number
  }
}

export function getCurrentDayTotals(): {
  day: BusinessDay | null
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  totalRevenue: number
  totalDiscount: number
  expectedCash: number
  pendingAmount: number
  serviceCharges: number
} {
  const day = getCurrentDay()
  if (!day) {
    return {
      day: null,
      totalOrders: 0,
      paidOrders: 0,
      pendingOrders: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      expectedCash: 0,
      pendingAmount: 0,
      serviceCharges: 0
    }
  }
  const t = totalsFor(day.id)
  return { day, ...t, expectedCash: day.openingFloat + t.totalRevenue }
}

// countedCash is optional: pass null to close without counting the drawer.
export function closeDay(countedCash: number | null, note?: string): BusinessDay {
  const sqlite = getSqlite()
  const day = getCurrentDay()
  if (!day) throw new Error('No open business day to close')
  const t = totalsFor(day.id)
  const expectedCash = day.openingFloat + t.totalRevenue
  const zRow = sqlite
    .prepare(`SELECT COALESCE(MAX(z_number), 0) AS z FROM business_days WHERE status = 'closed'`)
    .get() as { z: number }
  const counted = countedCash === null || countedCash === undefined ? null : Math.round(countedCash)
  const difference = counted === null ? null : counted - expectedCash
  sqlite
    .prepare(
      `UPDATE business_days SET
        closed_at = datetime('now','localtime'), status = 'closed', z_number = ?,
        total_orders = ?, paid_orders = ?, total_revenue = ?, total_discount = ?,
        expected_cash = ?, counted_cash = ?, cash_difference = ?, note = ?
      WHERE id = ?`
    )
    .run(
      zRow.z + 1,
      t.totalOrders,
      t.paidOrders,
      t.totalRevenue,
      t.totalDiscount,
      expectedCash,
      counted,
      difference,
      note ?? null,
      day.id
    )
  return sqlite.prepare(`SELECT ${DAY_COLS} FROM business_days WHERE id = ?`).get(day.id) as BusinessDay
}

export function getClosingHistory(limit = 30): BusinessDay[] {
  return getSqlite()
    .prepare(`SELECT ${DAY_COLS} FROM business_days WHERE status = 'closed' ORDER BY id DESC LIMIT ?`)
    .all(limit) as BusinessDay[]
}