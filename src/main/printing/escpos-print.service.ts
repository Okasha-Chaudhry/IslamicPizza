import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import type { OrderWithItems, AppSettings } from '../../shared/types'
import { getSettings } from '../services/settings.service'

interface Names {
  tableName?: string
  waiterName?: string
  servedBy?: string
}

function makePrinter(): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'buffer',
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: false
  })
}

// Send raw ESC/POS bytes to a Windows printer using the RAW spooler datatype.
async function sendRaw(printerName: string, buffer: Buffer): Promise<void> {
  const tmpFile = join(tmpdir(), `escpos-${Date.now()}.prn`)
  writeFileSync(tmpFile, buffer)
  const psScript = `
$printer = "${printerName.replace(/"/g, '""')}"
$path = "${tmpFile.replace(/\\/g, '\\\\')}"
$bytes = [System.IO.File]::ReadAllBytes($path)
$src = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public struct DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)] public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
  public static void Send(string name, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(name, out h, IntPtr.Zero)) throw new Exception("OpenPrinter failed");
    DOCINFOA di = new DOCINFOA(); di.pDocName = "Receipt"; di.pDataType = "RAW";
    StartDocPrinter(h, 1, ref di); StartPagePrinter(h);
    int written; WritePrinter(h, bytes, bytes.Length, out written);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
  }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
[RawPrint]::Send($printer, $bytes)
`
  await new Promise<void>((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], (err) => {
      try { unlinkSync(tmpFile) } catch { /* ignore */ }
      if (err) reject(new Error(err.message))
      else resolve()
    })
  })
}

const LINE_WIDTH = 48

function padRow(left: string, right: string): string {
  const space = Math.max(1, LINE_WIDTH - left.length - right.length)
  return left + ' '.repeat(space) + right
}

function itemRows(name: string, qty: number, amount: string): string {
  const qtyAmt = `${qty}   ${amount}`
  const nameWidth = LINE_WIDTH - qtyAmt.length - 1
  const lines: string[] = []
  let remaining = name
  let first = true
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, first ? nameWidth : LINE_WIDTH)
    remaining = remaining.slice(chunk.length)
    if (first) {
      const space = Math.max(1, LINE_WIDTH - chunk.length - qtyAmt.length)
      lines.push(chunk + ' '.repeat(space) + qtyAmt)
      first = false
    } else {
      lines.push(chunk)
    }
  }
  return lines.join('\n')
}

function money(n: number): string {
  return `Rs ${n}`
}

// 48 chars per line at Font A on 80mm. Left text + right-aligned amount.
function row(left: string, right: string, width = 48): string {
  const space = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(space) + right
}

export async function printReceiptEscpos(
  order: OrderWithItems,
  settings: AppSettings,
  names: Names
): Promise<void> {
  const printer = makePrinter()

  printer.alignCenter()
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println(settings.restaurantName || 'Restaurant')
  printer.setTextNormal()
  printer.bold(false)
  if (settings.receiptHeader) printer.println(settings.receiptHeader)
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

  printer.println(padRow('Item', 'Qty  Amount'))
  printer.drawLine()
  for (const item of order.items) {
    const name = item.variantName ? item.productName + ' (' + item.variantName + ')' : item.productName
    printer.println(itemRows(name, item.quantity, money(item.lineTotal)))
  }
  printer.drawLine()

  printer.alignRight()
  if (order.discount > 0) {
    printer.println(row('Subtotal:', money(order.subtotal)))
    printer.println(row(`Discount (${order.discountPercent}%):`, `-${money(order.discount)}`))
  }
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println(`TOTAL: ${money(order.total)}`)
  printer.setTextNormal()
  printer.bold(false)

  printer.alignCenter()
  printer.drawLine()
  if (settings.receiptFooter) printer.println(settings.receiptFooter)
  printer.println('Powered by XIOM - 0310-1617048')
  printer.cut()

  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}

export async function printKitchenEscpos(
  order: OrderWithItems,
  settings: AppSettings,
  names: Names
): Promise<void> {
  const printerName = settings.kitchenPrinter || settings.defaultPrinter
  const printer = makePrinter()

  printer.alignCenter()
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println('KITCHEN')
  printer.setTextSize(0, 0)
  const typeLabel =
    order.orderType === 'dine_in' ? 'DINE IN' : order.orderType === 'delivery' ? 'DELIVERY' : 'TAKE AWAY'
  printer.println(`${typeLabel}  #${order.orderNumber}`)
  printer.bold(false)
  printer.println(new Date(order.createdAt).toLocaleString())
  if (names.tableName) printer.println(`Table: ${names.tableName}`)
  printer.drawLine()

  printer.alignLeft()
  printer.setTextSize(1, 1)
  for (const item of order.items) {
    const name = item.variantName ? `${item.productName} (${item.variantName})` : item.productName
    printer.println(`${item.quantity} x ${name}`)
    if (item.note) printer.println(`   * ${item.note}`)
  }
  printer.setTextNormal()
  printer.cut()

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
  const printer = makePrinter()
  const s = report.summary
  const range = report.from === report.to ? report.from : `${report.from} to ${report.to}`

  printer.alignCenter()
  printer.bold(true)
  printer.println('SALES REPORT')
  printer.bold(false)
  printer.println(settings.restaurantName || 'Restaurant')
  printer.println(range)
  printer.drawLine()

  printer.alignLeft()
  printer.println(padRow('Paid Orders:', String(s.paidOrders)))
  printer.bold(true)
  printer.println(padRow('Revenue:', money(s.paidRevenue)))
  printer.bold(false)
  printer.println(padRow('Avg Order:', money(s.avgOrderValue)))
  printer.println(padRow('Discounts:', money(s.totalDiscount)))
  printer.println(padRow('Unpaid:', `${s.pendingOrders} (${money(s.pendingAmount)})`))
  printer.println(padRow('Cancelled:', String(s.cancelledOrders)))
  printer.drawLine()

  printer.bold(true)
  printer.println('TOP ITEMS')
  printer.bold(false)
  for (const p of report.popular) {
    const name = p.variantName ? `${p.productName} (${p.variantName})` : p.productName
    printer.println(itemRows(name, p.quantity, money(p.revenue)))
  }
  printer.drawLine()
  printer.alignCenter()
  printer.println(`Printed: ${new Date().toLocaleString()}`)
  printer.cut()
  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}

export async function rawTestPrint(text: string): Promise<void> {
  const settings = getSettings()
  const printer = makePrinter()
  const lines = text.split('\n')
  for (const line of lines) printer.println(line)
  printer.cut()
  await sendRaw(settings.defaultPrinter, printer.getBuffer())
}

export async function testPrintEscpos(printerName: string): Promise<void> {
  const printer = makePrinter()
  printer.alignCenter()
  printer.bold(true)
  printer.setTextSize(1, 1)
  printer.println('TEST PRINT')
  printer.setTextNormal()
  printer.bold(false)
  printer.println('ESC/POS OK')
  printer.println(new Date().toLocaleString())
  printer.drawLine()
  printer.println('Powered by XIOM')
  printer.cut()
  await sendRaw(printerName, printer.getBuffer())
}