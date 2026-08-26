import { app } from 'electron'
import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import { PosPrinter } from 'electron-pos-printer'
import { join } from 'path'
import { existsSync } from 'fs'
import type { OrderWithItems, AppSettings } from '../../shared/types'
import { getSettings } from '../services/settings.service'
import { getDb } from '../db'
import { products, kitchenSections } from '../db/schema'
import { hasUrdu, renderItemRow } from './urdu-print'

interface Names {
  tableName?: string
  waiterName?: string
  servedBy?: string
}

interface Layout {
  width: number
  qtyW: number
  amtW: number
}

function layout(settings: AppSettings): Layout {
  // If the client set an explicit characters-per-line (for a printer whose
  // width differs from the 48/32 norm), use it. 0 = auto from paper width.
  const override = settings.charsPerLine
  const width = override && override > 0 ? override : settings.receiptWidth === '58' ? 32 : 48
  // Scale the qty/amount columns to the width so 58mm, 80mm, and odd widths all align.
  const amtW = Math.max(6, Math.round(width * 0.21))
  const qtyW = Math.max(3, Math.round(width * 0.1))
  return { width, qtyW, amtW }
}

function resourcePath(file: string): string {
  const devPath = join(process.cwd(), 'resources', file)
  if (existsSync(devPath)) return devPath
  const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'resources', file)
  if (existsSync(unpacked)) return unpacked
  return join(process.resourcesPath, 'resources', file)
}

// Resolve a user-uploaded image (logo/qr) saved in userData.
// Accepts either a bare filename (new) or a full path (legacy). Returns '' if missing.
function userImagePath(stored: string): string {
  if (!stored) return ''
  if (existsSync(stored)) return stored // legacy full path still on disk
  const inUserData = join(app.getPath('userData'), stored)
  if (existsSync(inUserData)) return inUserData
  // legacy: full path saved but only the filename survives
  const base = stored.split(/[\\/]/).pop() || stored
  const byBase = join(app.getPath('userData'), base)
  if (existsSync(byBase)) return byBase
  return ''
}

// Feed a few lines then full-cut. More reliable than .cut() on some printers.
function cutPaper(printer: ThermalPrinter): void {
  printer.add(Buffer.from([0x0a, 0x0a, 0x0a, 0x0a])) // feed 4 lines
  printer.add(Buffer.from([0x1d, 0x56, 0x00])) // GS V 0 = full cut
}

function makePrinter(width: number): ThermalPrinter {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'buffer',
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: false,
    width,
    lineCharacter: '-'
  })
  // Force a known state on EVERY printer (Bixolon, Black Copper, Epson, etc.):
  // ESC @ = reset, ESC ! 0 = Font A normal, ESC SP 0 = zero char spacing.
  // This makes column math (48/32 chars) reliable across all ESC/POS printers.
  printer.add(Buffer.from([0x1b, 0x40])) // ESC @  (initialize)
  printer.add(Buffer.from([0x1b, 0x21, 0x00])) // ESC ! 0 (Font A, no bold/double)
  printer.add(Buffer.from([0x1b, 0x20, 0x00])) // ESC SP 0 (character spacing = 0)
  return printer
}

async function sendRaw(printerName: string, buffer: Buffer): Promise<void> {
  if (!printerName) throw new Error('No printer selected in Settings')
  // Pre-compiled native transport - no runtime C#/PowerShell compile.
  // Works on any Windows PC regardless of .NET SDK / activation state.
  await PosPrinter.sendRawCommand(printerName, buffer)
}

function money(n: number): string {
  return `Rs ${n}`
}

// Two-column row: label left, value right-aligned to full width.
// Guards against overflow so a line never exceeds the paper width (no cut/wrap).
function padRow(left: string, right: string, L: Layout): string {
  let l = left
  let r = right
  if (l.length + r.length + 1 > L.width) {
    const maxLeft = Math.max(1, L.width - r.length - 1)
    l = l.slice(0, maxLeft)
  }
  const space = Math.max(1, L.width - l.length - r.length)
  return l + ' '.repeat(space) + r
}

// Item line: name (left, wraps), qty (center col), amount (right col).
function itemLine(name: string, qty: number, amount: string, L: Layout): string {
  const nameW = L.width - L.qtyW - L.amtW
  const qtyStr = String(qty).padStart(Math.floor((L.qtyW + String(qty).length) / 2)).padEnd(L.qtyW)
  const amtStr = amount.padStart(L.amtW)
  const lines: string[] = []
  let remaining = name
  let first = true
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, nameW)
    remaining = remaining.slice(chunk.length)
    if (first) {
      lines.push(chunk.padEnd(nameW) + qtyStr + amtStr)
      first = false
    } else {
      lines.push(chunk)
    }
  }
  return lines.join('\n')
}

function itemHeader(L: Layout): string {
  const nameW = L.width - L.qtyW - L.amtW
  return 'Item'.padEnd(nameW) + 'Qty'.padStart(Math.floor((L.qtyW + 3) / 2)).padEnd(L.qtyW) + 'Amount'.padStart(L.amtW)
}

export async function printReceiptEscpos(
  order: OrderWithItems,
  settings: AppSettings,
  names: Names
): Promise<void> {
  const L = layout(settings)
  const printer = makePrinter(L.width)
  const contentsRows = getDb()
    .select({ id: products.id, contents: products.platterContents })
    .from(products)
    .all()
  const contentsByProduct = new Map<number, string | null>()
  for (const r of contentsRows) contentsByProduct.set(r.id, r.contents)

  printer.alignCenter()
  const logoPath = userImagePath(settings.receiptLogo)
  if (logoPath) {
    try {
      await printer.printImage(logoPath)
    } catch {
      // logo failed, skip
    }
  }
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println(settings.restaurantName || 'Restaurant')
  printer.setTextNormal()
  if (settings.receiptHeader) {
    printer.bold(true)
    printer.println(settings.receiptHeader)
    printer.bold(false)
  }
  if (settings.address) printer.println(settings.address)
  if (settings.phone) printer.println(settings.phone)
  printer.drawLine()

  printer.alignLeft()
  const typeLabel =
    order.orderType === 'dine_in' ? 'DINE IN' : order.orderType === 'delivery' ? 'DELIVERY' : 'TAKE AWAY'
  printer.println(`${typeLabel}   #${order.orderNumber}`)
  printer.println(new Date(order.createdAt).toLocaleString())
  if (names.tableName) printer.println(`Table: ${names.tableName}`)
  if (names.waiterName) printer.println(`Waiter: ${names.waiterName}`)
  if (names.servedBy) printer.println(`Served by: ${names.servedBy}`)
  if (order.customerPhone) printer.println(`Phone: ${order.customerPhone}`)
  if (order.customerAddress) printer.println(`Address: ${order.customerAddress}`)
  printer.drawLine()

  printer.bold(true)
  printer.add(Buffer.from([0x1b, 0x47, 0x01]))
  printer.println(itemHeader(L))
  printer.add(Buffer.from([0x1b, 0x47, 0x00]))
  printer.bold(false)
  printer.drawLine()
  for (const item of order.items) {
    const name = item.variantName ? item.productName + ' (' + item.variantName + ')' : item.productName
    if (hasUrdu(name)) {
      const buf = renderItemRow({
        name,
        qty: item.quantity,
        amount: money(item.lineTotal),
        widthDots: L.width * 12,
        fontSize: 30
      })
      await printer.printImageBuffer(buf)
    } else {
      printer.println(itemLine(name, item.quantity, money(item.lineTotal), L))
    }
    const contents = contentsByProduct.get(item.productId)
    if (contents) {
      for (const line of contents.split(',')) {
        const t = line.trim()
        if (t) printer.println('  - ' + t)
      }
    }
  }
  printer.drawLine()

  if (order.discount > 0 || order.deliveryCharge > 0) {
    printer.println(padRow('Subtotal:', money(order.subtotal), L))
  }
  if (order.discount > 0) {
    printer.println(padRow('Discount:', '-' + money(order.discount), L))
  }
  if (order.deliveryCharge > 0) {
    printer.println(padRow('Delivery:', '+' + money(order.deliveryCharge), L))
  }
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println(padRow('TOTAL:', money(order.total), L))
  printer.setTextNormal()
  printer.bold(false)

  printer.alignCenter()
  printer.drawLine()
  if (settings.receiptFooter) printer.println(settings.receiptFooter)
  printer.newLine()
  printer.newLine()
  try {
    await printer.printImage(resourcePath('xiom-logo-print.png'))
  } catch {
    printer.println('Powered by XIOM')
  }
  printer.println('0310-1617048')
  cutPaper(printer)

  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}

export async function printKitchenEscpos(
  order: OrderWithItems,
  settings: AppSettings,
  names: Names
): Promise<void> {
  const printerName = settings.kitchenPrinter || settings.defaultPrinter
  const L = layout(settings)

  const db = getDb()
  const sectionRows = db
    .select({
      id: products.id,
      sectionId: products.kitchenSectionId,
      contents: products.platterContents
    })
    .from(products)
    .all()
  const sectionByProduct = new Map<number, number | null>()
  const contentsByProduct = new Map<number, string | null>()
  for (const r of sectionRows) {
    sectionByProduct.set(r.id, r.sectionId)
    contentsByProduct.set(r.id, r.contents)
  }

  const sectionList = db.select().from(kitchenSections).all()
  const sectionNameById = new Map<number, string>()
  for (const s of sectionList) sectionNameById.set(s.id, s.name)

  const groups = new Map<number, typeof order.items>()
  for (const item of order.items) {
    const sid = sectionByProduct.get(item.productId) ?? 0
    const key = sid ?? 0
    const arr = groups.get(key) ?? []
    arr.push(item)
    groups.set(key, arr)
  }

  const typeLabel =
    order.orderType === 'dine_in' ? 'DINE IN' : order.orderType === 'delivery' ? 'DELIVERY' : 'TAKE AWAY'

  for (const [sid, items] of groups) {
    const sectionName = sid && sid > 0 ? sectionNameById.get(sid) : null
    const printer = makePrinter(L.width)
    printer.alignCenter()
    printer.bold(true)
    printer.setTextSize(1, 1)
    printer.println('KITCHEN')
    if (sectionName) printer.println('[ ' + sectionName + ' ]')
    printer.println(typeLabel + '  #' + order.orderNumber)
    printer.setTextNormal()
    printer.bold(false)
    printer.println(new Date(order.createdAt).toLocaleString())
    if (names.tableName) printer.println('Table: ' + names.tableName)
    printer.drawLine()

    printer.alignLeft()
    for (const item of items) {
      const name = item.variantName
        ? item.productName + ' (' + item.variantName + ')'
        : item.productName
      if (hasUrdu(name)) {
        const buf = renderItemRow({
          name,
          qty: String(item.quantity) + ' x',
          widthDots: L.width * 12,
          fontSize: 40,
          bold: true
        })
        await printer.printImageBuffer(buf)
      } else {
        printer.bold(true)
        printer.setTextSize(1, 1)
        printer.println(item.quantity + ' x ' + name)
        printer.setTextNormal()
        printer.bold(false)
      }
      const contents = contentsByProduct.get(item.productId)
      if (contents) {
        for (const line of contents.split(',')) {
          const t = line.trim()
          if (t) printer.println('    - ' + t)
        }
      }
      if (item.note) printer.println('    * ' + item.note)
    }
    cutPaper(printer)
    await sendRaw(printerName, printer.getBuffer())
  }
}

export async function printReportEscpos(
  report: {
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
  },
  settings: AppSettings
): Promise<void> {
  const L = layout(settings)
  const printer = makePrinter(L.width)
  const s = report.summary
  const range = report.from === report.to ? report.from : `${report.from} to ${report.to}`

  printer.alignCenter()
  printer.bold(true)
  printer.println('SALES REPORT')
  printer.println(settings.restaurantName || 'Restaurant')
  printer.bold(false)
  printer.println(range)
  printer.drawLine()

  printer.alignLeft()
  printer.println(padRow('Paid Orders:', String(s.paidOrders), L))
  printer.bold(true)
  printer.println(padRow('Revenue:', money(s.paidRevenue), L))
  printer.bold(false)
  printer.println(padRow('Avg Order:', money(s.avgOrderValue), L))
  printer.println(padRow('Discounts:', money(s.totalDiscount), L))
  printer.println(padRow('Unpaid:', s.pendingOrders + ' (' + money(s.pendingAmount) + ')', L))
  printer.println(padRow('Cancelled:', String(s.cancelledOrders), L))
  printer.drawLine()

  printer.bold(true)
  printer.println('TOP ITEMS')
  printer.println(itemHeader(L))
  printer.bold(false)
  printer.drawLine()
  for (const p of report.popular) {
    const name = p.variantName ? p.productName + ' (' + p.variantName + ')' : p.productName
    if (hasUrdu(name)) {
      const buf = renderItemRow({
        name,
        qty: p.quantity,
        amount: money(p.revenue),
        widthDots: L.width * 12,
        fontSize: 28
      })
      await printer.printImageBuffer(buf)
    } else {
      printer.println(itemLine(name, p.quantity, money(p.revenue), L))
    }
  }
  printer.drawLine()

  printer.alignCenter()
  printer.println(`Printed: ${new Date().toLocaleString()}`)
  cutPaper(printer)

  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}

export async function testPrintEscpos(printerName: string): Promise<void> {
  const settings = getSettings()
  const L = layout(settings)
  const printer = makePrinter(L.width)

  printer.alignCenter()
  printer.bold(true)
  printer.println('PRINTER TEST')
  printer.bold(false)
  printer.println(`Paper: ${settings.receiptWidth}mm  Width: ${L.width} chars`)
  printer.println(new Date().toLocaleString())
  printer.drawLine()

  // Width ruler: the last digit should sit exactly at the right edge.
  // If it wraps or gets cut, this printer's real width differs from L.width.
  printer.alignLeft()
  printer.println('Column width check:')
  let ruler = ''
  for (let i = 1; i <= L.width; i++) ruler += String(i % 10)
  printer.println(ruler)

  // Sample 3-column rows - these should line up perfectly.
  printer.drawLine()
  printer.println(itemHeader(L))
  printer.drawLine()
  printer.println(itemLine('Short item', 1, money(250), L))
  printer.println(itemLine('A much longer product name that wraps', 2, money(1500), L))
  printer.drawLine()
  printer.println(padRow('TOTAL:', money(1750), L))
  printer.drawLine()

  printer.alignCenter()
  printer.println('If columns line up, printer is OK')
  printer.println('Powered by XIOM')
  cutPaper(printer)
  await sendRaw(printerName, printer.getBuffer())
}

export async function rawTestPrint(text: string): Promise<void> {
  const settings = getSettings()
  const L = layout(settings)
  const printer = makePrinter(L.width)
  for (const line of text.split('\n')) printer.println(line)
  cutPaper(printer)
  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}