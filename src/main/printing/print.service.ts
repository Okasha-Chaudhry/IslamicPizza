import {
  printReceiptEscpos,
  printKitchenEscpos,
  testPrintEscpos,
  printReportEscpos,
  rawTestPrint as rawTestPrintEscpos
} from './escpos-print.service'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { restaurantTables, waiters, users } from '../db/schema'
import { getSettings } from '../services/settings.service'
import type { OrderWithItems } from '../../shared/types'

function resolveNames(order: OrderWithItems): {
  tableName?: string
  waiterName?: string
  servedBy?: string
} {
  const db = getDb()
  const out: { tableName?: string; waiterName?: string; servedBy?: string } = {}
  if (order.userId != null) {
    const u = db.select().from(users).where(eq(users.id, order.userId)).get()
    if (u) out.servedBy = u.name
  }
  if (order.tableId != null) {
    const t = db.select().from(restaurantTables).where(eq(restaurantTables.id, order.tableId)).get()
    if (t) out.tableName = t.name
  }
  if (order.waiterId != null) {
    const w = db.select().from(waiters).where(eq(waiters.id, order.waiterId)).get()
    if (w) out.waiterName = w.name
  }
  return out
}

export async function printReport(report: {
  from: string
  to: string
  summary: {
    paidOrders: number
    paidRevenue: number
    pendingOrders: number
    pendingAmount: number
    cancelledOrders: number
    totalDiscount: number
    avgOrderValue: number
  }
  popular: { productName: string; variantName: string | null; quantity: number; revenue: number }[]
  bySection?: { sectionName: string; productName: string; variantName: string | null; quantity: number; revenue: number }[]
  sectionSummaryOnly?: boolean
}): Promise<void> {
  const settings = getSettings()
  await printReportEscpos(report, settings)
}

export async function printTest(): Promise<void> {
  const settings = getSettings()
  await testPrintEscpos(settings.defaultPrinter)
}

export async function printReceipt(order: OrderWithItems): Promise<void> {
  const settings = getSettings()
  await printReceiptEscpos(order, settings, resolveNames(order))
}

export async function printKitchenSlip(order: OrderWithItems): Promise<void> {
  const settings = getSettings()
  await printKitchenEscpos(order, settings, resolveNames(order))
}
export async function rawTestPrint(text: string): Promise<void> {
  await rawTestPrintEscpos(text)
}
