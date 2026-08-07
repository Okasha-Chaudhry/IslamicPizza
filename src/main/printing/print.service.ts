import { BrowserWindow, dialog } from 'electron'
import {
  printReceiptEscpos,
  printKitchenEscpos,
  testPrintEscpos
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
  const widthMm = settings.receiptWidth === '58' ? 58 : settings.receiptWidth === '80' ? 80 : 210
  const pageWidth = widthMm === 58 ? '44mm' : widthMm === 80 ? '64mm' : '190mm'
  const cur = settings.currency
  const s = report.summary
  const rangeLabel = report.from === report.to ? report.from : `${report.from} to ${report.to}`

  const popularRows = report.popular
    .map(
      (p) =>
        `<tr><td>${p.productName}${p.variantName ? ` (${p.variantName})` : ''}</td>
        <td class="num">${p.quantity}</td><td class="num">${p.revenue}</td></tr>`
    )
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; }
    body { font-family: 'Courier New', monospace; font-size: 11px; width: ${pageWidth}; padding: 1mm 2mm 1mm 0; color: #000; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .big { font-size: 1.4em; }
    .rule { border-top: 1px dashed #000; margin: 2mm 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 0.5mm 0; vertical-align: top; }
    td.num { text-align: right; white-space: nowrap; padding-left: 2mm; }
  </style></head><body>
    <div class="c b big">SALES REPORT</div>
    <div class="c">${settings.restaurantName}</div>
    <div class="c">${rangeLabel}</div>
    <div class="rule"></div>
    <table>
      <tr><td>Paid Orders</td><td class="num">${s.paidOrders}</td></tr>
      <tr class="b"><td>Revenue</td><td class="num">${cur} ${s.paidRevenue}</td></tr>
      <tr><td>Avg Order</td><td class="num">${cur} ${s.avgOrderValue}</td></tr>
      <tr><td>Discounts Given</td><td class="num">${cur} ${s.totalDiscount}</td></tr>
      <tr><td>Unpaid Orders</td><td class="num">${s.pendingOrders} (${cur} ${s.pendingAmount})</td></tr>
      <tr><td>Cancelled</td><td class="num">${s.cancelledOrders}</td></tr>
    </table>
    <div class="rule"></div>
    <div class="b">TOP ITEMS</div>
    <table>
      <tr class="b"><td>Item</td><td class="num">Qty</td><td class="num">${cur}</td></tr>
      ${popularRows}
    </table>
    <div class="rule"></div>
    <div class="c">Printed: ${new Date().toLocaleString()}</div>
  </body></html>`
  await printHtml(html, settings.defaultPrinter, widthMm)
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