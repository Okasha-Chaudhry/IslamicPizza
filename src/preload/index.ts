import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ApiResult,
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  NamedEntity,
  CreateNamedEntityInput,
  UpdateNamedEntityInput,
  Product,
  ProductWithVariants,
  CreateProductInput,
  UpdateProductInput,
  CreateOrderInput,
  OrderWithItems,
  OrderStatus,
  AppSettings,
  PrinterInfo,
  SalesReport
} from '../shared/types'

function namedEntityApi(prefix: string): {
  list: () => Promise<ApiResult<NamedEntity[]>>
  create: (input: CreateNamedEntityInput) => Promise<ApiResult<NamedEntity>>
  update: (input: UpdateNamedEntityInput) => Promise<ApiResult<NamedEntity>>
  delete: (id: number) => Promise<ApiResult<void>>
} {
  return {
    list: () => ipcRenderer.invoke(`${prefix}:list`),
    create: (input) => ipcRenderer.invoke(`${prefix}:create`, input),
    update: (input) => ipcRenderer.invoke(`${prefix}:update`, input),
    delete: (id) => ipcRenderer.invoke(`${prefix}:delete`, id)
  }
}

const api = {
  categories: {
    list: (): Promise<ApiResult<Category[]>> => ipcRenderer.invoke('categories:list'),
    create: (input: CreateCategoryInput): Promise<ApiResult<Category>> =>
      ipcRenderer.invoke('categories:create', input),
    update: (input: UpdateCategoryInput): Promise<ApiResult<Category>> =>
      ipcRenderer.invoke('categories:update', input),
    delete: (id: number): Promise<ApiResult<void>> => ipcRenderer.invoke('categories:delete', id)
  },
  products: {
    list: (): Promise<ApiResult<ProductWithVariants[]>> => ipcRenderer.invoke('products:list'),
    create: (input: CreateProductInput): Promise<ApiResult<Product>> =>
      ipcRenderer.invoke('products:create', input),
    update: (input: UpdateProductInput): Promise<ApiResult<Product>> =>
      ipcRenderer.invoke('products:update', input),
    delete: (id: number): Promise<ApiResult<void>> => ipcRenderer.invoke('products:delete', id)
  },
  settings: {
    get: (): Promise<ApiResult<AppSettings>> => ipcRenderer.invoke('settings:get'),
    save: (input: Partial<AppSettings>): Promise<ApiResult<AppSettings>> =>
      ipcRenderer.invoke('settings:save', input)
  },
  printers: {
    list: (): Promise<ApiResult<PrinterInfo[]>> => ipcRenderer.invoke('printers:list')
  },
  reports: {
    sales: (filter: { from: string; to: string }): Promise<ApiResult<SalesReport>> =>
      ipcRenderer.invoke('reports:sales', filter)
  },
  print: {
    test: (): Promise<ApiResult<void>> => ipcRenderer.invoke('print:test'),
    report: (report: SalesReport): Promise<ApiResult<void>> => ipcRenderer.invoke('print:report', report),
    receipt: (order: OrderWithItems): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('print:receipt', order),
    kitchen: (order: OrderWithItems): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('print:kitchen', order)
  },
  orders: {
    list: (filter?: { date?: string; status?: OrderStatus | 'all' }): Promise<ApiResult<OrderWithItems[]>> =>
      ipcRenderer.invoke('orders:list', filter),
    create: (input: CreateOrderInput): Promise<ApiResult<OrderWithItems>> =>
      ipcRenderer.invoke('orders:create', input),
    updateStatus: (id: number, status: OrderStatus): Promise<ApiResult<OrderWithItems>> =>
      ipcRenderer.invoke('orders:updateStatus', id, status)
  },
  tables: namedEntityApi('tables'),
  waiters: namedEntityApi('waiters')
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}