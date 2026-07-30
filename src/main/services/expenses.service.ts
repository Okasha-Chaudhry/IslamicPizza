import { eq, and, gte, lte, desc, asc } from 'drizzle-orm'
import { getDb, getSqlite } from '../db'
import { expenses, expenseItems } from '../db/schema'
import type {
  Expense,
  ExpenseItem,
  CreateExpenseInput,
  UpdateExpenseInput
} from '../../shared/types'

const VALID_CATEGORIES = ['ingredients', 'utilities', 'salaries', 'rent', 'equipment', 'other']

function validate(input: { amount?: number; category?: string; expenseDate?: string }): void {
  if (input.amount !== undefined && (!Number.isFinite(input.amount) || input.amount <= 0)) {
    throw new Error('Amount must be a positive number')
  }
  if (input.category !== undefined && !VALID_CATEGORIES.includes(input.category)) {
    throw new Error('Invalid category')
  }
  if (input.expenseDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)) {
    throw new Error('Invalid date')
  }
}

// ---- Supply items ----

export function listExpenseItems(): ExpenseItem[] {
  return getDb().select().from(expenseItems).orderBy(asc(expenseItems.name)).all()
}

export function createExpenseItem(name: string): ExpenseItem {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Item name is required')
  const existing = getSqlite()
    .prepare('SELECT id FROM expense_items WHERE LOWER(name) = LOWER(?)')
    .get(trimmed)
  if (existing) throw new Error('Item already exists')
  return getDb().insert(expenseItems).values({ name: trimmed }).returning().get()
}

export function updateExpenseItem(input: {
  id: number
  name?: string
  isActive?: boolean
}): ExpenseItem {
  const { id, ...changes } = input
  if (changes.name !== undefined) {
    changes.name = changes.name.trim()
    if (!changes.name) throw new Error('Item name cannot be empty')
  }
  const row = getDb().update(expenseItems).set(changes).where(eq(expenseItems.id, id)).returning().get()
  if (!row) throw new Error('Item not found')
  return row
}

// ---- Expenses ----

export function listExpenses(filter: { from: string; to: string }): Expense[] {
  const rows = getDb()
    .select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      category: expenses.category,
      expenseItemId: expenses.expenseItemId,
      itemName: expenseItems.name,
      quantity: expenses.quantity,
      description: expenses.description,
      amount: expenses.amount,
      userId: expenses.userId,
      createdAt: expenses.createdAt
    })
    .from(expenses)
    .leftJoin(expenseItems, eq(expenses.expenseItemId, expenseItems.id))
    .where(and(gte(expenses.expenseDate, filter.from), lte(expenses.expenseDate, filter.to)))
    .orderBy(desc(expenses.expenseDate), desc(expenses.id))
    .all()
  return rows as Expense[]
}

export function createExpense(input: CreateExpenseInput): Expense {
  validate(input)
  const row = getDb()
    .insert(expenses)
    .values({
      expenseDate: input.expenseDate,
      category: input.category,
      expenseItemId: input.expenseItemId ?? null,
      quantity: input.quantity?.trim() || null,
      description: input.description?.trim() || null,
      amount: Math.round(input.amount),
      userId: input.userId ?? null
    })
    .returning()
    .get()
  return { ...row, itemName: null }
}

export function updateExpense(input: UpdateExpenseInput): Expense {
  const { id, ...changes } = input
  validate(changes)
  const finalChanges: Record<string, unknown> = { ...changes }
  if (changes.description !== undefined) finalChanges.description = changes.description.trim() || null
  if (changes.quantity !== undefined) finalChanges.quantity = changes.quantity.trim() || null
  if (changes.amount !== undefined) finalChanges.amount = Math.round(changes.amount)
  const row = getDb().update(expenses).set(finalChanges).where(eq(expenses.id, id)).returning().get()
  if (!row) throw new Error('Expense not found')
  return { ...row, itemName: null }
}

export function deleteExpense(id: number): void {
  const result = getDb().delete(expenses).where(eq(expenses.id, id)).run()
  if (result.changes === 0) throw new Error('Expense not found')
}

// ---- Summaries ----

export interface ExpenseSummary {
  total: number
  byCategory: { category: string; total: number }[]
  byItem: { itemName: string; purchases: number; total: number; lastDate: string }[]
}

export function expenseSummary(filter: { from: string; to: string }): ExpenseSummary {
  const sqlite = getSqlite()
  const byCategory = sqlite
    .prepare(
      `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM expenses WHERE expense_date BETWEEN ? AND ?
       GROUP BY category ORDER BY total DESC`
    )
    .all(filter.from, filter.to) as { category: string; total: number }[]

  const byItem = sqlite
    .prepare(
      `SELECT ei.name AS itemName, COUNT(*) AS purchases,
              COALESCE(SUM(e.amount), 0) AS total, MAX(e.expense_date) AS lastDate
       FROM expenses e JOIN expense_items ei ON ei.id = e.expense_item_id
       WHERE e.expense_date BETWEEN ? AND ?
       GROUP BY ei.name ORDER BY total DESC`
    )
    .all(filter.from, filter.to) as {
    itemName: string
    purchases: number
    total: number
    lastDate: string
  }[]

  return {
    total: byCategory.reduce((s, r) => s + r.total, 0),
    byCategory,
    byItem
  }
}