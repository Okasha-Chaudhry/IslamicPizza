import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { Category, KitchenSection, ProductWithVariants } from '../../../../shared/types'

const priceString = z
  .string()
  .refine((v) => v.trim() !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Enter a valid price')

const formSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required'),
  categoryId: z.string().min(1, 'Select a category'),
  kitchenSectionId: z.string(),
  platterContents: z.string(),
  price: z.string(),
  variants: z.array(
    z.object({
      name: z.string().trim().min(1, 'Variant name is required'),
      price: priceString
    })
  )
})

type FormValues = z.infer<typeof formSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  kitchenSections: KitchenSection[]
  product: ProductWithVariants | null
  onSaved: () => void
}

const URDU_MAP: Record<string, string> = {
  kh: 'کھ', gh: 'گھ', ch: 'چ', sh: 'ش', ph: 'پھ', th: 'تھ', bh: 'بھ',
  dh: 'دھ', rh: 'رھ', aa: 'آ', ee: 'ی', oo: 'و',
  a: 'ا', b: 'ب', c: 'ک', d: 'د', e: 'ی', f: 'ف', g: 'گ', h: 'ہ',
  i: 'ی', j: 'ج', k: 'ک', l: 'ل', m: 'م', n: 'ن', o: 'و', p: 'پ',
  q: 'ق', r: 'ر', s: 'س', t: 'ت', u: 'و', v: 'و', w: 'و', x: 'کس',
  y: 'ی', z: 'ز', ' ': ' '
}

function romanToUrdu(text: string): string {
  let out = ''
  let i = 0
  const lower = text.toLowerCase()
  while (i < lower.length) {
    const two = lower.substr(i, 2)
    if (URDU_MAP[two]) { out += URDU_MAP[two]; i += 2; continue }
    const one = lower[i]
    out += URDU_MAP[one] ?? one
    i += 1
  }
  return out
}

export default function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  kitchenSections,
  product,
  onSaved
}: Props): React.JSX.Element {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', categoryId: '', kitchenSectionId: '', platterContents: '', price: '0', variants: [] }
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' })
  const hasVariants = form.watch('variants').length > 0

  useEffect(() => {
    if (open) {
      form.reset(
        product
          ? {
              name: product.name,
              categoryId: String(product.categoryId),
              kitchenSectionId: product.kitchenSectionId ? String(product.kitchenSectionId) : '',
              platterContents: product.platterContents ?? '',
              price: String(product.price),
              variants: product.variants.map((v) => ({ name: v.name, price: String(v.price) }))
            }
          : { name: '', categoryId: '', kitchenSectionId: '', platterContents: '', price: '0', variants: [] }
      )
    }
  }, [open, product, form])

  async function onSubmit(values: FormValues): Promise<void> {
    if (values.variants.length === 0 && priceString.safeParse(values.price).success === false) {
      form.setError('price', { message: 'Enter a valid price' })
      return
    }

    const payload = {
      name: values.name,
      categoryId: Number(values.categoryId),
      kitchenSectionId: values.kitchenSectionId ? Number(values.kitchenSectionId) : null,
      platterContents: values.platterContents.trim() || null,
      price: values.variants.length > 0 ? 0 : Number(values.price),
      variants: values.variants.map((v) => ({ name: v.name, price: Number(v.price) }))
    }

    const res = product
      ? await window.api.products.update({ id: product.id, ...payload })
      : await window.api.products.create(payload)

    if (!res.ok) {
      form.setError('root', { message: res.error ?? 'Save failed' })
      return
    }
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <div className="flex gap-2">
              <Input id="name" className="h-11 flex-1" {...form.register('name')} autoFocus />
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                onClick={() => form.setValue('name', romanToUrdu(form.getValues('name')))}
                title="Convert typed English to Urdu"
              >
                → اردو
              </Button>
            </div>
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.watch('categoryId')}
              onValueChange={(v) => form.setValue('categoryId', v, { shouldValidate: true })}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.categoryId && (
              <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Kitchen Section (optional)</Label>
            <Select
              value={form.watch('kitchenSectionId') || 'none'}
              onValueChange={(v) => form.setValue('kitchenSectionId', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="No section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No section</SelectItem>
                {kitchenSections
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platterContents">Platter Contents (optional)</Label>
            <textarea
              id="platterContents"
              rows={3}
              placeholder="e.g. 1 Full Saji, 2 Malai Boti, 2 Roti, 3 Plate Rice"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register('platterContents')}
            />
            <p className="text-xs text-muted-foreground">
              For platters/combos: list the items inside. These print on the kitchen slip and receipt.
            </p>
          </div>

          {!hasVariants && (
            <div className="space-y-2">
              <Label htmlFor="price">Price (Rs)</Label>
              <Input id="price" type="number" min="0" className="h-11" {...form.register('price')} />
              {form.formState.errors.price && (
                <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variants {hasVariants && '(price is set per variant)'}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', price: '0' })}
              >
                <Plus className="size-4" /> Add Variant
              </Button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  placeholder="Name (e.g. Small)"
                  className="h-11 flex-1"
                  {...form.register(`variants.${i}.name`)}
                />
                <Input
                  placeholder="Price"
                  type="number"
                  min="0"
                  className="h-11 w-28"
                  {...form.register(`variants.${i}.price`)}
                />
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => remove(i)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            {form.formState.errors.variants && (
              <p className="text-sm text-destructive">Each variant needs a name and a valid price</p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-11" disabled={form.formState.isSubmitting}>
              {product ? 'Save Changes' : 'Create Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}