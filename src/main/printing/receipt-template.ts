import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function xiomLogoDataUri(): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'resources', 'xiom-logo.png'),
    join(process.cwd(), 'resources', 'xiom-logo.png')
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        return `data:image/png;base64,${readFileSync(p).toString('base64')}`
      }
    } catch {
      // ignore
    }
  }
  return ''
}
import type { OrderWithItems } from '../../shared/types'
import type { AppSettings } from '../services/settings.service'

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: 'DINE IN',
  take_away: 'TAKE AWAY',
  delivery: 'DELIVERY'
}

export function buildReceiptHtml(
  order: OrderWithItems,
  settings: AppSettings,
  mode: 'receipt' | 'kitchen',
  extra: { tableName?: string; waiterName?: string; servedBy?: string } = {}
): string {
  const isKitchen = mode === 'kitchen'
  const width = settings.receiptWidth
  const pageWidth = width === '58' ? '44mm' : width === '80' ? '68mm' : '190mm'
  const baseFont = isKitchen ? '14px' : width === '58' ? '9px' : '11px'
  const cur = settings.currency

  const dt = order.createdAt
  const typeLabel = ORDER_TYPE_LABEL[order.orderType] ?? order.orderType

  const metaLines: string[] = []
  if (order.orderType === 'dine_in') {
    if (extra.tableName) metaLines.push(`Table: ${esc(extra.tableName)}`)
    if (extra.waiterName) metaLines.push(`Waiter: ${esc(extra.waiterName)}`)
  }
  if (!isKitchen && extra.servedBy) metaLines.push(`Served by: ${esc(extra.servedBy)}`)
  if (order.orderType === 'delivery') {
    if (order.customerPhone) metaLines.push(`Phone: ${esc(order.customerPhone)}`)
    if (order.customerAddress) metaLines.push(`Address: ${esc(order.customerAddress)}`)
  }

  const itemsRows = order.items
    .map((i) => {
      const name = esc(i.productName) + (i.variantName ? ` (${esc(i.variantName)})` : '')
      const note = i.note ? `<div class="note">** ${esc(i.note)}</div>` : ''
      if (isKitchen) {
        return `<tr><td class="qty">${i.quantity}x</td><td>${name}${note}</td></tr>`
      }
      return `<tr>
        <td>${name}${note}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${i.unitPrice}</td>
        <td class="num">${i.lineTotal}</td>
      </tr>`
    })
    .join('')

  const totalsHtml = isKitchen
    ? ''
    : `<div class="rule"></div>
      <table class="totals">
        <tr><td>Subtotal</td><td class="num">${cur} ${order.subtotal}</td></tr>
        ${
          order.discount > 0
            ? `<tr><td>Discount (${order.discountPercent}%)</td><td class="num">- ${cur} ${order.discount}</td></tr>`
            : ''
        }
        <tr class="grand"><td>TOTAL</td><td class="num">${cur} ${order.total}</td></tr>
      </table>`

  const headerHtml = isKitchen
    ? `<div class="center bold big">KITCHEN SLIP</div>`
    : `${settings.receiptLogo ? `<div class="center"><img class="logo" src="file://${settings.receiptLogo.replace(/\\/g, '/')}" /></div>` : ''}<div class="center bold big">${esc(settings.restaurantName)}</div>
      ${settings.receiptHeader ? `<div class="center bold subhead">${esc(settings.receiptHeader)}</div>` : ''}
      <div class="center small">${esc(settings.address)}</div>
      <div class="center small">${esc(settings.phone)}</div>`

  const qrHtml =
    !isKitchen && settings.paymentQr
      ? `<div class="rule"></div>
         <div class="center"><img class="qr" src="file://${settings.paymentQr.replace(/\\/g, '/')}" /></div>
         <div class="center small">Scan to pay</div>`
      : ''

  const footerHtml = isKitchen
    ? ''
    : `${qrHtml}<div class="rule"></div><div class="center small">${esc(settings.receiptFooter)}</div>
       <div class="center powered">${xiomLogoDataUri() ? `<img class="xiom" src="${xiomLogoDataUri()}" /><br/>` : ''}<span class="small">Powered by XIOM - 0310-1617048</span></div>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${pageWidth}; }
  body {
    font-family: 'Courier New', monospace;
    font-size: ${baseFont};
    color: #000;
    padding: 1mm 2mm 1mm 0;
    font-weight: 600;
    -webkit-font-smoothing: none;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 1.5em; }
  .small { font-size: 0.85em; }
  .subhead { font-size: 1.2em; }
  .logo { max-width: 40mm; max-height: 20mm; margin-bottom: 1mm; }
  .qr { width: 28mm; height: 28mm; margin: 1mm 0; }
  .powered { margin-top: 1mm; font-size: 0.75em; }
  .xiom { height: 5mm; margin-bottom: 0.5mm; }
  .rule { border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0.5mm 0; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; padding-left: 2mm; }
  td.qty { width: 10mm; font-weight: bold; }
  .items td { font-size: 1em; }
  .totals .grand td { font-weight: bold; font-size: 1.3em; padding-top: 1mm; }
  .note { font-style: italic; font-size: 0.85em; }
  .meta { margin: 1mm 0; }
</style>
</head>
<body>
  ${headerHtml}
  <div class="rule"></div>
  <div class="meta">
    <div class="bold">${typeLabel} &nbsp; #${esc(order.orderNumber)}</div>
    <div class="small">${esc(dt)}</div>
    ${metaLines.map((l) => `<div class="small">${l}</div>`).join('')}
  </div>
  <div class="rule"></div>
  <table class="items">
    ${
      isKitchen
        ? ''
        : `<tr class="bold"><td>Item</td><td class="num">Qty</td><td class="num">Price</td><td class="num">Amt</td></tr>`
    }
    ${itemsRows}
  </table>
  ${totalsHtml}
  ${footerHtml}
</body>
</html>`
}