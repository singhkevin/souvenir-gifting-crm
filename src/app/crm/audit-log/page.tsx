import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import { entityHref, describeAudit } from '@/lib/entity-href'
import { ShieldCheck } from 'lucide-react'

function preview(value: unknown) {
  if (value == null) return '—'
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return text.length > 80 ? `${text.slice(0, 80)}…` : text
  } catch {
    return '—'
  }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireStaff(['admin', 'management'])
  const { page = '1' } = await searchParams
  const current = Math.max(1, Number.parseInt(page, 10) || 1)
  const pageSize = 50
  const from = (current - 1) * pageSize

  const supabase = await createClient()
  const { data: logs, count } = await supabase
    .from('audit_logs')
    .select('*, profile:profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-[#1C1917]">Audit Log</h1>
        <p className="text-xs text-[#7A7267] mt-1">Company-wide create, update, assignment and status history.</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5DFD5] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="bg-[#FAF7F2] border-b border-[#E5DFD5]">
            <tr>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7A7267]">When</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7A7267]">User</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7A7267]">Action</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7A7267]">Entity</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7A7267]">Previous</th>
              <th className="text-left px-5 py-3.5 font-semibold text-[#7A7267]">New</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE9E0]">
            {logs?.length ? (
              logs.map((log) => {
                const href = entityHref(log.entity, log.entity_id)
                const label = `${describeAudit(log.action, log.entity || 'record')} ${log.entity_id ? `#${String(log.entity_id).slice(0, 8)}` : ''}`
                return (
                  <tr key={log.id} className="hover:bg-[#FAF7F2]">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-5 py-3 text-[#1C1917]">{(log.profile as any)?.full_name || (log.profile as any)?.email || 'System'}</td>
                    <td className="px-5 py-3 font-semibold text-[#1C1917] capitalize">{log.action?.replace('_', ' ')}</td>
                    <td className="px-5 py-3">
                      {href ? (
                        <Link href={href} className="text-[#806A50] hover:underline font-medium">{label}</Link>
                      ) : (
                        <span className="capitalize">{label}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-[11px]">{preview(log.previous_value)}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-[11px]">{preview(log.new_value)}</td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  <ShieldCheck className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  No audit events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-between text-xs">
          {current > 1 ? <Link href={`/crm/audit-log?page=${current - 1}`} className="underline">Previous</Link> : <span />}
          <span>Page {current} of {totalPages}</span>
          {current < totalPages ? <Link href={`/crm/audit-log?page=${current + 1}`} className="underline">Next</Link> : <span />}
        </div>
      )}
    </div>
  )
}
