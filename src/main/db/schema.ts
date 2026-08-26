import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const kitchenSections = sqliteTable('kitchen_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  kitchenSectionId: integer('kitchen_section_id').references(() => kitchenSections.id),
  name: text('name').notNull(),
  price: integer('price').notNull().default(0),
  hasVariants: integer('has_variants', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  timesSold: integer('times_sold').notNull().default(0),
  lastSoldAt: text('last_sold_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const variants = sqliteTable('variants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price: integer('price').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
})

export const restaurantTables = sqliteTable('restaurant_tables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const waiters = sqliteTable('waiters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNumber: text('order_number').notNull().unique(),
  orderType: text('order_type', { enum: ['dine_in', 'take_away', 'delivery'] }).notNull(),
  tableId: integer('table_id').references(() => restaurantTables.id),
  waiterId: integer('waiter_id').references(() => waiters.id),
  status: text('status', {
    enum: ['pending', 'kitchen_printed', 'paid', 'cancelled']
  })
    .notNull()
    .default('pending'),
  subtotal: integer('subtotal').notNull().default(0),
  discountPercent: integer('discount_percent').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  deliveryCharge: integer('delivery_charge').notNull().default(0),
  taxAmount: integer('tax_amount').notNull().default(0),
  total: integer('total').notNull().default(0),
  note: text('note'),
  userId: integer('user_id').references(() => users.id),
  customerPhone: text('customer_phone'),
  customerAddress: text('customer_address'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  paidAt: text('paid_at')
})

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull(),
  variantId: integer('variant_id'),
  productName: text('product_name').notNull(),
  variantName: text('variant_name'),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull().default(1),
  note: text('note'),
  lineTotal: integer('line_total').notNull()
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'cashier'] }).notNull().default('cashier'),
  pinHash: text('pin_hash').notNull(),
  pinSalt: text('pin_salt').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const expenseItems = sqliteTable('expense_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  expenseDate: text('expense_date').notNull(),
  category: text('category', {
    enum: ['ingredients', 'utilities', 'salaries', 'rent', 'equipment', 'other']
  }).notNull(),
  expenseItemId: integer('expense_item_id').references(() => expenseItems.id),
  quantity: text('quantity'),
  description: text('description'),
  amount: integer('amount').notNull(),
  userId: integer('user_id').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  phone: text('phone').notNull().unique(),
  address: text('address'),
  timesOrdered: integer('times_ordered').notNull().default(0),
  lastOrderAt: text('last_order_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`)
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})