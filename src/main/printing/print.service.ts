import { BrowserWindow, dialog } from 'electron'
import {
  printReceiptEscpos,
  printKitchenEscpos,
  testPrintEscpos,
  printReportEscpos
} from './escpos-print.service'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { restaurantTables, waiters, users } from '../db/schema'
import { getSettings } from '../services/settings.service'
import type { OrderWithItems } from '../../shared/types'

function printHtml(html: string, printerName: string, _pageWidthMm: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true }
    })

    const cleanup = (): void => {
      if (!win.isDestroyed()) win.destroy()
    }

    win.webContents.on('did-finish-load', () => {
      win.webContents.print(
        {
          silent: true,
          deviceName: printerName || undefined,
          margins: { marginType: 'none' },
          pageSize: { width: 80000, height: 297000 },
          scaleFactor: 100
        },
        (success, failureReason) => {
          cleanup()
          if (success) resolve()
          else {
            dialog.showErrorBox('Print Failed', `Printer: ${printerName || 'default'}\nReason: ${failureReason || 'unknown'}`)
            reject(new Error(failureReason || 'Print failed'))
          }
        }
      )
    })

    win.webContents.on('did-fail-load', (_e, _code, desc) => {
      cleanup()
      reject(new Error(`Failed to render receipt: ${desc}`))
    })

    void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  })
}

function resolveNames(order: OrderWithItems): { tableName?: string; waiterName?: string; servedBy?: string } {
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