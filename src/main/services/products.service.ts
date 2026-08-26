import { eq, asc } from 'drizzle-orm'
import { getDb, getSqlite } from '../db'
import { products, variants, categories, kitchenSections } from '../db/schema'
import type {
  Product,
  ProductWithVariants,
  CreateProductInput,
  UpdateProductInput,
  VariantInput
} from '../../shared/types'

function validateVariants(list: VariantInput[]): VariantInput[] {
  const cleaned = list
    .map((v) => ({ name: v.name.trim(), price: Math.round(v.price) }))
    .filter((v) => v.name.length > 0)
  const names = new Set(cleaned.map((v) => v.name.toLowerCase()))
  if (names.size !== cleaned.length) throw new Error('Variant names must be unique')
  for (const v of cleaned) {
    if (v.price < 0) throw new Error('Variant price cannot be negative')
  }
  return cleaned
}

export function listProducts(): ProductWithVariants[] {
  const db = getDb()
  const prods = db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      kitchenSectionId: products.kitchenSectionId,
      platterContents: products.platterContents,
      name: products.name,
      price: products.price,
      hasVariants: products.hasVariants,
      isActive: products.isActive,
      timesSold: products.timesSold,
      lastSoldAt: products.lastSoldAt,
      createdAt: products.createdAt,
      categoryName: categories.name,
      kitchenSectionName: kitchenSections.name
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(kitchenSections, eq(products.kitchenSectionId, kitchenSections.id))
    .orderBy(asc(categories.sortOrder), asc(categories.name), asc(products.name))
    .all()

  const allVariants = db.select().from(variants).orderBy(asc(variants.sortOrder), asc(variants.id)).all()
  const byProduct = new Map<number, typeof allVariants>()
  for (const v of allVariants) {
    const arr = byProduct.get(v.productId) ?? []
    arr.push(v)
    byProduct.set(v.productId, arr)
  }

  return prods.map((p) => ({ ...p, variants: byProduct.get(p.id) ?? [] }))
}

export function createProduct(input: CreateProductInput): Product {
  const name = input.name.trim()
  if (!name) throw new Error('Product name is required')
  if (input.price < 0) throw new Error('Price cannot be negative')

  const variantList = validateVariants(input.variants ?? [])
  const hasVariants = variantList.length > 0
  const db = getDb()

  const tx = getSqlite().transaction((): Product => {
    const row = db
      .insert(products)
      .values({
        categoryId: input.categoryId,
        kitchenSectionId: input.kitchenSectionId ?? null,
        platterContents: input.platterContents ?? null,
        name,
        price: hasVariants ? 0 : Math.round(input.price),
        hasVariants
      })
      .returning()
      .get()

    variantList.forEach((v, i) => {
      db.insert(variants).values({ productId: row.id, name: v.name, price: v.price, sortOrder: i }).run()
    })

    return row
  })

  return tx()
}

export function updateProduct(input: UpdateProductInput): Product {
  const db = getDb()
  const { id, variants: variantList, ...changes } = input

  if (changes.name !== undefined) {
    changes.name = changes.name.trim()
    if (!changes.name) throw new Error('Product name cannot be empty')
  }
  if (changes.price !== undefined && changes.price < 0) {
    throw new Error('Price cannot be negative')
  }

  const tx = getSqlite().transaction((): Product => {
    let cleanedVariants: VariantInput[] | undefined
    if (variantList !== undefined) {
      cleanedVariants = validateVariants(variantList)
      db.delete(variants).where(eq(variants.productId, id)).run()
      cleanedVariants.forEach((v, i) => {
        db.insert(variants).values({ productId: id, name: v.name, price: v.price, sortOrder: i }).run()
      })
    }

    const finalChanges: Record<string, unknown> = { ...changes }
    if (cleanedVariants !== undefined) {
      finalChanges.hasVariants = cleanedVariants.length > 0
      if (cleanedVariants.length > 0) finalChanges.price = 0
    }
    if (changes.price !== undefined) finalChanges.price = Math.round(changes.price)

    const row = db.update(products).set(finalChanges).where(eq(products.id, id)).returning().get()
    if (!row) throw new Error('Product not found')
    return row
  })

  return tx()
}

export function deleteProduct(id: number): void {
  const used = getSqlite()
    .prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?')
    .get(id) as { count: number }
  if (used.count > 0) {
    throw new Error('This product has been used in orders. Disable it instead of deleting.')
  }
  const result = getDb().delete(products).where(eq(products.id, id)).run()
  if (result.changes === 0) throw new Error('Product not found')
}