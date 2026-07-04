import { eq, asc } from 'drizzle-orm'
import { getDb, getSqlite } from '../db'
import { categories } from '../db/schema'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../../shared/types'

export function listCategories(): Category[] {
  return getDb()
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all()
}

export function createCategory(input: CreateCategoryInput): Category {
  const name = input.name.trim()
  if (!name) throw new Error('Category name is required')
  const row = getDb()
    .insert(categories)
    .values({ name, sortOrder: input.sortOrder ?? 0 })
    .returning()
    .get()
  return row
}

export function updateCategory(input: UpdateCategoryInput): Category {
  const { id, ...changes } = input
  if (changes.name !== undefined && !changes.name.trim()) {
    throw new Error('Category name cannot be empty')
  }
  const row = getDb().update(categories).set(changes).where(eq(categories.id, id)).returning().get()
  if (!row) throw new Error('Category not found')
  return row
}

export function deleteCategory(id: number): void {
  const used = getSqlite()
    .prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?')
    .get(id) as { count: number }
  if (used.count > 0) {
    throw new Error('This category has products. Move or delete its products first, or disable the category.')
  }
  const result = getDb().delete(categories).where(eq(categories.id, id)).run()
  if (result.changes === 0) throw new Error('Category not found')
}