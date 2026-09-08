import { useEffect, useRef, useState } from 'react'
import { Keyboard, Languages } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Phonetic map: one English key -> one Urdu letter, always the same.
// Capitals carry the "heavy" pairs (T -> ٹ, S -> ص) so every Urdu letter is
// reachable without guessing at whole words - that guessing is what made the
// old convert-button produce wrong text.
const PHONETIC: Record<string, string> = {
  a: 'ا', A: 'آ', b: 'ب', B: 'بھ', c: 'چ', C: 'ث', d: 'د', D: 'ڈ',
  e: 'ے', E: 'ع', f: 'ف', F: 'ٖ', g: 'گ', G: 'غ', h: 'ہ', H: 'ح',
  i: 'ی', I: 'ٰ', j: 'ج', J: 'ژ', k: 'ک', K: 'خ', l: 'ل', L: 'لؤ',
  m: 'م', M: 'مھ', n: 'ن', N: 'ں', o: 'و', O: 'ؤ', p: 'پ', P: 'پھ',
  q: 'ق', Q: 'ۃ', r: 'ر', R: 'ڑ', s: 'س', S: 'ص', t: 'ت', T: 'ٹ',
  u: 'ُ', U: 'ئ', v: 'و', V: 'ٗ', w: 'و', W: 'ﷲ', x: 'ش', X: 'ژ',
  y: 'ی', Y: 'ۓ', z: 'ز', Z: 'ظ',
  "'": 'ٔ', '`': 'ً'
}

// Rows for the on-screen pad, in the order Urdu is taught.
const PAD_ROWS: string[][] = [
  ['ا', 'آ', 'ب', 'پ', 'ت', 'ٹ', 'ث', 'ج', 'چ', 'ح', 'خ'],
  ['د', 'ڈ', 'ذ', 'ر', 'ڑ', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض'],
  ['ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن'],
  ['ں', 'و', 'ہ', 'ھ', 'ء', 'ی', 'ے', 'ئ', 'ؤ', 'َ', 'ِ']
]

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  id?: string
}

export default function UrduInput({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  id
}: Props): React.JSX.Element {
  const [urduMode, setUrduMode] = useState(false)
  const [showPad, setShowPad] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.ctrlKey && e.code === 'Space' && document.activeElement === inputRef.current) {
        e.preventDefault()
        setUrduMode((m) => !m)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function insert(text: string): void {
    const el = inputRef.current
    if (!el) {
      onChange(value + text)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!urduMode) return
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (e.key.length !== 1) return
    const mapped = PHONETIC[e.key]
    if (!mapped) return
    e.preventDefault()
    insert(mapped)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            ref={inputRef}
            className={cn('h-11', urduMode && 'pr-16', className)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            value={value}
            dir={urduMode ? 'rtl' : 'ltr'}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {urduMode && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              اردو
            </span>
          )}
        </div>
        <Button
          type="button"
          variant={urduMode ? 'default' : 'outline'}
          className="h-11 shrink-0"
          onClick={() => {
            setUrduMode((m) => !m)
            inputRef.current?.focus()
          }}
          title="Urdu typing (Ctrl+Space)"
        >
          <Languages className="size-4" />
        </Button>
        <Button
          type="button"
          variant={showPad ? 'default' : 'outline'}
          className="h-11 shrink-0"
          onClick={() => setShowPad((s) => !s)}
          title="On-screen Urdu keyboard"
        >
          <Keyboard className="size-4" />
        </Button>
      </div>

      {showPad && (
        <div className="space-y-1 rounded-md border bg-muted/40 p-2" dir="rtl">
          {PAD_ROWS.map((row, ri) => (
            <div key={ri} className="flex flex-wrap gap-1">
              {row.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className="h-9 w-9 rounded border bg-background text-lg hover:bg-accent"
                  onClick={() => insert(ch)}
                >
                  {ch}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-1">
            <button
              type="button"
              className="h-9 flex-1 rounded border bg-background text-sm hover:bg-accent"
              onClick={() => insert(' ')}
            >
              Space
            </button>
            <button
              type="button"
              className="h-9 w-20 rounded border bg-background text-sm hover:bg-accent"
              onClick={() => onChange(value.slice(0, -1))}
            >
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  )
}