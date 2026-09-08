import { getSqlite } from '../db'

export interface ReportFilter {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD (inclusive)
  // When set, the report covers exactly one business day instead of calendar
  // dates - so a day closed after midnight still reports as one day.
  businessDayId?: number
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

export interface SectionItemSales {
  sectionName: string
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
  bySection: SectionItemSales[]
  daily: DailySales[]
}

export function getSalesReport(filter: ReportFilter): SalesReport {
  const sqlite = getSqlite()
  const { from, to, businessDayId } = filter
  if (!businessDayId) {
    if (!from || !to) throw new Error('Date range is required')
    if (from > to) throw new Error('From date must be before To date')
  }
  // One WHERE clause shape for both modes, so every query below stays identical.
  const oScope = businessDayId ? 'business_day_id = ?' : 'date(created_at) BETWEEN ? AND ?'
  const jScope = businessDayId ? 'o.business_day_id = ?' : 'date(o.created_at) BETWEEN ? AND ?'
  const args: unknown[] = businessDayId ? [businessDayId] : [from, to]

  const summaryRow = sqlite
    .prepare(
      `SELECT
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paidOrders,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total END), 0) AS paidRevenue,
        COUNT(CASE WHEN status = 'pending' AND amount_paid < total THEN 1 END) AS pendingOrders,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN total - amount_paid END), 0) AS pendingAmount,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelledOrders,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN discount END), 0) AS totalDiscount
      FROM orders
      WHERE ${oScope}`
    )
    .get(...args) as Omit<SalesSummary, 'avgOrderValue'>

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
      WHERE o.status = 'paid' AND ${jScope}
      GROUP BY oi.product_name, oi.variant_name
      ORDER BY quantity DESC, revenue DESC
      LIMIT 15`
    )
    .all(...args) as PopularProduct[]

  const bySection = sqlite
    .prepare(
      `SELECT
        COALESCE(ks.name, 'No Section') AS sectionName,
        oi.product_name AS productName,
        oi.variant_name AS variantName,
        SUM(oi.quantity) AS quantity,
        SUM(oi.line_total) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN kitchen_sections ks ON ks.id = p.kitchen_section_id
      WHERE o.status != 'cancelled' AND ${jScope}
      GROUP BY sectionName, oi.product_name, oi.variant_name
      ORDER BY COALESCE(ks.sort_order, 999), sectionName, quantity DESC`
    )
    .all(...args) as SectionItemSales[]

  const daily = sqlite
    .prepare(
      `SELECT
        date(created_at) AS date,
        COUNT(*) AS orders,
        COALESCE(SUM(total), 0) AS revenue
      FROM orders
      WHERE status = 'paid' AND ${oScope}
      GROUP BY date(created_at)
      ORDER BY date`
    )
    .all(...args) as DailySales[]

  return { from, to, summary: { ...summaryRow, avgOrderValue }, popular, bySection, daily }
}