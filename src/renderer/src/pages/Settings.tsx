import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { AppSettings, PrinterInfo } from '../../../shared/types'
import UsersManager from '@/components/auth/UsersManager'

export default function Settings(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const [s, p] = await Promise.all([window.api.settings.get(), window.api.printers.list()])
      if (s.ok && s.data) setSettings(s.data)
      if (p.ok && p.data) setPrinters(p.data)
    })()
  }, [])

  if (!settings) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  async function save(): Promise<void> {
    if (!settings) return
    setSaving(true)
    setMsg('')
    const res = await window.api.settings.save(settings)
    setMsg(res.ok ? 'Settings saved' : (res.error ?? 'Save failed'))
    if (res.ok) window.dispatchEvent(new CustomEvent('pos:settings-changed'))
    setSaving(false)
  }

  const NONE = '__none__'

  function printerSelect(
    label: string,
    key: 'defaultPrinter' | 'kitchenPrinter'
  ): React.JSX.Element {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select
          value={settings![key] === '' ? NONE : settings![key]}
          onValueChange={(v) => set(key, v === NONE ? '' : v)}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Select printer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>System default</SelectItem>
            {printers.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
                {p.isDefault ? ' (Windows default)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Restaurant</h2>
        <div className="space-y-2">
          <Label>Restaurant Name</Label>
          <Input
            className="h-11"
            value={settings.restaurantName}
            onChange={(e) => set('restaurantName', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input
            className="h-11"
            value={settings.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            className="h-11"
            value={settings.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Receipt</h2>
        <div className="space-y-2">
          <Label>Receipt Header (optional line below name)</Label>
          <Input
            className="h-11"
            value={settings.receiptHeader}
            onChange={(e) => set('receiptHeader', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Receipt Footer</Label>
          <Input
            className="h-11"
            value={settings.receiptFooter}
            onChange={(e) => set('receiptFooter', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Receipt Logo (printed at top)</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={async () => {
                const res = await window.api.settings.pickImage('logo')
                setMsg(res.ok ? 'Logo saved' : (res.error ?? 'Failed'))
                const s = await window.api.settings.get()
                if (s.ok && s.data) setSettings(s.data)
              }}
            >
              {settings.receiptLogo ? 'Change Logo' : 'Upload Logo'}
            </Button>
            {settings.receiptLogo && (
              <Button
                variant="ghost"
                className="h-11 text-destructive"
                onClick={async () => {
                  await window.api.settings.clearImage('logo')
                  const s = await window.api.settings.get()
                  if (s.ok && s.data) setSettings(s.data)
                }}
              >
                Remove
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {settings.receiptLogo ? 'Logo set' : 'No logo'}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Payment QR (JazzCash/RAAST - printed near total)</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={async () => {
                const res = await window.api.settings.pickImage('qr')
                setMsg(res.ok ? 'QR saved' : (res.error ?? 'Failed'))
                const s = await window.api.settings.get()
                if (s.ok && s.data) setSettings(s.data)
              }}
            >
              {settings.paymentQr ? 'Change QR' : 'Upload QR'}
            </Button>
            {settings.paymentQr && (
              <Button
                variant="ghost"
                className="h-11 text-destructive"
                onClick={async () => {
                  await window.api.settings.clearImage('qr')
                  const s = await window.api.settings.get()
                  if (s.ok && s.data) setSettings(s.data)
                }}
              >
                Remove
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {settings.paymentQr ? 'QR set' : 'No QR'}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Receipt Width</Label>
          <Select
            value={settings.receiptWidth}
            onValueChange={(v) => set('receiptWidth', v as AppSettings['receiptWidth'])}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58mm thermal</SelectItem>
              <SelectItem value="80">80mm thermal</SelectItem>
              <SelectItem value="A4">A4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Printers</h2>
        {printerSelect('Receipt Printer', 'defaultPrinter')}
        {printerSelect('Kitchen Printer', 'kitchenPrinter')}
        <Button
          variant="outline"
          className="h-11"
          onClick={async () => {
            setMsg('')
            const res = await window.api.print.test()
            setMsg(res.ok ? 'Test print sent - check the printer' : `Test print failed: ${res.error}`)
          }}
        >
          Test Print
        </Button>
        <p className="text-xs text-muted-foreground">
          Printers are detected from Windows. If a test print does not come out, make sure the
          printer cable is in its usual USB socket, then power the printer off and on.
        </p>
      </section>

      <UsersManager />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Backup &amp; Restore</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={async () => {
              setMsg('')
              const res = await window.api.backup.create()
              setMsg(res.ok ? `Backup saved: ${res.data}` : `Backup failed: ${res.error}`)
            }}
          >
            Create Backup
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={async () => {
              if (!confirm('Restore will REPLACE all current data with the backup. Continue?')) return
              setMsg('')
              const res = await window.api.backup.restore()
              setMsg(res.ok ? `Restored from: ${res.data}` : `Restore failed: ${res.error}`)
            }}
          >
            Restore Backup
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={async () => {
              setMsg('')
              const res = await window.api.backup.check()
              setMsg(res.ok ? (res.data ?? 'OK') : `Check failed: ${res.error}`)
            }}
          >
            Check Integrity
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Create backups regularly and keep them on a USB drive. Restore replaces all current data.
        </p>
      </section>

      {msg && <p className="text-sm">{msg}</p>}
      <Button className="h-12 px-8" disabled={saving} onClick={() => void save()}>
        Save Settings
      </Button>
    </div>
  )
}