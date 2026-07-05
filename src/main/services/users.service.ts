import { createHash, randomBytes } from 'crypto'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '../db'
import { users } from '../db/schema'
import type { SafeUser, UserRole } from '../../shared/types'

function hashPin(pin: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex')
}

function validatePin(pin: string): void {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4-6 digits')
}

function toSafe(u: typeof users.$inferSelect): SafeUser {
  return { id: u.id, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt }
}

export function hasAnyUser(): boolean {
  const row = getDb().select({ id: users.id }).from(users).limit(1).get()
  return row !== undefined
}

export function setupAdmin(name: string, pin: string): SafeUser {
  if (hasAnyUser()) throw new Error('Setup already completed')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  validatePin(pin)
  const salt = randomBytes(16).toString('hex')
  const row = getDb()
    .insert(users)
    .values({ name: trimmed, role: 'admin', pinHash: hashPin(pin, salt), pinSalt: salt })
    .returning()
    .get()
  return toSafe(row)
}

export function login(pin: string): SafeUser {
  validatePin(pin)
  const all = getDb().select().from(users).where(eq(users.isActive, true)).all()
  for (const u of all) {
    if (hashPin(pin, u.pinSalt) === u.pinHash) return toSafe(u)
  }
  throw new Error('Invalid PIN')
}

export function listUsers(): SafeUser[] {
  return getDb().select().from(users).orderBy(asc(users.name)).all().map(toSafe)
}

export function createUser(input: { name: string; role: UserRole; pin: string }): SafeUser {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  validatePin(input.pin)
  const salt = randomBytes(16).toString('hex')
  const row = getDb()
    .insert(users)
    .values({ name, role: input.role, pinHash: hashPin(input.pin, salt), pinSalt: salt })
    .returning()
    .get()
  return toSafe(row)
}

export function updateUser(input: {
  id: number
  name?: string
  role?: UserRole
  isActive?: boolean
  pin?: string
}): SafeUser {
  const { id, pin, ...changes } = input
  const db = getDb()
  const existing = db.select().from(users).where(eq(users.id, id)).get()
  if (!existing) throw new Error('User not found')

  if (changes.name !== undefined && !changes.name.trim()) throw new Error('Name cannot be empty')

  // Guard: never allow zero active admins
  const demotingAdmin =
    existing.role === 'admin' &&
    (changes.role === 'cashier' || changes.isActive === false)
  if (demotingAdmin) {
    const activeAdmins = db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .all()
      .filter((u) => u.isActive && u.id !== id)
    if (activeAdmins.length === 0) throw new Error('At least one active admin is required')
  }

  const finalChanges: Record<string, unknown> = { ...changes }
  if (changes.name !== undefined) finalChanges.name = changes.name.trim()
  if (pin !== undefined) {
    validatePin(pin)
    const salt = randomBytes(16).toString('hex')
    finalChanges.pinSalt = salt
    finalChanges.pinHash = hashPin(pin, salt)
  }

  const row = db.update(users).set(finalChanges).where(eq(users.id, id)).returning().get()
  return toSafe(row)
}