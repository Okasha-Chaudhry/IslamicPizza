import { ipcMain } from 'electron'
import type { ApiResult } from '../../shared/types'
import * as categoriesService from '../services/categories.service'
import { tablesService, waitersService } from '../services/named-entity.service'
import * as productsService from '../services/products.service'
import * as ordersService from '../services/orders.service'
import * as settingsService from '../services/settings.service'
import * as printService from '../printing/print.service'
import type { OrderWithItems } from '../../shared/types'
import { BrowserWindow } from 'electron'

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

  handle('products:list', productsService.listProducts)
  handle('products:create', productsService.createProduct)
  handle('products:update', productsService.updateProduct)
  handle('products:delete', productsService.deleteProduct)

  handle('tables:list', tablesService.list)
  handle('tables:create', tablesService.create)
  handle('tables:update', tablesService.update)
  handle('tables:delete', tablesService.remove)

  handle('settings:get', settingsService.getSettings)
  handle('settings:save', settingsService.saveSettings)

  ipcMain.handle('printers:list', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return { ok: false, error: 'No window available' }
      const printers = await win.webContents.getPrintersAsync()
      return { ok: true, data: printers.map((p) => ({ name: p.name, isDefault: p.isDefault })) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to list printers' }
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
  handle('orders:updateStatus', ordersService.updateOrderStatus)

  handle('waiters:list', waitersService.list)
  handle('waiters:create', waitersService.create)
  handle('waiters:update', waitersService.update)
  handle('waiters:delete', waitersService.remove)
}