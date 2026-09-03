import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ApiResult,
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  NamedEntity,
  OrderType,
  CreateNamedEntityInput,
  UpdateNamedEntityInput,
  Product,
  ProductWithVariants,
  CreateProductInput,
  UpdateProductInput,
  CreateOrderInput,
  OrderWithItems,
  OrderStatus,
  OrderPayment,
  AppSettings,
  PrinterInfo,
  SalesReport,
  SafeUser,
  UserRole,
  LicenseStatus,
  Expense,
  ExpenseItem,
  CreateExpenseInput,
  UpdateExpenseInput,
  Customer
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
  expenses: {
    listItems: (): Promise<ApiResult<ExpenseItem[]>> => ipcRenderer.invoke('expenses:listItems'),
    createItem: (name: string): Promise<ApiResult<ExpenseItem>> =>
      ipcRenderer.invoke('expenses:createItem', name),
    updateItem: (input: { id: number; name?: string; isActive?: boolean }): Promise<ApiResult<ExpenseItem>> =>
      ipcRenderer.invoke('expenses:updateItem', input),
    list: (filter: { from: string; to: string }): Promise<ApiResult<Expense[]>> =>
      ipcRenderer.invoke('expenses:list', filter),
    create: (input: CreateExpenseInput): Promise<ApiResult<Expense>> =>
      ipcRenderer.invoke('expenses:create', input),
    update: (input: UpdateExpenseInput): Promise<ApiResult<Expense>> =>
      ipcRenderer.invoke('expenses:update', input),
    delete: (id: number): Promise<ApiResult<void>> => ipcRenderer.invoke('expenses:delete', id),
    summary: (filter: { from: string; to: string }): Promise<ApiResult<{ total: number; byCategory: { category: string; total: number }[]; byItem: { itemName: string; purchases: number; total: number; lastDate: string }[] }>> =>
      ipcRenderer.invoke('expenses:summary', filter)
  },
  customers: {
    search: (query: string): Promise<ApiResult<Customer[]>> =>
      ipcRenderer.invoke('customers:search', query)
  },
  license: {
    status: (): Promise<ApiResult<LicenseStatus>> => ipcRenderer.invoke('license:status'),
    activate: (key: string): Promise<ApiResult<LicenseStatus>> =>
      ipcRenderer.invoke('license:activate', key)
  },
  auth: {
    hasAnyUser: (): Promise<ApiResult<boolean>> => ipcRenderer.invoke('auth:hasAnyUser'),
    setupAdmin: (name: string, pin: string): Promise<ApiResult<SafeUser>> =>
      ipcRenderer.invoke('auth:setupAdmin', name, pin),
    login: (pin: string): Promise<ApiResult<SafeUser>> => ipcRenderer.invoke('auth:login', pin)
  },
  users: {
    list: (): Promise<ApiResult<SafeUser[]>> => ipcRenderer.invoke('users:list'),
    create: (input: { name: string; role: UserRole; pin: string }): Promise<ApiResult<SafeUser>> =>
      ipcRenderer.invoke('users:create', input),
    update: (input: { id: number; name?: string; role?: UserRole; isActive?: boolean; pin?: string }): Promise<ApiResult<SafeUser>> =>
      ipcRenderer.invoke('users:update', input)
  },
  settings: {
    pickImage: (kind: 'logo' | 'qr'): Promise<ApiResult<string>> =>
      ipcRenderer.invoke('settings:pickImage', kind),
    clearImage: (kind: 'logo' | 'qr'): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('settings:clearImage', kind),
    get: (): Promise<ApiResult<AppSettings>> => ipcRenderer.invoke('settings:get'),
    save: (input: Partial<AppSettings>): Promise<ApiResult<AppSettings>> =>
      ipcRenderer.invoke('settings:save', input)
  },
  printers: {
    list: (): Promise<ApiResult<PrinterInfo[]>> => ipcRenderer.invoke('printers:list')
  },
  backup: {
    create: (): Promise<ApiResult<string>> => ipcRenderer.invoke('backup:create'),
    restore: (): Promise<ApiResult<string>> => ipcRenderer.invoke('backup:restore'),
    check: (): Promise<ApiResult<string>> => ipcRenderer.invoke('backup:check')
  },
  reports: {
    sales: (filter: { from: string; to: string }): Promise<ApiResult<SalesReport>> =>
      ipcRenderer.invoke('reports:sales', filter)
  },
  print: {
    raw: (text: string): Promise<ApiResult<void>> => ipcRenderer.invoke('print:raw', text),
    test: (): Promise<ApiResult<void>> => ipcRenderer.invoke('print:test'),
    report: (report: SalesReport): Promise<ApiResult<void>> => ipcRenderer.invoke('print:report', report),
    receipt: (order: OrderWithItems): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('print:receipt', order),
    kitchen: (order: OrderWithItems): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('print:kitchen', order)
  },
  orders: {
    list: (filter?: { date?: string; status?: OrderStatus | 'all' | 'kitchen' }): Promise<ApiResult<OrderWithItems[]>> =>
      ipcRenderer.invoke('orders:list', filter),
    create: (input: CreateOrderInput): Promise<ApiResult<OrderWithItems>> =>
      ipcRenderer.invoke('orders:create', input),
    updateStatus: (id: number, status: OrderStatus): Promise<ApiResult<OrderWithItems>> =>
      ipcRenderer.invoke('orders:updateStatus', id, status),
    markKitchenPrinted: (id: number): Promise<ApiResult<OrderWithItems>> =>
      ipcRenderer.invoke('orders:markKitchenPrinted', id),
    addPayment: (input: {
      orderId: number
      amount: number
      method?: string
      note?: string
    }): Promise<ApiResult<OrderWithItems>> => ipcRenderer.invoke('orders:addPayment', input),
    payments: (orderId: number): Promise<ApiResult<OrderPayment[]>> =>
      ipcRenderer.invoke('orders:payments', orderId),
    unpaid: (phone?: string): Promise<ApiResult<OrderWithItems[]>> =>
      ipcRenderer.invoke('orders:unpaid', phone),
    updateItems: (input: {
      orderId: number
      discountAmount: number
      orderType?: OrderType
      tableId?: number | null
      waiterId?: number | null
      customerPhone?: string | null
      customerAddress?: string | null
      deliveryCharge?: number
      note?: string
      items: { productId: number; variantId: number | null; quantity: number; note?: string }[]
    }): Promise<ApiResult<OrderWithItems>> => ipcRenderer.invoke('orders:updateItems', input)
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