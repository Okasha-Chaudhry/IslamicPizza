import { ipcMain } from 'electron'
import type { ApiResult } from '../../shared/types'
import * as categoriesService from '../services/categories.service'
import * as kitchenSectionsService from '../services/kitchen-sections.service'
import { tablesService, waitersService } from '../services/named-entity.service'
import * as productsService from '../services/products.service'
import * as ordersService from '../services/orders.service'
import * as settingsService from '../services/settings.service'
import * as printService from '../printing/print.service'
import * as reportsService from '../services/reports.service'
import * as backupService from '../services/backup.service'
import * as usersService from '../services/users.service'
import * as licenseService from '../services/license.service'
import * as expensesService from '../services/expenses.service'
import * as customersService from '../services/customers.service'
import type { OrderWithItems } from '../../shared/types'
import { BrowserWindow, dialog, app } from 'electron'
import { join } from 'path'

function handle<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (...args: TArgs) => TResult
): void {
  ipcMain.handle(channel, (_event, ...args): ApiResult<TResult> => {
    try {
      return { ok: true, data: fn(...(args as TArgs)) }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[ipc] ${channel} failed:`, message)
      return { ok: false, error: message }
    }
  })
}

export function registerIpcHandlers(): void {
  handle('categories:list', categoriesService.listCategories)
  handle('categories:create', categoriesService.createCategory)
  handle('categories:update', categoriesService.updateCategory)
  handle('categories:delete', categoriesService.deleteCategory)
  handle('kitchenSections:list', kitchenSectionsService.listKitchenSections)
  handle('kitchenSections:create', kitchenSectionsService.createKitchenSection)
  handle('kitchenSections:update', kitchenSectionsService.updateKitchenSection)
  handle('kitchenSections:delete', kitchenSectionsService.deleteKitchenSection)

  handle('products:list', productsService.listProducts)
  handle('products:create', productsService.createProduct)
  handle('products:update', productsService.updateProduct)
  handle('products:delete', productsService.deleteProduct)

  handle('tables:list', tablesService.list)
  handle('tables:create', tablesService.create)
  handle('tables:update', tablesService.update)
  handle('tables:delete', tablesService.remove)

  handle('license:status', licenseService.getLicenseStatus)
  handle('license:activate', licenseService.activate)

  handle('auth:hasAnyUser', usersService.hasAnyUser)
  handle('auth:setupAdmin', usersService.setupAdmin)
  handle('auth:login', usersService.login)
  handle('users:list', usersService.listUsers)
  handle('users:create', usersService.createUser)
  handle('users:update', usersService.updateUser)

  ipcMain.handle('settings:pickImage', async (_e, kind: 'logo' | 'qr') => {
    try {
      const result = await dialog.showOpenDialog({
        title: kind === 'logo' ? 'Select Receipt Logo' : 'Select Payment QR Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: 'Cancelled' }
      }
      const destName = kind === 'logo' ? 'receipt-logo.png' : 'payment-qr.png'
      const destPath = join(app.getPath('userData'), destName)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharp = require('sharp')
      await sharp(result.filePaths[0])
        .flatten({ background: '#ffffff' })
        .resize(360, 360, { fit: 'inside', withoutEnlargement: false })
        .greyscale()
        .threshold(180)
        .png()
        .toFile(destPath)
      const key = kind === 'logo' ? 'receiptLogo' : 'paymentQr'
      settingsService.saveSettings({ [key]: destPath })
      return { ok: true, data: destPath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Image failed' }
    }
  })

  ipcMain.handle('settings:clearImage', (_e, kind: 'logo' | 'qr') => {
    const key = kind === 'logo' ? 'receiptLogo' : 'paymentQr'
    settingsService.saveSettings({ [key]: '' })
    return { ok: true }
  })

  handle('settings:get', settingsService.getSettings)
  handle('settings:save', settingsService.saveSettings)

  ipcMain.handle('printers:list', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return { ok: false, error: 'No window available' }
      const printers = await win.webContents.getPrintersAsync()
      return { ok: true, data: printers.map((p) => ({ name: p.name, isDefault: false })) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to list printers' }
    }
  })

  handle('reports:sales', reportsService.getSalesReport)

  handle('expenses:listItems', expensesService.listExpenseItems)
  handle('expenses:createItem', expensesService.createExpenseItem)
  handle('expenses:updateItem', expensesService.updateExpenseItem)
  handle('expenses:list', expensesService.listExpenses)
  handle('expenses:create', expensesService.createExpense)
  handle('expenses:update', expensesService.updateExpense)
  handle('expenses:delete', expensesService.deleteExpense)
  handle('expenses:summary', expensesService.expenseSummary)

  handle('customers:search', customersService.searchCustomers)

  ipcMain.handle('backup:create', async () => {
    try {
      const path = await backupService.backupDatabase()
      return { ok: true, data: path }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Backup failed' }
    }
  })

  ipcMain.handle('backup:restore', async () => {
    try {
      const path = await backupService.restoreDatabase()
      return { ok: true, data: path }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Restore failed' }
    }
  })

  handle('backup:check', backupService.checkIntegrity)

  ipcMain.handle('print:report', async (_e, report) => {
    try {
      await printService.printReport(report)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Print failed' }
    }
  })

  ipcMain.handle('print:raw', async (_e, text: string) => {
    try {
      await printService.rawTestPrint(text)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Print failed' }
    }
  })
  ipcMain.handle('print:test', async () => {
    try {
      await printService.printTest()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Print failed' }
    }
  })

  ipcMain.handle('print:receipt', async (_e, order: OrderWithItems) => {
    try {
      await printService.printReceipt(order)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Print failed' }
    }
  })

  ipcMain.handle('print:kitchen', async (_e, order: OrderWithItems) => {
    try {
      await printService.printKitchenSlip(order)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Print failed' }
    }
  })

  handle('orders:create', ordersService.createOrder)
  handle('orders:list', ordersService.listOrders)
  handle('orders:updateItems', ordersService.updateOrderItems)
  handle('orders:updateStatus', ordersService.updateOrderStatus)

  handle('waiters:list', waitersService.list)
  handle('waiters:create', waitersService.create)
  handle('waiters:update', waitersService.update)
  handle('waiters:delete', waitersService.remove)
}