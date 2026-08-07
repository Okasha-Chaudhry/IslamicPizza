import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import type { OrderWithItems, AppSettings } from '../../shared/types'

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

  printer.tableCustom([
    { text: 'Item', align: 'LEFT', width: 0.5 },
    { text: 'Qty', align: 'CENTER', width: 0.15 },
    { text: 'Amount', align: 'RIGHT', width: 0.35 }
  ])
  printer.drawLine()

  for (const item of order.items) {
    const name = item.variantName ? `${item.productName} (${item.variantName})` : item.productName
    printer.tableCustom([
      { text: name, align: 'LEFT', width: 0.5 },
      { text: String(item.quantity), align: 'CENTER', width: 0.15 },
      { text: money(item.lineTotal), align: 'RIGHT', width: 0.35 }
    ])
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