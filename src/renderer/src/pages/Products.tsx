import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import ProductFormDialog from '@/components/products/ProductFormDialog'
import { cn } from '@/lib/utils'
import type { Category, KitchenSection, ProductWithVariants } from '../../../shared/types'

export default function Products(): React.JSX.Element {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [kitchenSections, setKitchenSections] = useState<KitchenSection[]>([])
  const [filterCat, setFilterCat] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductWithVariants | null>(null)
  const [error, setError] = useState('')

  async function refresh(): Promise<void> {
    const [pRes, cRes, sRes] = await Promise.all([
      window.api.products.list(),
      window.api.categories.list(),
      window.api.kitchenSections.list()
    ])
    if (pRes.ok && pRes.data) setProducts(pRes.data)
    if (cRes.ok && cRes.data) setCategories(cRes.data)
    if (sRes.ok && sRes.data) setKitchenSections(sRes.data)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const visible = filterCat === null ? products : products.filter((p) => p.categoryId === filterCat)

  function openCreate(): void {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(p: ProductWithVariants): void {
    setEditing(p)
    setDialogOpen(true)
  }

  async function toggleActive(p: ProductWithVariants): Promise<void> {
    await window.api.products.update({ id: p.id, isActive: !p.isActive })
    await refresh()
  }

  async function remove(id: number): Promise<void> {
    setError('')
    const res = await window.api.products.delete(id)
    if (!res.ok) setError(res.error ?? 'Delete failed')
    await refresh()
  }

  function priceLabel(p: ProductWithVariants): string {
    if (!p.hasVariants) return `Rs ${p.price}`
    const prices = p.variants.map((v) => v.price)
    if (prices.length === 0) return 'N/A'
    return `Rs ${Math.min(...prices)} - ${Math.max(...prices)}`
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu Items</h1>
        <Button className="h-11" onClick={openCreate}>
          <Plus className="size-4" /> New Item
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filterCat === null ? 'default' : 'outline'}
          size="sm"
          className="h-10"
          onClick={() => setFilterCat(null)}
        >
          All
        </Button>
        {categories.map((c) => (
          <Button
            key={c.id}
            variant={filterCat === c.id ? 'default' : 'outline'}
            size="sm"
            className="h-10"
            onClick={() => setFilterCat(c.id)}
          >
            {c.name}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="h-11 px-3 font-medium">Name</th>
              <th className="h-11 px-3 font-medium">Category</th>
              <th className="h-11 px-3 font-medium">Price</th>
              <th className="h-11 px-3 font-medium">Variants</th>
              <th className="h-11 px-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className={cn('border-t', !p.isActive && 'opacity-50')}>
                <td className="h-14 px-3 font-medium">{p.name}</td>
                <td className="h-14 px-3 text-muted-foreground">{p.categoryName}</td>
                <td className="h-14 px-3">{priceLabel(p)}</td>
                <td className="h-14 px-3 text-muted-foreground">
                  {p.hasVariants ? p.variants.map((v) => v.name).join(', ') : '-'}
                </td>
                <td className="h-14 px-3">
                  <div className="flex items-center justify-end gap-2">
                    <Switch checked={p.isActive} onCheckedChange={() => void toggleActive(p)} />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void remove(p.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No menu items yet. Click &quot;New Item&quot; to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        kitchenSections={kitchenSections}
        product={editing}
        onSaved={() => void refresh()}
      />
    </div>
  )
}