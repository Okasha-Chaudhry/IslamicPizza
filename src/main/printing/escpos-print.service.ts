import { app } from 'electron'
import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import { existsSync, writeFileSync, unlinkSync, appendFileSync } from 'fs'
import type { OrderWithItems, AppSettings } from '../../shared/types'
import { getSettings } from '../services/settings.service'

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

// Feed past the blade, then cut the way this printer actually supports.
// Both are settings because the gap and the cut command vary by model.
function cutPaper(printer: ThermalPrinter, settings: AppSettings): void {
  const lines = Math.max(0, Math.min(20, settings.cutFeedLines))
  if (lines > 0) printer.add(Buffer.from(new Array(lines).fill(0x0a)))
  if (settings.cutStyle === 'none') return
  printer.add(Buffer.from([0x1d, 0x56, settings.cutStyle === 'partial' ? 0x01 : 0x00]))
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

function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function logLine(text: string): void {
  try {
    appendFileSync(join(app.getPath('userData'), 'print-log.txt'), new Date().toISOString() + ' ' + text + '\n')
  } catch {
    // logging must never break a sale
  }
}

// --- one function per route to the printer -------------------------------
// Each throws on failure with a message the installer can act on, so the
// Settings screen can show exactly why a method did not work.

// Windows spooler, raw pass-through. Correct route on a machine with the
// vendor driver installed.
async function viaSpooler(printerName: string, buffer: Buffer): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rawprint = require('winrawprinter')
  await rawprint.PrintBufferToPrinterAsync(buffer, printerName)
}

// Share the printer and copy bytes to the share. Works where the spooler
// refuses raw data (seen on some POS-80C units).
async function viaShare(printerName: string, buffer: Buffer): Promise<void> {
  const shareName = 'POS_' + printerName.replace(/[^A-Za-z0-9]/g, '')
  const tmpFile = join(tmpdir(), 'escpos-' + Date.now() + '.prn')
  try {
    writeFileSync(tmpFile, buffer)
    const q = String.fromCharCode(39)
    const nameEsc = printerName.split(q).join(q + q)
    const psShare =
      '$p=Get-WmiObject Win32_Printer -Filter ' + q + 'Name=' + q + q + nameEsc + q + q + q + '; ' +
      'if($p){ if(-not $p.Shared){ $p.Shared=$true; $p.ShareName=' + q + shareName + q + '; $p.Put() | Out-Null } }'
    await runCmd('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psShare])
    await runCmd('cmd', ['/c', 'copy', '/b', tmpFile, '\\\\localhost\\' + shareName])
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

// Straight to the port, bypassing the driver entirely. This is the fallback
// when the machine has the wrong driver (or "Generic / Text Only") installed.
async function viaPort(port: string, buffer: Buffer): Promise<void> {
  if (!port) throw new Error('No printer port set in Settings (e.g. USB001 or COM3)')
  const target = /^COM\d+$/i.test(port) ? '\\\\.\\' + port.toUpperCase() : port
  const tmpFile = join(tmpdir(), 'escpos-' + Date.now() + '.prn')
  try {
    writeFileSync(tmpFile, buffer)
    await runCmd('cmd', ['/c', 'copy', '/b', tmpFile, target])
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

// Ports Windows currently knows about, offered as suggestions in Settings.
export function listPrinterPorts(): string[] {
  return ['USB001', 'USB002', 'USB003', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1']
}

// Send bytes using the configured method. 'auto' walks the routes in order of
// how often they work, so an untouched install still prints on most machines.
export async function sendRaw(printerName: string, buffer: Buffer): Promise<void> {
  const settings = getSettings()
  const method = settings.printMethod || 'auto'
  if (!printerName && method !== 'port') throw new Error('No printer selected in Settings')

  const attempt = async (name: string, fn: () => Promise<void>): Promise<void> => {
    await fn()
    logLine('printed ' + buffer.length + ' bytes via ' + name + ' OK')
  }

  if (method === 'spooler') return attempt('spooler', () => viaSpooler(printerName, buffer))
  if (method === 'share') return attempt('share', () => viaShare(printerName, buffer))
  if (method === 'port') return attempt('port', () => viaPort(settings.printerPort, buffer))
  if (method === 'driver') {
    throw new Error('Windows Driver method is only available for receipts, not raw test prints')
  }

  const errors: string[] = []
  for (const [name, fn] of [
    ['spooler', () => viaSpooler(printerName, buffer)],
    ['share', () => viaShare(printerName, buffer)],
    ['port', () => viaPort(settings.printerPort, buffer)]
  ] as [string, () => Promise<void>][]) {
    try {
      await attempt(name, fn)
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(name + ': ' + msg)
      logLine(name + ' failed (' + msg + ')')
    }
  }
  throw new Error('All print methods failed - ' + errors.join(' | '))
}

// Try one method on demand and report back, so the Settings screen can show
// which route works on this machine without anyone reading a log file.
export async function testPrintMethod(method: string): Promise<{ ok: boolean; detail: string }> {
  const settings = getSettings()
  const L = layout(settings)
  const printer = makePrinter(L.width)
  printer.alignCenter()
  printer.bold(true)
  printer.println('PRINT METHOD TEST')
  printer.bold(false)
  printer.println(method.toUpperCase())
  printer.println(new Date().toLocaleString())
  printer.drawLine()
  printer.alignLeft()
  let ruler = ''
  for (let i = 1; i <= L.width; i++) ruler += String(i % 10)
  printer.println(ruler)
  printer.alignCenter()
  printer.println('If this came out, this method works')
  cutPaper(printer, settings)
  const buffer = printer.getBuffer()

  try {
    if (method === 'spooler') await viaSpooler(settings.defaultPrinter, buffer)
    else if (method === 'share') await viaShare(settings.defaultPrinter, buffer)
    else if (method === 'port') await viaPort(settings.printerPort, buffer)
    else await sendRaw(settings.defaultPrinter, buffer)
    logLine('method test ' + method + ' OK')
    return { ok: true, detail: 'Sent - check the printer' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logLine('method test ' + method + ' FAILED: ' + msg)
    return { ok: false, detail: msg }
  }
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

  printer.alignCenter()
  if (settings.receiptLogo) {
    try {
      await printer.printImage(settings.receiptLogo)
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
  if (order.customerName) printer.println('Name: ' + order.customerName)
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
    printer.println(itemLine(name, item.quantity, money(item.lineTotal), L))
  }
  printer.drawLine()

  if (order.discount > 0 || order.deliveryCharge > 0 || order.serviceCharge > 0) {
    printer.println(padRow('Subtotal:', money(order.subtotal), L))
  }
  if (order.discount > 0) {
    printer.println(padRow('Discount:', '-' + money(order.discount), L))
  }
  if (order.serviceCharge > 0) {
    printer.println(padRow('Service:', '+' + money(order.serviceCharge), L))
  }
  if (order.deliveryCharge > 0) {
    printer.println(padRow('Delivery:', '+' + money(order.deliveryCharge), L))
  }
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println(padRow('TOTAL:', money(order.total), L))
  printer.setTextNormal()
  printer.bold(false)
  if (order.amountPaid > 0 && order.amountPaid < order.total) {
    printer.println(padRow('Paid:', money(order.amountPaid), L))
    printer.bold(true)
    printer.println(padRow('BALANCE:', money(order.total - order.amountPaid), L))
    printer.bold(false)
  }

  printer.alignCenter()
  printer.drawLine()
  if (settings.receiptFooter) printer.println(settings.receiptFooter)
  if (settings.printLogo) {
    try {
      await printer.printImage(resourcePath('xiom-logo-print.png'))
    } catch {
      printer.println('Powered by XIOM')
    }
  }
  printer.println('0301-4442459')
  // Feed just past the blade before cutting. The print head sits about four
  // lines above the cutter, so anything less leaves the logo below the blade
  // and it reappears on top of the next receipt.
  cutPaper(printer, settings)

  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}

export async function printKitchenEscpos(
  order: OrderWithItems,
  settings: AppSettings,
  names: Names
): Promise<void> {
  const printerName = settings.kitchenPrinter || settings.defaultPrinter
  const L = layout(settings)
  const printer = makePrinter(L.width)

  printer.alignCenter()
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println('KITCHEN')
  const typeLabel =
    order.orderType === 'dine_in' ? 'DINE IN' : order.orderType === 'delivery' ? 'DELIVERY' : 'TAKE AWAY'
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println(`${typeLabel}  #${order.orderNumber}`)
  printer.setTextNormal()
  printer.bold(false)
  printer.println(new Date(order.createdAt).toLocaleString())
  if (names.tableName) printer.println(`Table: ${names.tableName}`)
  if (order.customerName) {
    printer.bold(true)
    printer.println('Name: ' + order.customerName)
    printer.bold(false)
  }
  printer.drawLine()

  printer.alignLeft()
  for (const item of order.items) {
    const name = item.variantName ? item.productName + ' (' + item.variantName + ')' : item.productName
    printer.bold(true)
    printer.setTextSize(1, 1)
    printer.println(`${item.quantity} x ${name}`)
    printer.setTextNormal()
    printer.bold(false)
    if (item.note) printer.println(`    * ${item.note}`)
  }
  cutPaper(printer, settings)

  await sendRaw(printerName, printer.getBuffer())
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
    printer.println(itemLine(name, p.quantity, money(p.revenue), L))
  }
  printer.drawLine()

  printer.alignCenter()
  printer.println(`Printed: ${new Date().toLocaleString()}`)
  cutPaper(printer, settings)

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
  cutPaper(printer, settings)
  await sendRaw(printerName, printer.getBuffer())
}

export async function rawTestPrint(text: string): Promise<void> {
  const settings = getSettings()
  const L = layout(settings)
  const printer = makePrinter(L.width)
  for (const line of text.split('\n')) printer.println(line)
  cutPaper(printer, settings)
  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}