import { getSqlite } from '../db'

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
}

const DEFAULTS: AppSettings = {
  restaurantName: 'Islamic Pizza & Fast Food',
  address: 'Muqabil Allah Wali Market, Jatoi Road, Shehar Sultan',
  phone: '0305-1415678 / 0306-1415678',
  receiptHeader: '',
  receiptFooter: 'Thank you for your order!',
  currency: 'Rs',
  defaultPrinter: '',
  kitchenPrinter: '',
  receiptWidth: '80'
}

export function getSettings(): AppSettings {
  const rows = getSqlite().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULTS, ...stored } as AppSettings
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