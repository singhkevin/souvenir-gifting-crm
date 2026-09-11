'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { resetPortalClientPassword } from './actions'

export function ManageClientLogin({
  companyId,
  client,
}: {
  companyId: string
  client: { id: string; full_name: string | null; email: string; role: string; is_active: boolean }
}) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [pending, startTransition] = useTransition()
  const [issued, setIssued] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const submit = (generate: boolean) => {
    const formData = new FormData()
    formData.set('user_id', client.id)
    formData.set('company_id', companyId)
    if (generate) formData.set('generate_password', '1')
    else formData.set('password', password)
    startTransition(async () => {
      const result = await resetPortalClientPassword(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setIssued(result.temporaryPassword || null)
      setPassword('')
      setRevealed(false)
      toast.success('Temporary password set')
    })
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setIssued(null); setPassword(''); setRevealed(false) }} className="text-[11px] font-semibold text-[#4A235A] hover:underline">
        Manage Login
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-[#E5DFD5] shadow-lg w-full max-w-md p-5 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-[#1C1917]">Manage Login</h3>
            <p><span className="text-[#7A7267]">Name:</span> {client.full_name || '—'}</p>
            <p><span className="text-[#7A7267]">Client ID / Login email:</span> <span className="font-mono">{client.email}</span></p>
            <p><span className="text-[#7A7267]">Role:</span> {client.role.replace('_', ' ')}</p>
            <p><span className="text-[#7A7267]">Status:</span> {client.is_active ? 'Active' : 'Inactive'}</p>
            <p className="text-[#7A7267]">Existing passwords cannot be viewed. Set a new temporary password to share with the client.</p>
            {issued ? (
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DFD5] space-y-2">
                <p className="font-semibold">Temporary password — share securely</p>
                <p className="font-mono">{revealed ? issued : '••••••••'}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRevealed((v) => !v)} className="px-3 py-1.5 border rounded-lg">{revealed ? 'Hide' : 'Reveal once'}</button>
                  <button type="button" onClick={async () => { await navigator.clipboard.writeText(issued); toast.success('Copied') }} className="px-3 py-1.5 border rounded-lg">Copy</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Temporary password (min 8)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={pending || password.length < 8} onClick={() => submit(false)} className="px-3 py-2 font-semibold text-white bg-[#4A235A] rounded-lg disabled:opacity-50">
                    {pending ? 'Saving…' : 'Set temporary password'}
                  </button>
                  <button type="button" disabled={pending} onClick={() => submit(true)} className="px-3 py-2 border rounded-lg disabled:opacity-50">
                    Generate password
                  </button>
                </div>
              </div>
            )}
            <button type="button" onClick={() => setOpen(false)} className="w-full py-2 border rounded-lg">Close</button>
          </div>
        </div>
      )}
    </>
  )
}
