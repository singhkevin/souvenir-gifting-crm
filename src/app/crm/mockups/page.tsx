import { createClient } from '@/lib/supabase/server'
import { formatDate, asRows, oneRelation } from '@/lib/utils'
import Link from 'next/link'
import { registerMockup, updateMockup, removeMockup } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { requireStaff, applyOwnerScope, applyOrderScope } from '@/lib/auth'
import { asFormAction } from '@/lib/form-action'

type RequirementOption = { id: string; name: string }
type OrderOption = { id: string; order_number: string | null }
type Named = { name?: string | null; full_name?: string | null; company?: Named | Named[] | null }
type MockupRow = {
  id: string
  file_name?: string | null
  mime_type?: string | null
  storage_path?: string | null
  status?: string | null
  created_at?: string | null
  order_id?: string | null
  requirement?: Named | Named[] | null
  order?: { order_number?: string | null } | { order_number?: string | null }[] | null
  uploader?: { full_name?: string | null } | { full_name?: string | null }[] | null
}

function fileHref(path: string | null) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path
  return path
}

export default async function MockupsPage() {
  const profile = await requireStaff(['admin', 'sales', 'operations', 'management'])
  const supabase = await createClient()

  const [{ data: mockups }, { data: requirements }, { data: orders }] = await Promise.all([
    supabase.from('mockups').select('*, requirement:requirements(name, company:companies(name)), order:orders(order_number), uploader:profiles!uploaded_by(full_name)').order('created_at', { ascending: false }),
    applyOwnerScope(supabase.from('requirements').select('id, name').order('created_at', { ascending: false }).limit(50), profile),
    applyOrderScope(supabase.from('orders').select('id, order_number').order('created_at', { ascending: false }).limit(50), profile),
  ])
  const requirementOptions = asRows<RequirementOption>(requirements)
  const orderOptions = asRows<OrderOption>(orders)
  const mockupRows = asRows<MockupRow>(mockups)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Design Mockups</h1>
        <p className="text-xs text-[#7A7267] mt-1">Attach mockup files to a requirement or order. Shared mockups are visible in the client portal.</p>
      </div>

      <form action={asFormAction(registerMockup)} className="bg-white border rounded-2xl p-4 grid md:grid-cols-3 gap-3 text-xs">
        <input name="file_url" required placeholder="File URL" className="border rounded-lg px-2 py-2" />
        <input name="file_name" placeholder="File name" className="border rounded-lg px-2 py-2" />
        <select name="mime_type" className="border rounded-lg px-2 py-2">
          <option value="image/png">PNG</option>
          <option value="image/jpeg">JPEG</option>
          <option value="application/pdf">PDF</option>
        </select>
        <select name="requirement_id" className="border rounded-lg px-2 py-2">
          <option value="">Requirement (optional)</option>
          {requirementOptions.map((r: RequirementOption) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select name="order_id" className="border rounded-lg px-2 py-2">
          <option value="">Order (optional)</option>
          {orderOptions.map((o: OrderOption) => (
            <option key={o.id} value={o.id}>{o.order_number}</option>
          ))}
        </select>
        <select name="visibility" className="border rounded-lg px-2 py-2">
          <option value="internal">Internal only</option>
          <option value="client">Share with client</option>
        </select>
        <button className="bg-[#1A3022] text-white rounded-lg font-semibold md:col-span-3 py-2">Register mockup</button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        {mockupRows.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="p-3">File</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Order</th>
                <th className="p-3">Visibility</th>
                <th className="p-3">Uploaded</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockupRows.map((mockup: MockupRow) => {
                const requirement = oneRelation(mockup.requirement)
                const company = oneRelation(requirement?.company)
                const order = oneRelation(mockup.order)
                const uploader = oneRelation(mockup.uploader)
                const href = fileHref(mockup.storage_path ?? null)
                return (
                  <tr key={mockup.id} className="border-b text-sm">
                    <td className="p-3">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {mockup.file_name || 'View file'}
                        </a>
                      ) : mockup.file_name}
                      <p className="text-[11px] text-gray-500">{mockup.mime_type}</p>
                    </td>
                    <td className="p-3">
                      {requirement ? (
                        <div>
                          <p className="font-medium">{requirement.name}</p>
                          <p className="text-xs text-gray-500">{company?.name}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      {mockup.order_id ? (
                        <Link href={`/crm/orders/${mockup.order_id}`} className="text-blue-600 hover:underline">{order?.order_number}</Link>
                      ) : '—'}
                    </td>
                    <td className="p-3 capitalize">{mockup.status === 'shared' ? 'Client-facing' : mockup.status || 'internal'}</td>
                    <td className="p-3">{uploader?.full_name || '—'} · {formatDate(mockup.created_at)}</td>
                    <td className="p-3 text-xs space-y-2">
                      <form action={asFormAction(updateMockup)} className="flex gap-2 items-center">
                        <input type="hidden" name="id" value={mockup.id} />
                        <select name="status" defaultValue={mockup.status || 'draft'} className="border rounded px-2 py-1">
                          <option value="draft">Internal</option>
                          <option value="shared">Client-facing</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <button className="underline">Save</button>
                      </form>
                      <ConfirmAction
                        title="Delete mockup?"
                        confirmLabel="Delete"
                        action={asFormAction(removeMockup)}
                        hiddenFields={{ id: mockup.id }}
                        description={<p>File: <span className="font-semibold">{mockup.file_name}</span></p>}
                      >
                        Delete
                      </ConfirmAction>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">No mockups uploaded yet.</div>
        )}
      </div>
    </div>
  )
}
