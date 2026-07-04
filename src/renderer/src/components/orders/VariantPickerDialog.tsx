import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ProductWithVariants, Variant } from '../../../../shared/types'

interface Props {
  product: ProductWithVariants | null
  onPick: (variant: Variant) => void
  onClose: () => void
}

export default function VariantPickerDialog({ product, onPick, onClose }: Props): React.JSX.Element {
  const [idx, setIdx] = useState(0)
  const activeVariants = product?.variants.filter((v) => v.isActive) ?? []

  useEffect(() => {
    if (product) setIdx(0)
  }, [product])

  useEffect(() => {
    if (!product) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        setIdx((i) => (i + 1) % activeVariants.length)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        setIdx((i) => (i - 1 + activeVariants.length) % activeVariants.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const v = activeVariants[idx]
        if (v) onPick(v)
      } else if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1
        if (n < activeVariants.length) {
          e.preventDefault()
          e.stopPropagation()
          onPick(activeVariants[n])
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [product, idx, activeVariants, onPick])

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {activeVariants.map((v, i) => (
            <button
              key={v.id}
              tabIndex={-1}
              className={cn(
                'flex h-12 items-center justify-between rounded-md border px-4 text-base transition-colors',
                i === idx
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent'
              )}
              onMouseEnter={() => setIdx(i)}
              onClick={() => onPick(v)}
            >
              <span>
                <span className="mr-2 text-xs opacity-60">{i + 1}</span>
                {v.name}
              </span>
              <span className="font-bold">Rs {v.price}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Arrows / 1-9 to choose, Enter to add, Esc to cancel
        </p>
      </DialogContent>
    </Dialog>
  )
}