'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ActionForm } from '@/components/ui/action-form'
import { ProductThumb } from '@/components/ui/product-thumb'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { matchesSampleSearch } from '@/lib/samples/ledger'
import { receiveIntoOffice, receiveSample, returnSampleFromTeam, sendSample } from './actions'

export type SampleHolder = { id: string; name: string; quantity: number }

export type SampleCard = {
  id: string
  productId: string
  name: string
  sku: string
  imageUrl: string | null
  inOffice: number
  withTeam: number
  withClient: number
  pendingSupplier: number
  unitCost: number | null
  companies: SampleHolder[]
  team: SampleHolder[]
}

export type SampleMovement = {
  id: string
  at: string
  productId: string
  productName: string
  quantity: number
  from: string
  to: string
  companyName: string | null
  holderName: string | null
  actorName: string | null
  note: string | null
}

export type NamedOption = { id: string; name: string; sku?: string }

const fieldClass = 'min-h-10 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-2 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none'
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]'

function Qty({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#F6F3EC] px-1 py-1 text-center">
      <p className="text-[9px] uppercase tracking-[0.08em] text-[#7C766F]">{label}</p>
      <p className="font-mono text-sm leading-tight text-[#1C1B1A]">{value}</p>
    </div>
  )
}

function SearchPick({
  label,
  options,
  value,
  onChange,
  placeholder,
  empty,
}: {
  label: string
  options: NamedOption[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  empty: string
}) {
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.id === value) || null
  const matches = options
    .filter((option) => matchesSampleSearch(query, [option.name, option.sku]))
    .slice(0, 8)
  return (
    <div className="space-y-1">
      <span className={labelClass}>{label}</span>
      <input
        value={selected && !query ? `${selected.name}${selected.sku ? ` · ${selected.sku}` : ''}` : query}
        onChange={(event) => {
          setQuery(event.target.value)
          if (value) onChange('')
        }}
        onFocus={() => {
          if (selected) setQuery('')
        }}
        placeholder={placeholder}
        className={fieldClass}
      />
      {query || !selected ? (
        <div className="max-h-36 overflow-auto border border-[#CCC5BD] bg-white">
          {matches.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-[#7C766F]">{empty}</p>
          ) : (
            matches.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id)
                  setQuery('')
                }}
                className="block w-full truncate px-2 py-1.5 text-left text-xs hover:bg-[#F6F3EC]"
              >
                {option.name}
                {option.sku ? ` · ${option.sku}` : ''}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#1C1B1A]/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[#CCC5BD] bg-[#FCF9F2] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-[family-name:var(--font-newsreader)] text-2xl text-[#1C1B1A]">{title}</h2>
          <button type="button" onClick={onClose} className="text-xs uppercase tracking-[0.12em] text-[#7C766F]">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function SamplesBoard({
  samples,
  movements,
  companies,
  team,
  products,
  canManage,
  showCost,
  balanceHint,
}: {
  samples: SampleCard[]
  movements: SampleMovement[]
  companies: NamedOption[]
  team: NamedOption[]
  products: NamedOption[]
  canManage: boolean
  showCost: boolean
  balanceHint: string
}) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [receiveProduct, setReceiveProduct] = useState('')
  const [receiveCompany, setReceiveCompany] = useState('')
  const [sendProduct, setSendProduct] = useState('')
  const [destination, setDestination] = useState<'company' | 'team'>('company')
  const [sendCompany, setSendCompany] = useState('')
  const [sendProfile, setSendProfile] = useState('')
  const [supplierProduct, setSupplierProduct] = useState('')

  const visible = useMemo(
    () =>
      samples.filter((sample) =>
        matchesSampleSearch(query, [
          sample.name,
          sample.sku,
          ...sample.companies.map((company) => company.name),
          ...sample.team.map((member) => member.name),
        ]),
      ),
    [samples, query],
  )
  const visibleIds = new Set(visible.map((sample) => sample.productId))
  const visibleMovements = query.trim() ? movements.filter((movement) => visibleIds.has(movement.productId)) : movements
  const open = samples.find((sample) => sample.id === openId) || null
  const receiveCard = samples.find((sample) => sample.productId === receiveProduct) || null
  const receiveHolders = receiveCard?.companies || []
  const held = receiveHolders.find((company) => company.id === receiveCompany)?.quantity || 0
  const totals = samples.reduce(
    (sum, sample) => ({
      office: sum.office + sample.inOffice,
      team: sum.team + sample.withTeam,
      client: sum.client + sample.withClient,
      supplier: sum.supplier + sample.pendingSupplier,
    }),
    { office: 0, team: 0, client: 0, supplier: 0 },
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-3xl text-[#1C1B1A]">Samples</h1>
          <p className="mt-1 text-xs text-[#7C766F]">
            Office, team, and client pieces. Samples stay in the staff CRM.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSendOpen(true)}
              className="inline-flex min-h-9 items-center border border-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A]"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setReceiveOpen(true)}
              className="inline-flex min-h-9 items-center bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300]"
            >
              Receive into Office
            </button>
          </div>
        ) : null}
      </div>

      {balanceHint ? (
        <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{balanceHint}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ['In office', totals.office],
          ['With team', totals.team],
          ['With clients', totals.client],
          ['Pending supplier', totals.supplier],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#7C766F]">{label}</p>
            <p className="font-mono text-lg text-[#1C1B1A]">{value}</p>
          </div>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">Search samples</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by product, SKU, or holder"
          className={fieldClass}
        />
      </label>

      {visible.length === 0 ? (
        <p className="border border-[#CCC5BD] bg-[#FCF9F2] px-4 py-8 text-center text-sm text-[#7C766F]">
          {samples.length === 0 ? 'No sample stock yet.' : 'No samples match that search.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((sample) => {
            const holders = [...sample.companies.map((company) => company.name), ...sample.team.map((member) => member.name)]
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => setOpenId(sample.id)}
                className="border border-[#CCC5BD] bg-[#FCF9F2] p-2.5 text-left hover:border-[#1C1B1A]"
              >
                <div className="flex items-start gap-2">
                  <ProductThumb src={sample.imageUrl} alt={sample.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1C1B1A]">{sample.name}</p>
                    <p className="truncate font-mono text-[10px] text-[#7C766F]">{sample.sku}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  <Qty label="Office" value={sample.inOffice} />
                  <Qty label="Team" value={sample.withTeam} />
                  <Qty label="Clients" value={sample.withClient} />
                  <Qty label="Supplier" value={sample.pendingSupplier} />
                </div>
                {holders.length > 0 ? (
                  <p className="mt-1.5 truncate text-[10px] text-[#7C766F]">{holders.join(' · ')}</p>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#7C766F]">Recent movements</h2>
          {canManage ? (
            <button type="button" onClick={() => setSupplierOpen(true)} className="text-[11px] text-[#9E4300] underline underline-offset-2">
              Receive from supplier
            </button>
          ) : null}
        </div>
        {visibleMovements.length === 0 ? (
          <p className="text-sm text-[#7C766F]">No movements recorded.</p>
        ) : (
          visibleMovements.map((movement) => (
            <p key={movement.id} className="border-t border-[#CCC5BD] py-1.5 text-xs text-[#1C1B1A]">
              {formatDateTime(movement.at)} · {movement.productName} · {movement.quantity} · {movement.from} → {movement.to}
              {movement.companyName ? ` · ${movement.companyName}` : ''}
              {movement.holderName ? ` · ${movement.holderName}` : ''}
              {movement.actorName ? ` · by ${movement.actorName}` : ''}
              {movement.note ? ` · ${movement.note}` : ''}
            </p>
          ))
        )}
      </div>

      {open ? (
        <Panel title={open.name} onClose={() => setOpenId(null)}>
          <p className="font-mono text-[11px] text-[#7C766F]">{open.sku}</p>
          <Link href={`/crm/products/${open.productId}`} className="mt-2 inline-block text-xs font-semibold text-[#9E4300] underline underline-offset-2">
            Open product
          </Link>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Qty label="In office" value={open.inOffice} />
            <Qty label="With team" value={open.withTeam} />
            <Qty label="With clients" value={open.withClient} />
            <Qty label="Pending supplier" value={open.pendingSupplier} />
          </div>
          {showCost ? <p className="mt-3 text-xs text-[#7C766F]">Unit cost · {formatCurrency(open.unitCost)}</p> : null}

          <h3 className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Clients holding this sample</h3>
          {open.companies.length === 0 ? (
            <p className="mt-1 text-xs text-[#7C766F]">No client is recorded as holding it.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {open.companies.map((company) => (
                <li key={company.id} className="flex justify-between border border-[#CCC5BD] bg-white px-2 py-1.5 text-xs">
                  <span>{company.name}</span>
                  <span className="font-mono">{company.quantity}</span>
                </li>
              ))}
            </ul>
          )}
          {open.withClient > open.companies.reduce((sum, company) => sum + company.quantity, 0) ? (
            <p className="mt-1 text-[11px] text-[#9E4300]">
              Unassigned with clients · {open.withClient - open.companies.reduce((sum, company) => sum + company.quantity, 0)}
            </p>
          ) : null}

          <h3 className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Team holding this sample</h3>
          {open.team.length === 0 ? (
            <p className="mt-1 text-xs text-[#7C766F]">No team member is recorded as holding it.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {open.team.map((member) => (
                <li key={member.id} className="border border-[#CCC5BD] bg-white px-2 py-1.5 text-xs">
                  <div className="flex justify-between">
                    <span>{member.name}</span>
                    <span className="font-mono">{member.quantity}</span>
                  </div>
                  {canManage ? (
                    <ActionForm action={returnSampleFromTeam} className="mt-2 flex items-center gap-1">
                      <input type="hidden" name="product_id" value={open.productId} />
                      <input type="hidden" name="profile_id" value={member.id} />
                      <input name="quantity" type="number" min={1} max={member.quantity} defaultValue={1} required className="w-16 border border-[#CCC5BD] px-1 py-1" />
                      <input name="note" placeholder="Condition · notes" className="min-w-0 flex-1 border border-[#CCC5BD] px-1 py-1" />
                      <SubmitButton className="border border-[#1C1B1A] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]" pendingLabel="Saving…">
                        Return
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Movements</h3>
          {movements.filter((movement) => movement.productId === open.productId).length === 0 ? (
            <p className="mt-1 text-xs text-[#7C766F]">No movements yet.</p>
          ) : (
            movements
              .filter((movement) => movement.productId === open.productId)
              .map((movement) => (
                <p key={movement.id} className="mt-1 border-t border-[#CCC5BD] py-1 text-[11px]">
                  {formatDateTime(movement.at)} · {movement.quantity} · {movement.from} → {movement.to}
                  {movement.companyName ? ` · ${movement.companyName}` : ''}
                  {movement.holderName ? ` · ${movement.holderName}` : ''}
                  {movement.actorName ? ` · by ${movement.actorName}` : ''}
                  {movement.note ? ` · ${movement.note}` : ''}
                </p>
              ))
          )}
        </Panel>
      ) : null}

      {receiveOpen ? (
        <Panel title="Receive into Office" onClose={() => setReceiveOpen(false)}>
          <p className="mb-3 text-xs text-[#7C766F]">
            Take pieces back from the client who holds them. Their sample balance is squared off.
          </p>
          <ActionForm action={receiveIntoOffice} className="space-y-3">
            <SearchPick
              label="Product"
              options={samples.filter((sample) => sample.companies.length > 0 || sample.withClient > 0).map((sample) => ({
                id: sample.productId,
                name: sample.name,
                sku: sample.sku,
              }))}
              value={receiveProduct}
              onChange={(id) => {
                setReceiveProduct(id)
                setReceiveCompany('')
              }}
              placeholder="Search product or SKU"
              empty="No sample is currently with a client."
            />
            <input type="hidden" name="product_id" value={receiveProduct} />
            <label className="block space-y-1">
              <span className={labelClass}>From client</span>
              <select
                name="company_id"
                required
                value={receiveCompany}
                onChange={(event) => setReceiveCompany(event.target.value)}
                className={fieldClass}
              >
                <option value="">Select client</option>
                {receiveHolders.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} · {company.quantity}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Quantity{held > 0 ? ` · max ${held}` : ''}</span>
              <input name="quantity" type="number" min={1} max={held || undefined} defaultValue={1} required className={fieldClass} />
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Condition · return notes</span>
              <textarea name="note" rows={3} placeholder="Good condition, damaged, kept by the client" className={fieldClass} />
            </label>
            <SubmitButton className="inline-flex min-h-10 w-full items-center justify-center bg-[#1C1B1A] text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2]" pendingLabel="Receiving…">
              Receive into Office
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      {sendOpen ? (
        <Panel title="Send sample" onClose={() => setSendOpen(false)}>
          <p className="mb-3 text-xs text-[#7C766F]">Send from the office to a client company or a team member.</p>
          <ActionForm action={sendSample} className="space-y-3">
            <SearchPick
              label="Product"
              options={samples.map((sample) => ({ id: sample.productId, name: sample.name, sku: sample.sku }))}
              value={sendProduct}
              onChange={setSendProduct}
              placeholder="Search product or SKU"
              empty="No sample stock yet."
            />
            <input type="hidden" name="product_id" value={sendProduct} />
            <fieldset className="space-y-1">
              <legend className={labelClass}>Send to</legend>
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="destination" value="company" checked={destination === 'company'} onChange={() => setDestination('company')} />
                Client company
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="destination" value="team" checked={destination === 'team'} onChange={() => setDestination('team')} />
                Team member
              </label>
            </fieldset>
            {destination === 'company' ? (
              <label className="block space-y-1">
                <span className={labelClass}>Client</span>
                <select name="company_id" required value={sendCompany} onChange={(event) => setSendCompany(event.target.value)} className={fieldClass}>
                  <option value="">Select client</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block space-y-1">
                <span className={labelClass}>Team member</span>
                <select name="profile_id" required value={sendProfile} onChange={(event) => setSendProfile(event.target.value)} className={fieldClass}>
                  <option value="">Select team member</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-1">
              <span className={labelClass}>Quantity</span>
              <input name="quantity" type="number" min={1} defaultValue={1} required className={fieldClass} />
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Notes</span>
              <input name="note" placeholder="Optional" className={fieldClass} />
            </label>
            <SubmitButton className="inline-flex min-h-10 w-full items-center justify-center bg-[#1C1B1A] text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2]" pendingLabel="Sending…">
              Send
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      {supplierOpen ? (
        <Panel title="Receive from supplier" onClose={() => setSupplierOpen(false)}>
          <p className="mb-3 text-xs text-[#7C766F]">New pieces arriving from a supplier, into office stock.</p>
          <ActionForm action={receiveSample} className="space-y-3">
            <SearchPick
              label="Product"
              options={products}
              value={supplierProduct}
              onChange={setSupplierProduct}
              placeholder="Search product or SKU"
              empty="No active product matches."
            />
            <input type="hidden" name="product_id" value={supplierProduct} />
            <label className="block space-y-1">
              <span className={labelClass}>Quantity</span>
              <input name="quantity" type="number" min={1} defaultValue={1} required className={fieldClass} />
            </label>
            {showCost ? (
              <label className="block space-y-1">
                <span className={labelClass}>Unit cost</span>
                <input name="unit_cost" type="number" min={0} step="0.01" className={fieldClass} />
              </label>
            ) : (
              <input type="hidden" name="unit_cost" value="0" />
            )}
            <SubmitButton className="inline-flex min-h-10 w-full items-center justify-center bg-[#806A50] text-[11px] font-bold uppercase tracking-[0.12em] text-white" pendingLabel="Receiving…">
              Receive from supplier
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
    </div>
  )
}
