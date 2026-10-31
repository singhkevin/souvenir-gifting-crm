'use client'

import { useState } from 'react'
import { decidePortalSignupAction } from '@/app/crm/portal-signups/actions'
import { signupSourceLabel } from '@/lib/portal/signup'
import { SubmitButton } from '@/components/ui/submit-button'

export type PortalQueueRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  source: string | null
  company_name?: string | null
  created_at?: string | null
}

export function PortalApprovalQueue({
  rows,
  companyId,
}: {
  rows: PortalQueueRow[]
  companyId?: string
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (formData: FormData) => {
    setMessage(null)
    setError(null)
    const result = await decidePortalSignupAction(formData)
    if (result?.error) {
      setError(result.error)
      return
    }
    setSelected([])
    setMessage(result?.changed ? `Updated ${result.changed}.` : 'Nothing to update.')
  }

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="space-y-3">
      {error ? <p className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
      {message ? <p className="border border-[#CCC5BD] bg-[#F6F3EC] p-3 text-xs text-[#1C1B1A]">{message}</p> : null}
      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-[#7C766F]">No one is waiting for approval.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <tr>
                <th className="px-4 py-2.5" />
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Email</th>
                {companyId ? null : (
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company</th>
                )}
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Source</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCC5BD]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.full_name || row.email || 'person'}`}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-[#1C1B1A]">{row.full_name || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-[#4A4640]">{row.email}</td>
                  {companyId ? null : <td className="px-4 py-2.5 text-[#4A4640]">{row.company_name || '—'}</td>}
                  <td className="px-4 py-2.5 text-[#4A4640]">{signupSourceLabel(row.source)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={run} className="inline-flex gap-2">
                      <input type="hidden" name="user_id" value={row.id} />
                      {companyId ? <input type="hidden" name="company_id" value={companyId} /> : null}
                      <SubmitButton
                        name="decision"
                        value="approved"
                        pendingLabel="Approving…"
                        className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9E4300]"
                      >
                        Approve
                      </SubmitButton>
                      <SubmitButton
                        name="decision"
                        value="rejected"
                        pendingLabel="Rejecting…"
                        className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7C766F]"
                      >
                        Reject
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <form action={run}>
            {selected.map((id) => <input key={id} type="hidden" name="user_id" value={id} />)}
            {companyId ? <input type="hidden" name="company_id" value={companyId} /> : null}
            <SubmitButton
              name="decision"
              value="approved"
              disabled={selected.length === 0}
              pendingLabel="Approving…"
              className="border border-[#1C1B1A] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] disabled:opacity-40"
            >
              Approve selected
            </SubmitButton>
          </form>
          <form action={run}>
            <input type="hidden" name="all" value="1" />
            {companyId ? <input type="hidden" name="company_id" value={companyId} /> : null}
            <SubmitButton
              name="decision"
              value="approved"
              pendingLabel="Approving…"
              className="bg-[#1C1B1A] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FCF9F2]"
            >
              Approve all pending
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  )
}
