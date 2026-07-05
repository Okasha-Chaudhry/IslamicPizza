import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LicenseStatus } from '../../../shared/types'

interface Props {
  status: LicenseStatus
  onActivated: () => void
}

export default function ActivationScreen({ status, onActivated }: Props): React.JSX.Element {
  const [key, setKey] = useState('')
  const [error, setError] = useState(status.error ?? '')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setError(status.error ?? '')
  }, [status])

  async function activate(): Promise<void> {
    setError('')
    const res = await window.api.license.activate(key)
    if (res.ok && res.data?.activated) onActivated()
    else setError(res.error ?? 'Activation failed')
  }

  function copyId(): void {
    void navigator.clipboard.writeText(status.machineId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-96 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Islamic Pizza POS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This software requires activation
          </p>
        </div>

        <div className="space-y-2 rounded-md border bg-card p-4">
          <Label className="text-xs text-muted-foreground">
            Machine ID (send this to your software provider)
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-sm font-semibold">{status.machineId}</code>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copyId}>
              <Copy className="size-4" />
            </Button>
          </div>
          {copied && <p className="text-xs text-green-600">Copied!</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="license-key">License Key</Label>
          <Input
            id="license-key"
            className="h-11 font-mono"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-YYYYMMDD"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void activate()}
          />
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <Button className="h-12 w-full" onClick={() => void activate()}>
          Activate
        </Button>
      </div>
    </div>
  )
}