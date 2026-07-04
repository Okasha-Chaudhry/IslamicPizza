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
        <p className="text-xs text-muted-foreground">
          Printers are detected from Windows. Install/connect a printer and reopen this page to
          refresh.
        </p>
      </section>

      {msg && <p className="text-sm">{msg}</p>}
      <Button className="h-12 px-8" disabled={saving} onClick={() => void save()}>
        Save Settings
      </Button>
    </div>
  )
}