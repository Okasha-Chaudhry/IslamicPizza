import { useCallback, useEffect, useState } from 'react'
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
import { useAuthStore } from '@/stores/auth-store'
import type { Expense, ExpenseItem, ExpenseCategory } from '../../../shared/types'

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'utilities', label: 'Utilities (bijli/gas)' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'rent', label: 'Rent' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' }
]

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
)

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Expenses(): React.JSX.Element {
  const user = useAuthStore((s) => s.user)
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayStr())
  const [list, setList] = useState<Expense[]>([])
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [msg, setMsg] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [fDate, setFDate] = useState(todayStr())
  const [fCategory, setFCategory] = useState<ExpenseCategory>('ingredients')
  const [fItemId, setFItemId] = useState<string>('')
  const [fNewItem, setFNewItem] = useState('')
  const [fQuantity, setFQuantity] = useState('')
  const [fDescription, setFDescription] = useState('')
  const [fAmount, setFAmount] = useState('')

  const NEW_ITEM = '__new__'
  const NO_ITEM = '__none__'

  const refresh = useCallback(async (): Promise<void> => {
    const [eRes, iRes] = await Promise.all([
      window.api.expenses.list({ from, to }),
      window.api.expenses.listItems()
    ])
    if (eRes.ok && eRes.data) setList(eRes.data)
    if (iRes.ok && iRes.data) setItems(iRes.data)
  }, [from, to])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function openAdd(): void {
    setFDate(todayStr())
    setFCategory('ingredients')
    setFItemId('')
    setFNewItem('')
    setFQuantity('')
    setFDescription('')
    setFAmount('')
    setMsg('')
    setDialogOpen(true)
  }

  async function save(): Promise<void> {
    setMsg('')
    let expenseItemId: number | null = null

    if (fCategory === 'ingredients') {
      if (fItemId === NEW_ITEM) {
        const newName = fNewItem.trim()
        if (!newName) {
          setMsg('Enter the new item name')
          return
        }
        const existing = items.find((i) => i.name.toLowerCase() === newName.toLowerCase())
        if (existing) {
          expenseItemId = existing.id
        } else {
          const res = await window.api.expenses.createItem(newName)
          if (!res.ok || !res.data) {
            setMsg(res.error ?? 'Item create failed')
            return
          }
          expenseItemId = res.data.id
        }
      } else if (fItemId && fItemId !== NO_ITEM) {
        expenseItemId = Number(fItemId)
      }
    }

    const res = await window.api.expenses.create({
      expenseDate: fDate,
      category: fCategory,
      expenseItemId,
      quantity: fQuantity || undefined,
      description: fDescription || undefined,
      amount: Number(fAmount),
      userId: user?.id ?? null
    })
    if (!res.ok) {
      setMsg(res.error ?? 'Save failed')
      return
    }
    setDialogOpen(false)
    await refresh()
  }

  async function remove(id: number): Promise<void> {
    await window.api.expenses.delete(id)
    await refresh()
  }

  const total = list.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button className="h-11" onClick={openAdd}>
          <Plus className="size-4" /> Add Expense
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="h-10 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" className="h-10 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="ml-auto rounded-md border bg-card px-4 py-2 text-sm">
          Total: <span className="font-bold">Rs {total}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="h-10 px-3 font-medium">Date</th>
              <th className="h-10 px-3 font-medium">Category</th>
              <th className="h-10 px-3 font-medium">Item</th>
              <th className="h-10 px-3 font-medium">Qty</th>
              <th className="h-10 px-3 font-medium">Description</th>
              <th className="h-10 px-3 text-right font-medium">Amount</th>
              <th className="h-10 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="h-12 px-3">{e.expenseDate}</td>
                <td className="h-12 px-3">{CAT_LABEL[e.category] ?? e.category}</td>
                <td className="h-12 px-3">{e.itemName ?? '-'}</td>
                <td className="h-12 px-3 text-muted-foreground">{e.quantity ?? '-'}</td>
                <td className="h-12 px-3 text-muted-foreground">{e.description ?? '-'}</td>
                <td className="h-12 px-3 text-right font-medium">Rs {e.amount}</td>
                <td className="h-12 px-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => void remove(e.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No expenses in this range. Click &quot;Add Expense&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {msg && !dialogOpen && <p className="text-sm text-destructive">{msg}</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>Date</Label>
                <Input type="date" className="h-11" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Amount (Rs)</Label>
                <Input
                  type="number"
                  min="1"
                  className="h-11"
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={fCategory} onValueChange={(v) => setFCategory(v as ExpenseCategory)}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fCategory === 'ingredients' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Item</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFItemId(fItemId === NEW_ITEM ? '' : NEW_ITEM)}
                    >
                      <Plus className="size-3" /> New Item
                    </Button>
                  </div>
                  {fItemId === NEW_ITEM ? (
                    <Input
                      className="h-11"
                      placeholder="New item name (e.g. Cheese, Buns)"
                      value={fNewItem}
                      onChange={(e) => setFNewItem(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <Select value={fItemId} onValueChange={setFItemId}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Select item (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ITEM}>No specific item</SelectItem>
                        {items
                          .filter((i) => i.isActive)
                          .map((i) => (
                            <SelectItem key={i.id} value={String(i.id)}>
                              {i.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Quantity (optional)</Label>
                  <Input
                    className="h-11"
                    placeholder="e.g. 20 kg / 200 pcs"
                    value={fQuantity}
                    onChange={(e) => setFQuantity(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                className="h-11"
                placeholder="e.g. bijli ka bill July"
                value={fDescription}
                onChange={(e) => setFDescription(e.target.value)}
              />
            </div>

            {msg && <p className="text-sm text-destructive">{msg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11" onClick={() => void save()}>
              Save Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}