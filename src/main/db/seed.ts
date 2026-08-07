import { getSqlite } from './index'

interface SeedProduct {
  name: string
  price?: number
  variants?: [string, number][]
}

const SML = (s: number, m: number, l: number): [string, number][] => [
  ['Small', s],
  ['Medium', m],
  ['Large', l]
]

const MENU: Record<string, SeedProduct[]> = {
  Pizza: [
    { name: 'Chicken Fajita Pizza', variants: SML(550, 950, 1400) },
    { name: 'Chicken Tikka Pizza', variants: SML(550, 950, 1400) },
    { name: 'Veggie Lover Pizza', variants: SML(550, 950, 1400) },
    { name: 'Cheese Lover Pizza', variants: SML(550, 950, 1400) },
    { name: 'Shahi Pizza', variants: SML(600, 1000, 1500) },
    { name: 'Bone Fire Pizza', variants: SML(600, 1000, 1500) },
    { name: 'Supreme Pizza', variants: SML(600, 1000, 1500) },
    { name: 'Shawarma Pizza', variants: SML(600, 1000, 1500) },
    { name: 'Afghani Tikka Pizza', variants: SML(650, 1050, 1600) },
    { name: 'Seekh Kabab Pizza', variants: SML(650, 1050, 1600) },
    { name: 'BBQ Pizza', variants: SML(650, 1050, 1600) },
    { name: 'Malai Boti Pizza', variants: SML(650, 1050, 1600) },
    { name: 'Peri Peri Pizza', variants: SML(650, 1050, 1600) },
    { name: 'Extreme Pizza', variants: SML(700, 1100, 1700) },
    { name: 'Special Behari Pizza', variants: SML(700, 1100, 1700) },
    { name: 'Crown Crust Pizza', variants: SML(700, 1100, 1700) },
    { name: 'Lasagnia Pizza', variants: SML(750, 1150, 1800) },
    { name: 'Special Islamic Pizza', variants: SML(750, 1150, 1800) },
    {
      name: 'Extra Large Pizza',
      variants: [
        ['2300', 2300],
        ['2500', 2500],
        ['2700', 2700]
      ]
    },
  ],
  Wraps: [
    { name: 'Arabic Wrap', price: 550 },
    { name: 'Crispy Wrap', price: 650 },
    { name: 'BBQ Wrap', price: 650 }
  ],
  'Chicken Rolls': [
    { name: 'Shawarma Roll', price: 220 },
    { name: 'Paratha Roll', price: 300 },
    { name: 'Cheese Paratha Roll', price: 350 },
    { name: 'Cheese Shawarma', price: 250 },
    { name: 'Kabab Paratha', price: 300 },
    { name: 'Zingish Roll', price: 350 },
    { name: 'Pizza Paratha', price: 600 },
    { name: 'Behari Roll', price: 350 },
    { name: 'Turkish Roll', price: 400 },
    { name: 'Shawarma Sandwich', price: 550 }
  ],
  Fries: [
    {
      name: 'Fries',
      variants: [
        ['Regular', 200],
        ['Medium', 300],
        ['Family', 400]
      ]
    },
    {
      name: 'Loaded Fries',
      variants: [
        ['Small', 400],
        ['Large', 800]
      ]
    }
  ],
  Pasta: [
    {
      name: 'Cheese Pasta',
      variants: [
        ['Small', 500],
        ['Large', 900]
      ]
    },
    {
      name: 'Crunchy Pasta',
      variants: [
        ['Small', 550],
        ['Large', 950]
      ]
    }
  ],
  Burgers: [
    { name: 'Zinger Burger', price: 330 },
    { name: 'Tikka Burger', price: 300 },
    { name: 'Chicken Patty Burger', price: 300 },
    { name: 'Double Patty Burger', price: 500 },
    { name: 'Kabab Burger', price: 300 },
    { name: 'Grill Burger', price: 600 },
    { name: 'Double Decker Burger', price: 600 },
    { name: 'Mighty Burger', price: 650 },
    { name: 'Thunder Cheese Burger', price: 450 }
  ],
  'Chicken Broast': [
    { name: 'Chest Piece', price: 400 },
    { name: 'Leg Piece', price: 380 },
    { name: 'Zinger Piece', price: 250 },
    { name: 'Drum Piece', price: 250 },
    { name: 'Thigh Piece', price: 250 },
    { name: 'BBQ Piece', price: 400 }
  ],
  Nuggets: [
    {
      name: 'Nuggets',
      variants: [
        ['6 Pcs', 300],
        ['12 Pcs', 600]
      ]
    }
  ],
  'Hot Wings': [
    {
      name: 'Hot Wings',
      variants: [
        ['6 Pcs', 300],
        ['12 Pcs', 600]
      ]
    }
  ],
  'Seekh Kabab': [{ name: 'Seekh Kabab (6 Pcs)', price: 400 }],
  Extras: [
    {
      name: 'Extra Topping Chicken Cheese',
      variants: [
        ['Small', 100],
        ['Medium', 150],
        ['Large', 250]
      ]
    },
    { name: 'Dip Sauce', price: 50 },
    { name: 'Cheese Sauce', price: 60 }
  ]
}

export function seedIfEmpty(): void {
  // Generic build: no menu seeding. Client menu entered at delivery.
  // (Islamic Pizza menu kept below; remove this return for their builds.)
  return

  const sqlite = getSqlite()
  const count = sqlite.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }
  if (count.c > 0) return

  const insertCat = sqlite.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)')
  const insertProd = sqlite.prepare(
    'INSERT INTO products (category_id, name, price, has_variants) VALUES (?, ?, ?, ?)'
  )
  const insertVar = sqlite.prepare(
    'INSERT INTO variants (product_id, name, price, sort_order) VALUES (?, ?, ?, ?)'
  )

  const tx = sqlite.transaction(() => {
    let catOrder = 0
    for (const [catName, items] of Object.entries(MENU)) {
      const catId = insertCat.run(catName, catOrder++).lastInsertRowid as number
      for (const item of items) {
        const hasVariants = (item.variants?.length ?? 0) > 0
        const prodId = insertProd.run(
          catId,
          item.name,
          hasVariants ? 0 : (item.price ?? 0),
          hasVariants ? 1 : 0
        ).lastInsertRowid as number
        item.variants?.forEach(([vName, vPrice], i) => {
          insertVar.run(prodId, vName, vPrice, i)
        })
      }
    }
  })
  tx()
  console.log('[db] menu seeded')
}