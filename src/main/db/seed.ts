import { getSqlite } from './index'

interface SeedProduct {
  name: string
  price?: number
  section?: string
  contents?: string
  variants?: [string, number][]
}

interface SeedMenu {
  sections: string[]
  categories: Record<string, SeedProduct[]>
}

const SML = (s: number, m: number, l: number): [string, number][] => [
  ['Small', s],
  ['Medium', m],
  ['Large', l]
]

const ISLAMIC_PIZZA: SeedMenu = {
  sections: [],
  categories: {
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
      { name: 'Extra Large Pizza', variants: [['2300', 2300], ['2500', 2500], ['2700', 2700]] }
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
      { name: 'Fries', variants: [['Regular', 200], ['Medium', 300], ['Family', 400]] },
      { name: 'Loaded Fries', variants: [['Small', 400], ['Large', 800]] }
    ],
    Pasta: [
      { name: 'Cheese Pasta', variants: [['Small', 500], ['Large', 900]] },
      { name: 'Crunchy Pasta', variants: [['Small', 550], ['Large', 950]] }
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
      { name: 'Nuggets', variants: [['6 Pcs', 300], ['12 Pcs', 600]] }
    ],
    'Hot Wings': [
      { name: 'Hot Wings', variants: [['6 Pcs', 300], ['12 Pcs', 600]] }
    ],
    'Seekh Kabab': [{ name: 'Seekh Kabab (6 Pcs)', price: 400 }],
    Extras: [
      { name: 'Extra Topping Chicken Cheese', variants: [['Small', 100], ['Medium', 150], ['Large', 250]] },
      { name: 'Dip Sauce', price: 50 },
      { name: 'Cheese Sauce', price: 60 }
    ]
  }
}
const SHAH_G: SeedMenu = {
  sections: ['Nashta', 'Chai', 'Paratha', 'Tandoor', 'Khana', 'BBQ', 'Karahi', 'Kabab'],
  categories: {
    'ناشتہ': [
      { name: 'حلوہ پوری', price: 250, section: 'Nashta' },
      { name: 'چنے', price: 200, section: 'Nashta' },
      { name: 'نہاری', price: 350, section: 'Nashta' },
      { name: 'انڈہ آملیٹ/فرائی', price: 60, section: 'Nashta' },
      { name: 'دہی (پلیٹ)', price: 100, section: 'Nashta' }
    ],
    'چائے': [
      { name: 'دودھ پتی', price: 80, section: 'Chai' },
      { name: 'سبز قہوہ', price: 70, section: 'Chai' },
      { name: 'کشمیری چائے', price: 120, section: 'Chai' },
      { name: 'شکر الائچی چائے', price: 100, section: 'Chai' },
      { name: 'لسی', price: 150, section: 'Chai' }
    ],
    'پراٹھا': [
      { name: 'آلو پراٹھا', price: 120, section: 'Paratha' },
      { name: 'سادہ پراٹھا', price: 70, section: 'Paratha' },
      { name: 'چپاتی', price: 20, section: 'Paratha' },
      { name: 'تندوری پراٹھا', price: 70, section: 'Paratha' }
    ],
    'تندور': [
      { name: 'روٹی', price: 20, section: 'Tandoor' },
      { name: 'نان', price: 25, section: 'Tandoor' },
      { name: 'اسپیشل کلچہ', price: 50, section: 'Tandoor' },
      { name: 'روغنی نان', price: 70, section: 'Tandoor' }
    ],
    'دال چاول / بریانی': [
      { name: 'دال چاول', price: 220, section: 'Khana' },
      { name: 'چنے چاول', price: 250, section: 'Khana' },
      { name: 'حلیم چاول', price: 250, section: 'Khana' },
      { name: 'سپیشل چنے چاول', price: 280, section: 'Khana' },
      { name: 'سپیشل دال چاول', price: 280, section: 'Khana' },
      { name: 'سپیشل حلیم چاول', price: 280, section: 'Khana' },
      { name: 'چکن بریانی', price: 350, section: 'Khana' },
      { name: 'سادہ بریانی', price: 200, section: 'Khana' },
      { name: 'مرغ پلاؤ', price: 350, section: 'Khana' },
      { name: 'سادہ پلاؤ', price: 300, section: 'Khana' }
    ],
    'کھانا': [
      { name: 'فرائی گوشت', price: 350, section: 'Khana' },
      { name: 'چکن اچار', price: 300, section: 'Khana' },
      { name: 'چکن حلیم', price: 250, section: 'Khana' },
      { name: 'آلو قیمہ', price: 300, section: 'Khana' },
      { name: 'مکس سبزی', price: 250, section: 'Khana' },
      { name: 'دال ماش', price: 250, section: 'Khana' },
      { name: 'دال چنا', price: 200, section: 'Khana' },
      { name: 'لوبیا', price: 250, section: 'Khana' },
      { name: 'ساگ', price: 250, section: 'Khana' },
      { name: 'کڑی پکوڑا', price: 250, section: 'Khana' },
      { name: 'مکس دال', price: 200, section: 'Khana' },
      { name: 'رائتہ', price: 100, section: 'Khana' },
      { name: 'سلاد', price: 100, section: 'Khana' }
    ],
    'باربی کیو': [
      { name: 'چکن تکہ چیسٹ', price: 400, section: 'BBQ' },
      { name: 'چکن تکہ لیگ', price: 350, section: 'BBQ' },
      { name: 'چکن سیخ بوٹی (5 پیس)', price: 270, section: 'BBQ' },
      { name: 'ملائی سیخ بوٹی (5 پیس)', price: 300, section: 'BBQ' },
      { name: 'سیخ کباب', price: 200, section: 'BBQ' },
      { name: 'چکن رول پراٹھا', price: 300, section: 'BBQ' },
      { name: 'جمبو رول پراٹھا', price: 400, section: 'BBQ' },
      { name: 'بوم بوم رول پراٹھا', price: 450, section: 'BBQ' },
      { name: 'ملائی رول پراٹھا', price: 350, section: 'BBQ' },
      { name: 'کباب رول پراٹھا', price: 350, section: 'BBQ' },
      { name: 'توا تکہ فرائی', price: 650, section: 'BBQ' }
    ],
    'کڑاہی': [
      { name: 'چکن کڑاہی فل', price: 1999, section: 'Karahi' },
      { name: 'چکن کڑاہی ہاف', price: 999, section: 'Karahi' },
      { name: 'چکن ملائی کڑاہی فل', price: 2200, section: 'Karahi' },
      { name: 'چکن ملائی کڑاہی ہاف', price: 1199, section: 'Karahi' },
      { name: 'مٹن کڑاہی فل', price: 4500, section: 'Karahi' },
      { name: 'مٹن کڑاہی ہاف', price: 2300, section: 'Karahi' },
      { name: 'بار بی کیو تکہ فل', price: 1899, section: 'Karahi' },
      { name: 'بار بی کیو تکہ ہاف', price: 950, section: 'Karahi' },
      { name: 'بوٹی فرائی (15 پیس)', price: 1000, section: 'Karahi' },
      { name: 'چکن کباب فرائی (3 پیس)', price: 630, section: 'Karahi' },
      { name: 'چکن کباب فرائی (6 پیس)', price: 1200, section: 'Karahi' }
    ],
    'کباب': [
      { name: 'چپلی کباب چھوٹا', price: 1200, section: 'Kabab' },
      { name: 'چپلی کباب بڑا', price: 1200, section: 'Kabab' }
    ],
    'پلیٹرز': [
      { name: 'شاہ جی اسپیشل پلیٹر', price: 6500, section: 'Khana', contents: '1 فل ساجی، 1 کوارٹر کڑاہی، 1 چیسٹ پیس، 1 لیگ پیس، 2 ملائی بوٹی، 2 سیخ کباب، 1 بڑا کباب، 2 رائتہ، 2 روغنی نان، 2 سادہ نان، 2 روٹی، 1 2.25 لیٹر ڈرنک، 3 پلیٹ چاول' },
      { name: 'باربی کیو پلیٹر', price: 3500, section: 'Khana', contents: '1 فل ساجی، 1 چیسٹ پیس، 1 لیگ پیس، 1 چکن بوٹی، 1 ملائی بوٹی، 1 سیخ کباب، 1 رائتہ، 1 روغنی نان، 1 لیٹر ڈرنک، 2 پلیٹ چاول' },
      { name: 'شاہ جی کپل پلیٹر', price: 1999, section: 'Khana', contents: '1 لیگ پیس، 1 چیسٹ پیس، 1 ملائی بوٹی، 1 چکن بوٹی، 1 رائتہ، 2 ریگولر ڈرنک، 1.5 پلیٹ چاول' },
      { name: 'ساجو پلیٹر', price: 1450, section: 'Khana', contents: '1 چکن پلاؤ، 1 چپلی کباب، 1 رائتہ، 2 روٹی، 2 سادہ نان، 2 ریگولر ڈرنک' }
    ]
  }
}

void ISLAMIC_PIZZA
const ACTIVE: SeedMenu = SHAH_G

export function seedIfEmpty(): void {
  return

  const sqlite = getSqlite()
  const count = sqlite.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }
  if (count.c > 0) return

  const insertSection = sqlite.prepare('INSERT INTO kitchen_sections (name, sort_order) VALUES (?, ?)')
  const insertCat = sqlite.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)')
  const insertProd = sqlite.prepare(
    'INSERT INTO products (category_id, kitchen_section_id, name, price, has_variants, platter_contents) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertVar = sqlite.prepare(
    'INSERT INTO variants (product_id, name, price, sort_order) VALUES (?, ?, ?, ?)'
  )

  const tx = sqlite.transaction(() => {
    const sectionId = new Map<string, number>()
    let secOrder = 0
    for (const s of ACTIVE.sections) {
      const id = insertSection.run(s, secOrder++).lastInsertRowid as number
      sectionId.set(s, id)
    }

    let catOrder = 0
    for (const [catName, items] of Object.entries(ACTIVE.categories)) {
      const catId = insertCat.run(catName, catOrder++).lastInsertRowid as number
      for (const item of items) {
        const hasVariants = (item.variants?.length ?? 0) > 0
        const secId = item.section ? (sectionId.get(item.section) ?? null) : null
        const prodId = insertProd.run(
          catId,
          secId,
          item.name,
          hasVariants ? 0 : (item.price ?? 0),
          hasVariants ? 1 : 0,
          item.contents ?? null
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