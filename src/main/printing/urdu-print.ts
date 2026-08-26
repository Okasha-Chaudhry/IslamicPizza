import { createCanvas, registerFont } from 'canvas'
import { join } from 'path'
import { existsSync } from 'fs'

function fontPath(): string {
  const dev = join(process.cwd(), 'resources', 'fonts', 'NotoNastaliqUrdu.ttf')
  if (existsSync(dev)) return dev
  const prod = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'resources',
    'fonts',
    'NotoNastaliqUrdu.ttf'
  )
  if (existsSync(prod)) return prod
  return join(process.resourcesPath, 'resources', 'fonts', 'NotoNastaliqUrdu.ttf')
}

let fontReady = false
function ensureFont(): void {
  if (fontReady) return
  try {
    registerFont(fontPath(), { family: 'NotoUrdu' })
    fontReady = true
  } catch {
    // font missing - caller falls back to text
  }
}

export function hasUrdu(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)
}

export function renderItemRow(opts: {
  name: string
  qty?: number | string
  amount?: string
  widthDots: number
  fontSize?: number
  bold?: boolean
}): Buffer {
  ensureFont()
  const { name, qty, amount, widthDots } = opts
  const fontSize = opts.fontSize ?? 30
  const height = Math.round(fontSize * 1.6)
  const canvas = createCanvas(widthDots, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, widthDots, height)
  ctx.fillStyle = 'black'
  const y = Math.round(height * 0.74)
  const bold = opts.bold ? 'bold ' : ''

  const qtyX = Math.round(widthDots * 0.72)
  const amtX = widthDots - 8

  ctx.font = bold + fontSize + 'px NotoUrdu'
  ctx.direction = 'rtl'
  ctx.textAlign = 'left'
  ctx.fillText(name, 8, y)

  if (qty !== undefined && qty !== '') {
    ctx.font = bold + Math.round(fontSize * 0.85) + 'px sans-serif'
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.fillText(String(qty), qtyX, y)
  }

  if (amount) {
    ctx.font = bold + Math.round(fontSize * 0.85) + 'px sans-serif'
    ctx.direction = 'ltr'
    ctx.textAlign = 'right'
    ctx.fillText(amount, amtX, y)
  }

  return canvas.toBuffer('image/png')
}
