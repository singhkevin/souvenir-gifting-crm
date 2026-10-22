'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { resetPortalClientPassword } from './actions'
import { IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'

export function ManageClientLogin({
  companyId,
  client,
}: {
  companyId: string
  client: { id: string; full_name: string | null; email: string; role: string; is_active: boolean }
}) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const { pending, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [mode, setMode] = useState<'set' | 'generate' | null>(null)
  const [issued, setIssued] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const submit = (generate: boolean) => {
    const formData = new FormData()
    formData.set('user_id', client.id)
    formData.set('company_id', companyId)
    if (generate) formData.set('generate_password', '1')
    else formData.set('password', password)
    formData.set(IDEMPOTENCY_FIELD, key)
    setMode(generate ? 'generate' : 'set')
    run(() => resetPortalClientPassword(formData), {
      successMessage: 'Temporary password set',
      refresh: false,
      onSuccess: (result) => {
        rotate()
        setIssued((result as { temporaryPassword?: string } | undefined)?.temporaryPassword || null)
        setPassword('')
        setRevealed(false)
      },
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setIssued(null)
          setPassword('')
          setRevealed(false)
        }}
        className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9E4300] hover:underline"
      >
        Manage Login
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#1C1B1A]/50"
            aria-label="Close"
            onClick={() => {
              if (!pending) setOpen(false)
            }}
          />
          <div className="relative bg-[#FCF9F2] rounded-none border border-[#CCC5BD] shadow-none w-full max-w-md overflow-hidden text-xs">
            <div className="bg-[#F6F3EC] px-5 py-3.5 border-b border-[#CCC5BD] flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">Manage Login</h3>
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="text-[#7C766F] hover:text-[#1C1B1A] text-xs font-bold uppercase tracking-[0.08em]"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</span>
                  <span className="mt-0.5 block text-[#1C1B1A] font-semibold">{client.full_name || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Role</span>
                  <span className="mt-0.5 block text-[#1C1B1A] capitalize">{client.role.replace('_', ' ')}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Client ID / Login email</span>
                  <span className="mt-0.5 block font-mono text-[#1C1B1A]">{client.email}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">{client.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <p className="text-[11px] text-[#4A4640] leading-relaxed">
                Existing passwords cannot be viewed. Set a new temporary password to share with the client.
              </p>
              {issued ? (
                <div className="p-3.5 rounded-none bg-[#F6F3EC] border border-[#CCC5BD] space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1C1B1A]">
                    Temporary password — share securely
                  </p>
                  <p className="font-mono text-sm text-[#1C1B1A]">{revealed ? issued : '••••••••'}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRevealed((v) => !v)}
                      className="px-3 py-1.5 border border-[#1C1B1A] bg-transparent text-[#1C1B1A] hover:bg-[#F6F3EC] rounded-none text-xs font-bold uppercase tracking-[0.08em] transition-colors"
                    >
                      {revealed ? 'Hide' : 'Reveal once'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(issued)
                        toast.success('Copied')
                      }}
                      className="px-3 py-1.5 border border-[#1C1B1A] bg-transparent text-[#1C1B1A] hover:bg-[#F6F3EC] rounded-none text-xs font-bold uppercase tracking-[0.08em] transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Temporary password (min 8)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={pending}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending || password.length < 8}
                      aria-busy={pending && mode === 'set' || undefined}
                      onClick={() => submit(false)}
                      className="px-3.5 py-2 font-bold uppercase tracking-[0.08em] text-xs text-[#FCF9F2] bg-[#1C1B1A] hover:bg-[#9E4300] rounded-none disabled:opacity-50 transition-colors shadow-none"
                    >
                      {pending && mode === 'set' ? (
                        <span className="inline-flex items-center gap-2"><Spinner />Saving…</span>
                      ) : (
                        'Set temporary password'
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      aria-busy={pending && mode === 'generate' || undefined}
                      onClick={() => submit(true)}
                      className="px-3.5 py-2 border border-[#1C1B1A] text-[#1C1B1A] hover:bg-[#F6F3EC] rounded-none text-xs font-bold uppercase tracking-[0.08em] disabled:opacity-50 transition-colors"
                    >
                      {pending && mode === 'generate' ? (
                        <span className="inline-flex items-center gap-2"><Spinner />Generating…</span>
                      ) : (
                        'Generate password'
                      )}
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="w-full py-2 border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC] rounded-none text-xs font-bold uppercase tracking-[0.08em] disabled:opacity-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
