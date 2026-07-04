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

export interface Product {
  id: number
  categoryId: number
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
}

export interface VariantInput {
  name: string
  price: number
}

export interface CreateProductInput {
  categoryId: number
  name: string
  price: number
  variants?: VariantInput[]
}

export interface UpdateProductInput {
  id: number
  categoryId?: number
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
  orderType: OrderType
  tableId?: number | null
  waiterId?: number | null
  customerPhone?: string
  customerAddress?: string
  discountPercent: number
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
  orderNumber: string
  orderType: OrderType
  tableId: number | null
  waiterId: number | null
  status: OrderStatus
  subtotal: number
  discountPercent: number
  discount: number
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

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}