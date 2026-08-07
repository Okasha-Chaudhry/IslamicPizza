import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import type { OrderWithItems, AppSettings } from '../../shared/types'

interface Names {
  tableName?: string
  waiterName?: string
  servedBy?: string
}

function makePrinter(printerName: string): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `printer:${printerName}`,
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: false,
    options: { timeout: 5000 }
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
  const printer = makePrinter(settings.defaultPrinter)

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

  const ok = await printer.execute()
  if (!ok) throw new Error('Printer execute returned false')
}

export async function printKitchenEscpos(
  order: OrderWithItems,
  settings: AppSettings,
  names: Names
): Promise<void> {
  const printerName = settings.kitchenPrinter || settings.defaultPrinter
  const printer = makePrinter(printerName)

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

  const ok = await printer.execute()
  if (!ok) throw new Error('Printer execute returned false')
}

export async function testPrintEscpos(printerName: string): Promise<void> {
  const printer = makePrinter(printerName)
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
  const ok = await printer.execute()
  if (!ok) throw new Error('Printer execute returned false')
}