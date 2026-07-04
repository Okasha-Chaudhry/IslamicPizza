import { app, dialog } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync } from 'fs'
import { getSqlite, closeDatabase, initDatabase } from '../db'

export async function backupDatabase(): Promise<string> {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const result = await dialog.showSaveDialog({
    title: 'Save Backup',
    defaultPath: `pos-backup-${stamp}.db`,
    filters: [{ name: 'Database', extensions: ['db'] }]
  })
  if (result.canceled || !result.filePath) throw new Error('Backup cancelled')

  await getSqlite().backup(result.filePath)
  return result.filePath
}

export async function restoreDatabase(): Promise<string> {
  const result = await dialog.showOpenDialog({
    title: 'Select Backup File',
    filters: [{ name: 'Database', extensions: ['db'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) throw new Error('Restore cancelled')
  const backupPath = result.filePaths[0]
  if (!existsSync(backupPath)) throw new Error('Backup file not found')

  const dbPath = join(app.getPath('userData'), 'restaurant-pos.db')
  const safetyPath = join(app.getPath('userData'), 'pre-restore-safety.db')

  // Safety copy of current DB, then swap in the backup
  await getSqlite().backup(safetyPath)
  closeDatabase()
  copyFileSync(backupPath, dbPath)
  initDatabase()

  return backupPath
}

export function checkIntegrity(): string {
  const rows = getSqlite().pragma('integrity_check') as { integrity_check: string }[]
  const result = rows.map((r) => r.integrity_check).join('; ')
  if (result !== 'ok') throw new Error(`Integrity check failed: ${result}`)
  return 'Database integrity: OK'
}