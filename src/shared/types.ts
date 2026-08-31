export interface Category {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export interface CreateCategoryInput {
  name: string
  sortOrder?: number
}

export interface UpdateCategoryInput {
  id: number
  name?: string
  sortOrder?: number
  isActive?: boolean
}

export interface NamedEntity {
  id: number
  name: string
  isActive: boolean
  createdAt: string
}

export type RestaurantTable = NamedEntity
export type Waiter = NamedEntity

export interface CreateNamedEntityInput {
  name: string
}

export interface UpdateNamedEntityInput {
  id: number
  name?: string
  isActive?: boolean
}

export interface Variant {
  id: number
  productId: number
  name: string
  price: number
  sortOrder: number
  isActive: boolean
}

export interface KitchenSection {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export interface CreateKitchenSectionInput {
  name: string
}

export interface UpdateKitchenSectionInput {
  id: number
  name?: string
  isActive?: boolean
}

export interface Product {
  id: number
  categoryId: number
  kitchenSectionId: number | null
  platterContents: string | null
  name: string
  price: number
  hasVariants: boolean
  isActive: boolean
  timesSold: number
  lastSoldAt: string | null
  createdAt: string
}

export interface ProductWithVariants extends Product {
  variants: Variant[]
  categoryName: string
  kitchenSectionName: string | null
}

export interface VariantInput {
  name: string
  price: number
}

export interface CreateProductInput {
  categoryId: number
  kitchenSectionId?: number | null
  platterContents?: string | null
  name: string
  price: number
  variants?: VariantInput[]
}

export interface UpdateProductInput {
  id: number
  categoryId?: number
  kitchenSectionId?: number | null
  platterContents?: string | null
  name?: string
  price?: number
  isActive?: boolean
  variants?: VariantInput[]
}

export type OrderType = 'dine_in' | 'take_away' | 'delivery'
export type OrderStatus = 'pending' | 'kitchen_printed' | 'paid' | 'cancelled'

export interface OrderItemInput {
  productId: number
  variantId: number | null
  quantity: number
  note?: string
}

export interface CreateOrderInput {
  userId?: number | null
  customerName?: string
  orderType: OrderType
  tableId?: number | null
  waiterId?: number | null
  customerPhone?: string
  customerAddress?: string
  discountAmount: number
  deliveryCharge: number
  note?: string
  markPaid: boolean
  items: OrderItemInput[]
}

export interface OrderItem {
  id: number
  orderId: number
  productId: number
  variantId: number | null
  productName: string
  variantName: string | null
  unitPrice: number
  quantity: number
  note: string | null
  lineTotal: number
}

export interface Order {
  id: number
  userId: number | null
  orderNumber: string
  orderType: OrderType
  tableId: number | null
  waiterId: number | null
  status: OrderStatus
  subtotal: number
  discountPercent: number
  discount: number
  deliveryCharge: number
  taxAmount: number
  total: number
  note: string | null
  customerPhone: string | null
  customerAddress: string | null
  createdAt: string
  paidAt: string | null
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

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
  receiptLogo: string
  paymentQr: string
}

export interface PrinterInfo {
  name: string
  isDefault: boolean
}

export interface SalesSummary {
  paidOrders: number
  paidRevenue: number
  pendingOrders: number
  pendingAmount: number
  cancelledOrders: number
  totalDiscount: number
  avgOrderValue: number
}

export interface PopularProduct {
  productName: string
  variantName: string | null
  quantity: number
  revenue: number
}

export interface DailySales {
  date: string
  orders: number
  revenue: number
}

export interface SalesReport {
  from: string
  to: string
  summary: SalesSummary
  popular: PopularProduct[]
  daily: DailySales[]
}

export type UserRole = 'admin' | 'cashier'

export interface SafeUser {
  id: number
  name: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

export type ExpenseCategory =
  | 'ingredients'
  | 'utilities'
  | 'salaries'
  | 'rent'
  | 'equipment'
  | 'other'

export interface ExpenseItem {
  id: number
  name: string
  isActive: boolean
  createdAt: string
}

export interface Expense {
  id: number
  expenseDate: string
  category: ExpenseCategory
  expenseItemId: number | null
  itemName?: string | null
  quantity: string | null
  description: string | null
  amount: number
  userId: number | null
  createdAt: string
}

export interface CreateExpenseInput {
  expenseDate: string
  category: ExpenseCategory
  expenseItemId?: number | null
  quantity?: string
  description?: string
  amount: number
  userId?: number | null
}

export interface UpdateExpenseInput {
  id: number
  expenseDate?: string
  category?: ExpenseCategory
  expenseItemId?: number | null
  quantity?: string
  description?: string
  amount?: number
}

export interface Customer {
  id: number
  name: string | null
  phone: string
  address: string | null
  timesOrdered: number
  lastOrderAt: string | null
  createdAt: string
}

export interface LicenseStatus {
  activated: boolean
  machineId: string
  expiresOn: string | null
  daysLeft: number | null
  error?: string
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}
export interface BusinessDay {
  id: number
  openedAt: string
  closedAt: string | null
  openingFloat: number
  status: 'open' | 'closed'
  zNumber: number | null
  totalOrders: number
  paidOrders: number
  totalRevenue: number
  totalDiscount: number
  expectedCash: number
  countedCash: number | null
  cashDifference: number | null
  note: string | null
}

export interface CurrentDayTotals {
  day: BusinessDay | null
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  totalRevenue: number
  totalDiscount: number
  expectedCash: number
}