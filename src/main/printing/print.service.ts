import { BrowserWindow } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { restaurantTables, waiters } from '../db/schema'
import { getSettings } from '../services/settings.service'
import { buildReceiptHtml } from './receipt-template'
import type { OrderWithItems } from '../../shared/types'

function printHtml(html: string, printerName: string, pageWidthMm: number): Promise<void> {
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
          pageSize: {
            width: Math.round(pageWidthMm * 1000),
            height: 297000
          }
        },
        (success, failureReason) => {
          cleanup()
          if (success) resolve()
          else reject(new Error(failureReason || 'Print failed'))
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

function resolveNames(order: OrderWithItems): { tableName?: string; waiterName?: string } {
  const db = getDb()
  const out: { tableName?: string; waiterName?: string } = {}
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

export async function printTest(): Promise<void> {
  const settings = getSettings()
  const widthMm = settings.receiptWidth === '58' ? 58 : settings.receiptWidth === '80' ? 80 : 210
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Courier New', monospace; font-size: 12px; padding: 2mm; width: ${widthMm === 58 ? '44mm' : widthMm === 80 ? '64mm' : '190mm'}; }
    .c { text-align: center; }
  </style></head><body>
    <div class="c"><b>PRINTER TEST</b></div>
    <div class="c">${settings.restaurantName}</div>
    <div class="c">${new Date().toLocaleString()}</div>
    <div class="c">Printer: ${settings.defaultPrinter || 'System default'}</div>
    <div class="c">--- If you can read this, printing works ---</div>
  </body></html>`
  await printHtml(html, settings.defaultPrinter, widthMm)
}

export async function printReceipt(order: OrderWithItems): Promise<void> {
  const settings = getSettings()
  const widthMm = settings.receiptWidth === '58' ? 58 : settings.receiptWidth === '80' ? 80 : 210
  const html = buildReceiptHtml(order, settings, 'receipt', resolveNames(order))
  await printHtml(html, settings.defaultPrinter, widthMm)
}

export async function printKitchenSlip(order: OrderWithItems): Promise<void> {
  const settings = getSettings()
  const widthMm = settings.receiptWidth === '58' ? 58 : settings.receiptWidth === '80' ? 80 : 210
  const html = buildReceiptHtml(order, settings, 'kitchen', resolveNames(order))
  const printer = settings.kitchenPrinter || settings.defaultPrinter
  await printHtml(html, printer, widthMm)
}