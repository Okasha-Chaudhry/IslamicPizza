import { eq, asc } from 'drizzle-orm'
import { getDb, getSqlite } from '../db'
import { kitchenSections } from '../db/schema'
import type {
  KitchenSection,
  CreateKitchenSectionInput,
  UpdateKitchenSectionInput
} from '../../shared/types'

export function listKitchenSections(): KitchenSection[] {
  return getDb()
    .select()
    .from(kitchenSections)
    .orderBy(asc(kitchenSections.sortOrder), asc(kitchenSections.name))
    .all()
}

export function createKitchenSection(input: CreateKitchenSectionInput): KitchenSection {
  const name = input.name.trim()
  if (!name) throw new Error('Section name is required')
  const row = getDb().insert(kitchenSections).values({ name }).returning().get()
  return row
}

export function updateKitchenSection(input: UpdateKitchenSectionInput): KitchenSection {
  const { id, ...changes } = input
  if (changes.name !== undefined && !changes.name.trim()) {
    throw new Error('Section name cannot be empty')
  }
  const row = getDb()
    .update(kitchenSections)
    .set(changes)
    .where(eq(kitchenSections.id, id))
    .returning()
    .get()
  if (!row) throw new Error('Kitchen section not found')
  return row
}

export function deleteKitchenSection(id: number): void {
  const used = getSqlite()
    .prepare('SELECT COUNT(*) as count FROM products WHERE kitchen_section_id = ?')
    .get(id) as { count: number }
  if (used.count > 0) {
    throw new Error('This section has items. Move its items to another section first.')
  }
  const result = getDb().delete(kitchenSections).where(eq(kitchenSections.id, id)).run()
  if (result.changes === 0) throw new Error('Kitchen section not found')
}
