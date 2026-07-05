import { createHmac } from 'crypto'
import { execSync } from 'child_process'
import { getSqlite } from '../db'

// NOTE: change this secret before selling to additional clients if it ever leaks.
// The matching keygen.js (kept OUTSIDE this repo) must use the same secret.
const LICENSE_SECRET = 'IsPz-2026-Kx9#mQv7$Lw2@Rt8!Zn4&Jh6'

export interface LicenseStatus {
  activated: boolean
  machineId: string
  expiresOn: string | null
  daysLeft: number | null
  error?: string
}

let cachedMachineId: string | null = null

export function getMachineId(): string {
  if (cachedMachineId) return cachedMachineId
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8' }
    )
    const match = out.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]+)/i)
    if (!match) throw new Error('MachineGuid not found')
    cachedMachineId = match[1].toUpperCase()
    return cachedMachineId
  } catch {
    throw new Error('Could not read machine ID')
  }
}

function signature(machineId: string, expiry: string): string {
  const raw = createHmac('sha256', LICENSE_SECRET)
    .update(`${machineId}:${expiry}`)
    .digest('hex')
    .toUpperCase()
    .slice(0, 20)
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function verifyKey(key: string): { valid: boolean; expiry?: string; error?: string } {
  const cleaned = key.trim().toUpperCase()
  const match = cleaned.match(/^([A-F0-9]{5}-[A-F0-9]{5}-[A-F0-9]{5}-[A-F0-9]{5})-(\d{8})$/)
  if (!match) return { valid: false, error: 'Invalid key format' }
  const [, sig, expiry] = match
  const machineId = getMachineId()
  if (signature(machineId, expiry) !== sig) {
    return { valid: false, error: 'Key is not valid for this computer' }
  }
  if (expiry < todayStr()) {
    return { valid: false, error: `License expired on ${expiry.slice(0, 4)}-${expiry.slice(4, 6)}-${expiry.slice(6, 8)}` }
  }
  return { valid: true, expiry }
}

export function activate(key: string): LicenseStatus {
  const res = verifyKey(key)
  if (!res.valid) throw new Error(res.error ?? 'Invalid key')
  const stmt = getSqlite().prepare(
    "INSERT INTO settings (key, value) VALUES ('licenseKey', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
  stmt.run(key.trim().toUpperCase())
  return getLicenseStatus()
}

export function getLicenseStatus(): LicenseStatus {
  const machineId = getMachineId()
  const row = getSqlite()
    .prepare("SELECT value FROM settings WHERE key = 'licenseKey'")
    .get() as { value: string } | undefined

  if (!row) return { activated: false, machineId, expiresOn: null, daysLeft: null }

  const res = verifyKey(row.value)
  if (!res.valid) {
    return { activated: false, machineId, expiresOn: null, daysLeft: null, error: res.error }
  }

  const e = res.expiry!
  const expiresOn = `${e.slice(0, 4)}-${e.slice(4, 6)}-${e.slice(6, 8)}`
  const msLeft = new Date(`${expiresOn}T23:59:59`).getTime() - Date.now()
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000))
  return { activated: true, machineId, expiresOn, daysLeft }
}