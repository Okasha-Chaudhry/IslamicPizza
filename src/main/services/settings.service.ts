import { getSqlite } from '../db'
import type { PrintMethod } from '../../shared/types'

export interface AppSettings {
  restaurantName: string
  address: string
  phone: string
  receiptHeader: string
  receiptFooter: string
  currency: string
  defaultPrinter: string
  kitchenPrinter: string
  receiptWidth: '58' | '80' | 'A4'
  charsPerLine: number
  printMethod: PrintMethod
  printerPort: string
  cutFeedLines: number
  cutStyle: 'full' | 'partial' | 'none'
  printLogo: boolean
  receiptLogo: string
  paymentQr: string
}

const DEFAULTS: AppSettings = {
  restaurantName: 'My Restaurant',
  address: '',
  phone: '',
  receiptHeader: '',
  receiptFooter: 'Thank you for your order!',
  currency: 'Rs',
  defaultPrinter: '',
  kitchenPrinter: '',
  receiptWidth: '80',
  charsPerLine: 0,
  printMethod: 'auto',
  printerPort: '',
  cutFeedLines: 4,
  cutStyle: 'full',
  printLogo: true,
  receiptLogo: '',
  paymentQr: ''
}

export function getSettings(): AppSettings {
  const rows = getSqlite().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const merged = { ...DEFAULTS, ...stored } as Record<string, unknown>
  // Everything is kept as text in the settings table, so anything that is not
  // a string has to be converted back or the UI gets "4" instead of 4.
  merged.charsPerLine = Number(merged.charsPerLine) || 0
  merged.cutFeedLines = Number(merged.cutFeedLines)
  if (!Number.isFinite(merged.cutFeedLines as number)) merged.cutFeedLines = 4
  merged.printLogo = String(merged.printLogo) !== 'false'
  return merged as unknown as AppSettings
}

export function saveSettings(input: Partial<AppSettings>): AppSettings {
  const stmt = getSqlite().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const tx = getSqlite().transaction(() => {
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) stmt.run(key, String(value))
    }
  })
  tx()
  return getSettings()
}