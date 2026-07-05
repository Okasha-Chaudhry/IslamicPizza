import { useEffect } from 'react'
import { Delete, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  pin: string
  onChange: (pin: string) => void
  onSubmit: () => void
  disabled?: boolean
}

export default function PinPad({ pin, onChange, onSubmit, disabled }: Props): React.JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (disabled) return
      if (/^\d$/.test(e.key) && pin.length < 6) onChange(pin + e.key)
      else if (e.key === 'Backspace') onChange(pin.slice(0, -1))
      else if (e.key === 'Enter' && pin.length >= 4) onSubmit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pin, onChange, onSubmit, disabled])

  function press(d: string): void {
    if (pin.length < 6) onChange(pin + d)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'size-4 rounded-full border-2',
              i < pin.length ? 'border-primary bg-primary' : 'border-muted-foreground/40'
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Button
            key={d}
            type="button"
            variant="outline"
            className="h-14 text-xl font-semibold"
            disabled={disabled}
            onClick={() => press(d)}
          >
            {d}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-14"
          disabled={disabled}
          onClick={() => onChange(pin.slice(0, -1))}
        >
          <Delete className="size-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 text-xl font-semibold"
          disabled={disabled}
          onClick={() => press('0')}
        >
          0
        </Button>
        <Button
          type="button"
          className="h-14"
          disabled={disabled || pin.length < 4}
          onClick={onSubmit}
        >
          <Check className="size-5" />
        </Button>
      </div>
    </div>
  )
}