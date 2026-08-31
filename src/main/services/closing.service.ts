import { getSqlite } from '../db'

export interface BusinessDay {
  id: number
  openedAt: string
  closedAt: string | null
  openingFloat: number
  status: 'open' | 'closed'
  zNumber: number | null
  totalOrders: number
  paidOrders: number
  totalRevenue: number
  totalDiscount: number
  expectedCash: number
  countedCash: number | null
  cashDifference: number | null
  note: string | null
}

const DAY_COLS = `
  id, opened_at AS openedAt, closed_at AS closedAt, opening_float AS openingFloat,
  status, z_number AS zNumber, total_orders AS totalOrders, paid_orders AS paidOrders,
  total_revenue AS totalRevenue, total_discount AS totalDiscount, expected_cash AS expectedCash,
  counted_cash AS countedCash, cash_difference AS cashDifference, note
`

export function getCurrentDay(): BusinessDay | null {
  const sqlite = getSqlite()
  const row = sqlite
    .prepare(`SELECT ${DAY_COLS} FROM business_days WHERE status = 'open' ORDER BY id DESC LIMIT 1`)
    .get() as BusinessDay | undefined
  return row ?? null
}

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

export function getCurrentDayTotals(): {
  day: BusinessDay | null
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  totalRevenue: number
  totalDiscount: number
  expectedCash: number
} {
  const sqlite = getSqlite()
  const day = getCurrentDay()
  if (!day) {
    return { day: null, totalOrders: 0, paidOrders: 0, pendingOrders: 0, totalRevenue: 0, totalDiscount: 0, expectedCash: 0 }
  }
  const t = sqlite
    .prepare(
      `SELECT
        COUNT(*) AS totalOrders,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paidOrders,
        COUNT(CASE WHEN status IN ('pending','kitchen_printed') THEN 1 END) AS pendingOrders,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total END), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN discount END), 0) AS totalDiscount
      FROM orders WHERE business_day_id = ?`
    )
    .get(day.id) as { totalOrders: number; paidOrders: number; pendingOrders: number; totalRevenue: number; totalDiscount: number }
  return { day, ...t, expectedCash: day.openingFloat + t.totalRevenue }
}

export function closeDay(countedCash: number, note?: string): BusinessDay {
  const sqlite = getSqlite()
  const totals = getCurrentDayTotals()
  if (!totals.day) throw new Error('No open business day to close')
  const zRow = sqlite.prepare(`SELECT COALESCE(MAX(z_number), 0) AS z FROM business_days WHERE status = 'closed'`).get() as { z: number }
  const zNumber = zRow.z + 1
  const counted = Math.round(countedCash || 0)
  const difference = counted - totals.expectedCash
  sqlite
    .prepare(
      `UPDATE business_days SET
        closed_at = datetime('now','localtime'), status = 'closed', z_number = ?,
        total_orders = ?, paid_orders = ?, total_revenue = ?, total_discount = ?,
        expected_cash = ?, counted_cash = ?, cash_difference = ?, note = ?
      WHERE id = ?`
    )
    .run(zNumber, totals.totalOrders, totals.paidOrders, totals.totalRevenue, totals.totalDiscount, totals.expectedCash, counted, difference, note ?? null, totals.day.id)
  return sqlite.prepare(`SELECT ${DAY_COLS} FROM business_days WHERE id = ?`).get(totals.day.id) as BusinessDay
}

export function getClosingHistory(limit = 30): BusinessDay[] {
  const sqlite = getSqlite()
  return sqlite.prepare(`SELECT ${DAY_COLS} FROM business_days WHERE status = 'closed' ORDER BY id DESC LIMIT ?`).all(limit) as BusinessDay[]
}