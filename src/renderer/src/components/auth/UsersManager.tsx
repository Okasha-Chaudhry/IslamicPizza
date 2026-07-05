import { useEffect, useState } from 'react'
import { KeyRound, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import type { SafeUser, UserRole } from '../../../../shared/types'

export default function UsersManager(): React.JSX.Element {
  const me = useAuthStore((s) => s.user)
  const [list, setList] = useState<SafeUser[]>([])
  const [msg, setMsg] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SafeUser | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('cashier')
  const [pin, setPin] = useState('')

  async function refresh(): Promise<void> {
    const res = await window.api.users.list()
    if (res.ok && res.data) setList(res.data)
  }

  useEffect(() => {
    void refresh()
  }, [])

  function openCreate(): void {
    setEditing(null)
    setName('')
    setRole('cashier')
    setPin('')
    setDialogOpen(true)
  }

  function openEdit(u: SafeUser): void {
    setEditing(u)
    setName(u.name)
    setRole(u.role)
    setPin('')
    setDialogOpen(true)
  }

  async function save(): Promise<void> {
    setMsg('')
    if (editing) {
      const res = await window.api.users.update({
        id: editing.id,
        name,
        role,
        ...(pin ? { pin } : {})
      })
      setMsg(res.ok ? 'User updated' : (res.error ?? 'Failed'))
    } else {
      if (!pin) {
        setMsg('PIN is required for a new user')
        return
      }
      const res = await window.api.users.create({ name, role, pin })
      setMsg(res.ok ? 'User created' : (res.error ?? 'Failed'))
    }
    setDialogOpen(false)
    await refresh()
  }

  async function toggleActive(u: SafeUser): Promise<void> {
    setMsg('')
    const res = await window.api.users.update({ id: u.id, isActive: !u.isActive })
    if (!res.ok) setMsg(res.error ?? 'Failed')
    await refresh()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Users</h2>
        <Button variant="outline" className="h-11" onClick={openCreate}>
          <Plus className="size-4" /> Add User
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t first:border-t-0">
                <td className="h-12 px-3 font-medium">
                  {u.name}
                  {u.id === me?.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                </td>
                <td className="h-12 px-3 text-muted-foreground">{u.role}</td>
                <td className="h-12 px-3">
                  <div className="flex items-center justify-end gap-2">
                    <Switch
                      checked={u.isActive}
                      disabled={u.id === me?.id}
                      onCheckedChange={() => void toggleActive(u)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                      <KeyRound className="size-4" /> Edit / PIN
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className="text-sm">{msg}</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{editing ? 'New PIN (leave empty to keep current)' : 'PIN (4-6 digits)'}</Label>
              <Input
                className="h-11"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11" onClick={() => void save()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}