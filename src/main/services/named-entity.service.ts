import { eq, asc } from 'drizzle-orm'
import { getDb } from '../db'
import { restaurantTables, waiters } from '../db/schema'
import type { NamedEntity, CreateNamedEntityInput, UpdateNamedEntityInput } from '../../shared/types'

type NamedTable = typeof restaurantTables | typeof waiters

function makeService(table: NamedTable): {
  list: () => NamedEntity[]
  create: (input: CreateNamedEntityInput) => NamedEntity
  update: (input: UpdateNamedEntityInput) => NamedEntity
  remove: (id: number) => void
} {
  return {
    list(): NamedEntity[] {
      return getDb().select().from(table).orderBy(asc(table.name)).all()
    },
    create(input: CreateNamedEntityInput): NamedEntity {
      const name = input.name.trim()
      if (!name) throw new Error('Name is required')
      return getDb().insert(table).values({ name }).returning().get()
    },
    update(input: UpdateNamedEntityInput): NamedEntity {
      const { id, ...changes } = input
      if (changes.name !== undefined && !changes.name.trim()) {
        throw new Error('Name cannot be empty')
      }
      if (changes.name !== undefined) changes.name = changes.name.trim()
      const row = getDb().update(table).set(changes).where(eq(table.id, id)).returning().get()
      if (!row) throw new Error('Not found')
      return row
    },
    remove(id: number): void {
      const result = getDb().delete(table).where(eq(table.id, id)).run()
      if (result.changes === 0) throw new Error('Not found')
    }
  }
}

export const tablesService = makeService(restaurantTables)
export const waitersService = makeService(waiters)