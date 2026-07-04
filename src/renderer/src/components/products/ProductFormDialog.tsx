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
import type { Category, ProductWithVariants } from '../../../../shared/types'

const priceString = z
  .string()
  .refine((v) => v.trim() !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Enter a valid price')

const formSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required'),
  categoryId: z.string().min(1, 'Select a category'),
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
  product: ProductWithVariants | null
  onSaved: () => void
}

export default function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
  onSaved
}: Props): React.JSX.Element {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', categoryId: '', price: '0', variants: [] }
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
              price: String(product.price),
              variants: product.variants.map((v) => ({ name: v.name, price: String(v.price) }))
            }
          : { name: '', categoryId: '', price: '0', variants: [] }
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
            <Input id="name" className="h-11" {...form.register('name')} autoFocus />
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