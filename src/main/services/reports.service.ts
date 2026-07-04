import { getSqlite } from '../db'

export interface ReportFilter {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD (inclusive)
}

export interface SalesSummary {
  paidOrders: number
  paidRevenue: number
  pendingOrders: number
  pendingAmount: number
  cancelledOrders: number
  totalDiscount: number
  avgOrderValue: number
}

export interface PopularProduct {
  productName: string
  variantName: string | null
  quantity: number
  revenue: number
}

export interface DailySales {
  date: string
  orders: number
  revenue: number
}

export interface SalesReport {
  from: string
  to: string
  summary: SalesSummary
  popular: PopularProduct[]
  daily: DailySales[]
}

export function getSalesReport(filter: ReportFilter): SalesReport {
  const sqlite = getSqlite()
  const { from, to } = filter
  if (!from || !to) throw new Error('Date range is required')
  if (from > to) throw new Error('From date must be before To date')

  const summaryRow = sqlite
    .prepare(
      `SELECT
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paidOrders,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total END), 0) AS paidRevenue,
        COUNT(CASE WHEN status IN ('pending', 'kitchen_printed') THEN 1 END) AS pendingOrders,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'kitchen_printed') THEN total END), 0) AS pendingAmount,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelledOrders,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN discount END), 0) AS totalDiscount
      FROM orders
      WHERE date(created_at) BETWEEN ? AND ?`
    )
    .get(from, to) as Omit<SalesSummary, 'avgOrderValue'>

  const avgOrderValue =
    summaryRow.paidOrders > 0 ? Math.round(summaryRow.paidRevenue / summaryRow.paidOrders) : 0

  const popular = sqlite
    .prepare(
      `SELECT
        oi.product_name AS productName,
        oi.variant_name AS variantName,
        SUM(oi.quantity) AS quantity,
        SUM(oi.line_total) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid' AND date(o.created_at) BETWEEN ? AND ?
      GROUP BY oi.product_name, oi.variant_name
      ORDER BY quantity DESC, revenue DESC
      LIMIT 15`
    )
    .all(from, to) as PopularProduct[]

  const daily = sqlite
    .prepare(
      `SELECT
        date(created_at) AS date,
        COUNT(*) AS orders,
        COALESCE(SUM(total), 0) AS revenue
      FROM orders
      WHERE status = 'paid' AND date(created_at) BETWEEN ? AND ?
      GROUP BY date(created_at)
      ORDER BY date`
    )
    .all(from, to) as DailySales[]

  return { from, to, summary: { ...summaryRow, avgOrderValue }, popular, daily }
}