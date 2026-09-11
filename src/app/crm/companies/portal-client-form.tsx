'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createPortalClient } from './actions'

function CredentialsOnce({
  email,
  password,
  onDone,
}: {
  email: string
  password: string
  onDone: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="md:col-span-2 p-3 rounded-xl border border-[#E5DFD5] bg-[#FAF7F2] space-y-2">
      <p className="text-xs font-semibold text-[#1C1917]">Client login created</p>
      <p className="text-[11px] text-[#7A7267]">Share these credentials now. They are not stored in the CRM and cannot be recovered later.</p>
      <p className="text-xs"><span className="text-[#7A7267]">Client ID / Login email:</span> <span className="font-mono">{email}</span></p>
      <p className="text-xs">
        <span className="text-[#7A7267]">Temporary password — share securely:</span>{' '}
        <span className="font-mono">{revealed ? password : '••••••••'}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRevealed((v) => !v)} className="px-3 py-1.5 text-xs border rounded-lg">
          {revealed ? 'Hide' : 'Reveal once'}
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(`${email}\n${password}`)
            toast.success('Copied')
          }}
          className="px-3 py-1.5 text-xs border rounded-lg"
        >
          Copy
        </button>
        <button type="button" onClick={onDone} className="px-3 py-1.5 text-xs font-semibold text-white bg-[#4A235A] rounded-lg">
          Done
        </button>
      </div>
    </div>
  )
}

export function PortalClientForm({ companyId }: { companyId: string }) {
  const [pending, startTransition] = useTransition()
  const [formKey, setFormKey] = useState(0)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      setError(null)
      const result = await createPortalClient(formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      if (result?.success && result.email && result.temporaryPassword) {
        setCreated({ email: result.email, password: result.temporaryPassword })
        setPassword('')
        setFormKey((key) => key + 1)
        return
      }
      setError('Client login was not created.')
      toast.error('Client login was not created.')
    })
  }

  return (
    <form key={formKey} action={onSubmit} className="grid md:grid-cols-2 gap-3 text-xs">
      {error && (
        <div className="md:col-span-2 p-3 rounded-xl border border-red-200 bg-red-50 text-red-800">
          {error}
        </div>
      )}
      <input type="hidden" name="company_id" value={companyId} />
      <input name="full_name" required placeholder="Client name" className="border rounded-lg px-3 py-2" />
      <input name="email" type="email" required placeholder="Client ID / Login email" className="border rounded-lg px-3 py-2" />
      <select name="role" defaultValue="client_user" className="border rounded-lg px-3 py-2 bg-white">
        <option value="client_user">Client user</option>
        <option value="client_admin">Client admin</option>
      </select>
      <div className="flex gap-2">
        <input
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          placeholder="Temporary password (min 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded-lg px-3 py-2 flex-1"
        />
        <button
          type="submit"
          name="generate_password"
          value="1"
          disabled={pending}
          className="px-3 py-2 border rounded-lg whitespace-nowrap disabled:opacity-50"
        >
          Generate password
        </button>
      </div>
      <p className="md:col-span-2 text-[11px] text-gray-500">
        The password is sent to Supabase Auth only. It is never stored in application tables.
      </p>
      {created && (
        <CredentialsOnce
          email={created.email}
          password={created.password}
          onDone={() => setCreated(null)}
        />
      )}
      <button
        type="submit"
        disabled={pending}
        className="md:col-span-2 px-3 py-2 text-xs font-semibold text-white bg-[#4A235A] rounded-lg disabled:opacity-50"
      >
        {pending ? 'Creating login…' : 'Create client login'}
      </button>
    </form>
  )
}
