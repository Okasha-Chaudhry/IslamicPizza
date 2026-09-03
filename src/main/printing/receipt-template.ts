import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { OrderWithItems } from '../../shared/types'
import type { AppSettings } from '../services/settings.service'

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

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine In',
  take_away: 'Take Away',
  delivery: 'Delivery'
}

function fmtDateTime(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return esc(raw)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  let h = d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${dd}/${mm}/${yyyy}  ${String(h).padStart(2, '0')}:${min} ${ampm}`
}

export function buildReceiptHtml(
  order: OrderWithItems,
  settings: AppSettings,
  mode: 'receipt' | 'kitchen',
  extra: { tableName?: string; waiterName?: string; servedBy?: string } = {}
): string {
  const isKitchen = mode === 'kitchen'
  const width = settings.receiptWidth
  const pageWidth = width === '58' ? '48mm' : width === '80' ? '72mm' : '190mm'
  const baseFont = isKitchen ? '14px' : width === '58' ? '10px' : '12px'
  const cur = settings.currency

  const typeLabel = ORDER_TYPE_LABEL[order.orderType] ?? order.orderType

  const metaRows: string[] = []
  metaRows.push(`<tr><td class="k">Order#</td><td class="s">:</td><td>${esc(order.orderNumber)}</td></tr>`)
  metaRows.push(`<tr><td class="k">Type</td><td class="s">:</td><td>${typeLabel}</td></tr>`)
  metaRows.push(`<tr><td class="k">Date</td><td class="s">:</td><td>${fmtDateTime(order.createdAt)}</td></tr>`)
  if (order.orderType === 'dine_in') {
    if (extra.tableName) metaRows.push(`<tr><td class="k">Table</td><td class="s">:</td><td>${esc(extra.tableName)}</td></tr>`)
    if (extra.waiterName) metaRows.push(`<tr><td class="k">Waiter</td><td class="s">:</td><td>${esc(extra.waiterName)}</td></tr>`)
  }
  if (order.orderType === 'delivery') {
    if (order.customerPhone) metaRows.push(`<tr><td class="k">Phone</td><td class="s">:</td><td>${esc(order.customerPhone)}</td></tr>`)
    if (order.customerAddress) metaRows.push(`<tr><td class="k">Address</td><td class="s">:</td><td>${esc(order.customerAddress)}</td></tr>`)
  }
  if (!isKitchen && extra.servedBy) {
    metaRows.push(`<tr><td class="k">Served by</td><td class="s">:</td><td>${esc(extra.servedBy)}</td></tr>`)
  }

  const itemsRows = order.items
    .map((i) => {
      const name = esc(i.productName) + (i.variantName ? ` (${esc(i.variantName)})` : '')
      const note = i.note ? `<div class="note">** ${esc(i.note)}</div>` : ''
      if (isKitchen) {
        return `<tr><td class="qty">${i.quantity}x</td><td>${name}${note}</td></tr>`
      }
      return `<tr>
        <td class="iname">${name}${note}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${cur} ${i.lineTotal}</td>
      </tr>`
    })
    .join('')

  const extraRows: string[] = []
  if (order.discount > 0) {
    const label = order.discountPercent > 0 ? `Discount (${order.discountPercent}%)` : 'Discount'
    extraRows.push(`<tr><td>${label}</td><td class="num">- ${cur} ${order.discount}</td></tr>`)
  }
  if (order.deliveryCharge > 0) {
    extraRows.push(`<tr><td>Delivery Charges</td><td class="num">${cur} ${order.deliveryCharge}</td></tr>`)
  }

  const totalsHtml = isKitchen
    ? ''
    : `<div class="hr"></div>
      <table class="totals">
        <tr><td>Subtotal</td><td class="num">${cur} ${order.subtotal}</td></tr>
        ${extraRows.join('')}
      </table>
      <div class="hr"></div>
      <table class="totals">
        <tr class="grand"><td>TOTAL</td><td class="num">${cur} ${order.total}</td></tr>
      </table>`

  const headerHtml = isKitchen
    ? `<div class="center bold big">KITCHEN SLIP</div>`
    : `${settings.receiptLogo ? `<div class="center"><img class="logo" src="file://${settings.receiptLogo.replace(/\\/g, '/')}" /></div>` : ''}
      <div class="center bold title">${esc(settings.restaurantName)}</div>
      ${settings.receiptHeader ? `<div class="center subhead">${esc(settings.receiptHeader)}</div>` : ''}
      <div class="center addr">${esc(settings.address)}</div>
      ${settings.phone ? `<div class="center addr">Tel: ${esc(settings.phone)}</div>` : ''}`

  const qrHtml =
    !isKitchen && settings.paymentQr
      ? `<div class="center"><img class="qr" src="file://${settings.paymentQr.replace(/\\/g, '/')}" /></div>
         <div class="center small">Scan to pay</div>`
      : ''

  const footerHtml = isKitchen
    ? ''
    : `<div class="hr"></div>
       ${qrHtml}
       <div class="center thanks">${esc(settings.receiptFooter)}</div>
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
    padding: 1mm 0;
    font-weight: 600;
    -webkit-font-smoothing: none;
    line-height: 1.35;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .title { font-size: 1.7em; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.5mm; }
  .subhead { font-size: 1.15em; font-weight: 700; }
  .addr { font-size: 0.9em; }
  .big { font-size: 1.5em; }
  .small { font-size: 0.8em; }
  .hr { border-top: 1.5px solid #000; margin: 1.5mm 0; }
  .hr-thin { border-top: 1px solid #000; margin: 1mm 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0.4mm 0; vertical-align: top; }
  .meta td { font-size: 0.95em; }
  .meta td.k { width: 17mm; }
  .meta td.s { width: 3mm; }
  td.num { text-align: right; white-space: nowrap; padding-left: 2mm; }
  td.qty { width: 10mm; font-weight: 700; }
  .items thead td { font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 0.8mm; }
  .items td.iname { padding-right: 2mm; }
  .totals .grand td { font-weight: 700; font-size: 1.35em; padding: 0.5mm 0; }
  .note { font-style: italic; font-size: 0.85em; }
  .logo { max-width: 40mm; max-height: 20mm; margin-bottom: 1mm; }
  .qr { width: 28mm; height: 28mm; margin: 1mm 0; }
  .thanks { font-size: 0.9em; margin: 1.5mm 0; }
  .powered { margin-top: 1mm; }
  .xiom { height: 5mm; margin-bottom: 0.5mm; }
</style>
</head>
<body>
  ${headerHtml}
  <div class="hr"></div>
  <table class="meta">${metaRows.join('')}</table>
  <div class="hr"></div>
  <table class="items">
    ${
      isKitchen
        ? ''
        : `<thead><tr><td>ITEM</td><td class="num">QTY</td><td class="num">AMT</td></tr></thead>`
    }
    <tbody>${itemsRows}</tbody>
  </table>
  ${totalsHtml}
  ${footerHtml}
</body>
</html>`
}