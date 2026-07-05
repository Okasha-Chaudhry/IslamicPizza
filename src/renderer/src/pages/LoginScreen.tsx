import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PinPad from '@/components/auth/PinPad'
import { useAuthStore } from '@/stores/auth-store'

export default function LoginScreen(): React.JSX.Element {
  const login = useAuthStore((s) => s.login)
  const [mode, setMode] = useState<'loading' | 'setup' | 'login'>('loading')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [stage, setStage] = useState<'pin' | 'confirm'>('pin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await window.api.auth.hasAnyUser()
      setMode(res.ok && res.data ? 'login' : 'setup')
    })()
  }, [])

  async function doLogin(): Promise<void> {
    setBusy(true)
    setError('')
    const res = await window.api.auth.login(pin)
    if (res.ok && res.data) {
      login(res.data)
    } else {
      setError(res.error ?? 'Invalid PIN')
      setPin('')
    }
    setBusy(false)
  }

  async function doSetupStep(): Promise<void> {
    setError('')
    if (stage === 'pin') {
      if (!name.trim()) {
        setError('Enter your name first')
        return
      }
      setConfirmPin(pin)
      setPin('')
      setStage('confirm')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match. Try again.')
      setPin('')
      setConfirmPin('')
      setStage('pin')
      return
    }
    setBusy(true)
    const res = await window.api.auth.setupAdmin(name, pin)
    if (res.ok && res.data) {
      login(res.data)
    } else {
      setError(res.error ?? 'Setup failed')
      setPin('')
      setConfirmPin('')
      setStage('pin')
    }
    setBusy(false)
  }

  if (mode === 'loading') {
    return <div className="flex h-screen items-center justify-center bg-background" />
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-80 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Restaurant POS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'setup'
              ? stage === 'pin'
                ? 'First time setup - create the admin account'
                : 'Re-enter the same PIN to confirm'
              : 'Enter your PIN to unlock'}
          </p>
        </div>

        {mode === 'setup' && stage === 'pin' && (
          <div className="space-y-2">
            <Label htmlFor="admin-name">Your Name (Admin)</Label>
            <Input
              id="admin-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Owner"
            />
          </div>
        )}

        <PinPad
          pin={pin}
          onChange={setPin}
          onSubmit={mode === 'login' ? () => void doLogin() : () => void doSetupStep()}
          disabled={busy}
        />

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}