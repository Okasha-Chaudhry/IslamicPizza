import { useEffect, useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { ApiResult, NamedEntity, CreateNamedEntityInput, UpdateNamedEntityInput } from '../../../../shared/types'

interface EntityApi {
  list: () => Promise<ApiResult<NamedEntity[]>>
  create: (input: CreateNamedEntityInput) => Promise<ApiResult<NamedEntity>>
  update: (input: UpdateNamedEntityInput) => Promise<ApiResult<NamedEntity>>
  delete: (id: number) => Promise<ApiResult<void>>
}

interface Props {
  title: string
  placeholder: string
  api: EntityApi
}

export default function EntityManagerPage({ title, placeholder, api }: Props): React.JSX.Element {
  const [items, setItems] = useState<NamedEntity[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  async function refresh(): Promise<void> {
    const res = await api.list()
    if (res.ok && res.data) setItems(res.data)
    else setError(res.error ?? 'Failed to load')
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function add(): Promise<void> {
    setError('')
    const res = await api.create({ name })
    if (!res.ok) {
      setError(res.error ?? 'Failed')
      return
    }
    setName('')
    await refresh()
  }

  async function toggleActive(item: NamedEntity): Promise<void> {
    await api.update({ id: item.id, isActive: !item.isActive })
    await refresh()
  }

  function startEdit(item: NamedEntity): void {
    setEditingId(item.id)
    setEditName(item.name)
  }

  async function saveEdit(): Promise<void> {
    if (editingId === null) return
    setError('')
    const res = await api.update({ id: editingId, name: editName })
    if (!res.ok) {
      setError(res.error ?? 'Failed')
      return
    }
    setEditingId(null)
    await refresh()
  }

  async function remove(id: number): Promise<void> {
    setError('')
    const res = await api.delete(id)
    if (!res.ok) setError(res.error ?? 'Failed')
    await refresh()
  }

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder={placeholder}
          className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button className="h-11 px-6" onClick={() => void add()}>
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex h-14 items-center justify-between gap-3 rounded-md border bg-card px-3 text-sm"
          >
            {editingId === item.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button size="icon" variant="ghost" onClick={() => void saveEdit()}>
                  <Check className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <span className={item.isActive ? '' : 'text-muted-foreground line-through'}>
                  {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={item.isActive}
                    onCheckedChange={() => void toggleActive(item)}
                  />
                  <Button size="icon" variant="ghost" onClick={() => startEdit(item)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void remove(item.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No entries yet. Add one above.
          </li>
        )}
      </ul>
    </div>
  )
}