import {
  printReceiptEscpos,
  printKitchenEscpos,
  testPrintEscpos,
  printReportEscpos,
  rawTestPrint as rawTestPrintEscpos
} from './escpos-print.service'
import { BrowserWindow, dialog } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { restaurantTables, waiters, users } from '../db/schema'
import { getSettings } from '../services/settings.service'
import { buildReceiptHtml } from './receipt-template'
import type { OrderWithItems } from '../../shared/types'

// Render through the Windows driver instead of sending raw ESC/POS. Needed on
// machines where the printer only works via its own driver, and on printers
// that refuse raw bytes. No pageSize is set: the driver's own roll size is
// used, which is what stops older units printing blank pages.
function printHtml(html: string, printerName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    const cleanup = (): void => {
      if (!win.isDestroyed()) win.destroy()
    }
    win.webContents.on('did-finish-load', () => {
      win.webContents.print(
        {
          silent: true,
          deviceName: printerName || undefined,
          margins: { marginType: 'none' },
          scaleFactor: 100
        },
        (success, failureReason) => {
          cleanup()
          if (success) resolve()
          else reject(new Error(failureReason || 'Windows driver refused the job'))
        }
      )
    })
    win.webContents.on('did-fail-load', (_e, _code, desc) => {
      cleanup()
      reject(new Error('Failed to render receipt: ' + desc))
    })
    void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  })
}

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
}): Promise<void> {
  const settings = getSettings()
  await printReportEscpos(report, settings)
}

export async function printTest(): Promise<void> {
  const settings = getSettings()
  if (settings.printMethod === 'driver') {
    const html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
      'body{font-family:"Courier New",monospace;font-size:12px;padding:2mm 0;font-weight:600}' +
      '.c{text-align:center}.bar{border:1px solid #000;height:4mm}</style></head><body>' +
      '<div class="c"><b>PRINTER TEST</b></div>' +
      '<div class="c">Windows driver method</div>' +
      '<div class="c">' + new Date().toLocaleString() + '</div>' +
      '<div>Full width bar - should touch both edges:</div><div class="bar"></div>' +
      '<div class="c">If the bar spans the paper, width is correct</div>' +
      '</body></html>'
    await printHtml(html, settings.defaultPrinter)
    return
  }
  await testPrintEscpos(settings.defaultPrinter)
}

export async function printReceipt(order: OrderWithItems): Promise<void> {
  const settings = getSettings()
  if (settings.printMethod === 'driver') {
    await printHtml(buildReceiptHtml(order, settings, 'receipt', resolveNames(order)), settings.defaultPrinter)
    return
  }
  await printReceiptEscpos(order, settings, resolveNames(order))
}

export async function printKitchenSlip(order: OrderWithItems): Promise<void> {
  const settings = getSettings()
  if (settings.printMethod === 'driver') {
    const printer = settings.kitchenPrinter || settings.defaultPrinter
    await printHtml(buildReceiptHtml(order, settings, 'kitchen', resolveNames(order)), printer)
    return
  }
  await printKitchenEscpos(order, settings, resolveNames(order))
}

export async function rawTestPrint(text: string): Promise<void> {
  await rawTestPrintEscpos(text)
}

// Used by the Settings screen so the driver route can be tried like the raw
// ones, and its failure reported the same way.
export async function testDriverMethod(): Promise<{ ok: boolean; detail: string }> {
  try {
    await printTestDriver()
    return { ok: true, detail: 'Sent - check the printer' }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'Failed' }
  }
}

async function printTestDriver(): Promise<void> {
  const settings = getSettings()
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:"Courier New",monospace;font-size:12px;padding:2mm 0;font-weight:600}' +
    '.c{text-align:center}.bar{border:1px solid #000;height:4mm}</style></head><body>' +
    '<div class="c"><b>PRINT METHOD TEST</b></div>' +
    '<div class="c">DRIVER</div>' +
    '<div class="c">' + new Date().toLocaleString() + '</div>' +
    '<div class="bar"></div>' +
    '<div class="c">If this came out, this method works</div>' +
    '</body></html>'
  await printHtml(html, settings.defaultPrinter)
}

// Kept so a failed print can still surface to the user on screen.
export function showPrintError(printerName: string, reason: string): void {
  dialog.showErrorBox('Print Failed', 'Printer: ' + (printerName || 'default') + '\nReason: ' + reason)
}