'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { receiveIntoOffice, receiveSample, sendSample } from './actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { ProductThumb } from '@/components/ui/product-thumb'
import { formatCurrency } from '@/lib/utils'

export type HolderLine = { id: string; name: string; quantity: number }

export type SampleCard = {
  stockId: string
  productId: string
  name: string
  sku: string
  imageUrl: string | null
  inOffice: number
  withTeam: number
  withClient: number
  pendingSupplier: number
  unitCost: number | null
  clients: HolderLine[]
  team: HolderLine[]
}

export type MovementLine = {
  id: string
  when: string
  productName: string
  quantity: number
  from: string
  to: string
  who: string | null
  actor: string | null
  note: string | null
}

export type NamedOption = { id: string; name: string }

const inputClass =
  'min-h-10 w-full border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-1.5 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none'

function holderLabel(card: SampleCard) {
  const names = [...card.clients.map((row) => row.name), ...card.team.map((row) => row.name)]
  if (!names.length) return 'In the office'
  return names.slice(0, 2).join(' · ') + (names.length > 2 ? ` · +${names.length - 2}` : '')
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[11px] text-[#4A4640]">
      <span className="text-[#7C766F]">{label}</span> {value}
    </span>
  )
}

export function SamplesBoard({
  cards,
  movements,
  companies,
  team,
  catalogue,
  canMove,
  showCost,
  notice,
  error,
  balanceWarning,
}: {
  cards: SampleCard[]
  movements: MovementLine[]
  companies: NamedOption[]
  team: NamedOption[]
  catalogue: NamedOption[]
  canMove: boolean
  showCost: boolean
  notice: string | null
  error: string | null
  balanceWarning: string | null
}) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sendProduct, setSendProduct] = useState('')
  const [sendTo, setSendTo] = useState<'client' | 'team'>('client')
  const [sendCompany, setSendCompany] = useState('')
  const [sendMember, setSendMember] = useState('')
  const [sendFrom, setSendFrom] = useState<'office' | 'team'>('office')
  const [sendFromMember, setSendFromMember] = useState('')
  const [returnProduct, setReturnProduct] = useState('')
  const [returnFrom, setReturnFrom] = useState<'client' | 'team'>('client')
  const [returnParty, setReturnParty] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return cards
    return cards.filter((card) => {
      const haystack = [card.name, card.sku, ...card.clients.map((row) => row.name), ...card.team.map((row) => row.name)]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [cards, query])

  const open = cards.find((card) => card.stockId === openId) || null
  const sendCard = cards.find((card) => card.stockId === sendProduct) || null
  const returnCard = cards.find((card) => card.stockId === returnProduct) || null
  const returnParties = returnFrom === 'client' ? returnCard?.clients || [] : returnCard?.team || []
  const returnHeld = returnParties.find((row) => row.id === returnParty)?.quantity || 0
  const sendFromParties = sendCard?.team || []

  const totals = cards.reduce(
    (sum, card) => ({
      office: sum.office + card.inOffice,
      team: sum.team + card.withTeam,
      client: sum.client + card.withClient,
      supplier: sum.supplier + card.pendingSupplier,
    }),
    { office: 0, team: 0, client: 0, supplier: 0 },
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1B1A]">Samples</h1>
          <p className="mt-1 text-xs text-[#7C766F]">
            Office, team, and client pieces. Staff only · not on the store or client portals.
          </p>
        </div>
        <label className="block w-full sm:max-w-sm">
          <span className="sr-only">Search samples</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, SKU, or company"
            className={inputClass}
          />
        </label>
      </div>

      {error ? <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div> : null}
      {notice ? <div className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div> : null}
      {balanceWarning ? (
        <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{balanceWarning}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ['In office', totals.office],
          ['With team', totals.team],
          ['With clients', totals.client],
          ['Pending supplier', totals.supplier],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7C766F]">{label}</p>
            <p className="text-lg font-semibold text-[#1C1B1A]">{value}</p>
          </div>
        ))}
      </div>

      {canMove ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <ActionForm action={sendSample} className="space-y-2 border border-[#CCC5BD] bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A]">Send sample</p>
            <input type="hidden" name="stock_id" value={sendProduct} />
            <input type="hidden" name="to_holder" value={sendTo} />
            <input type="hidden" name="from_holder" value={sendTo === 'team' ? 'office' : sendFrom} />
            <MobileSheetSelect
              label="Product"
              showDesktopLabel
              value={sendProduct}
              onChange={(value) => {
                setSendProduct(value)
                setSendFromMember('')
              }}
              emptyLabel="Select product"
              options={[{ value: '', label: 'Select product' }, ...cards.map((card) => ({ value: card.stockId, label: `${card.name} · ${card.sku}` }))]}
            />
            <MobileSheetSelect
              label="To"
              showDesktopLabel
              value={sendTo}
              onChange={(value) => setSendTo(value === 'team' ? 'team' : 'client')}
              options={[
                { value: 'client', label: 'Client company' },
                { value: 'team', label: 'Team member' },
              ]}
            />
            {sendTo === 'client' ? (
              <MobileSheetSelect
                name="company_id"
                label="Client"
                showDesktopLabel
                required
                value={sendCompany}
                onChange={setSendCompany}
                emptyLabel="Select client"
                options={[{ value: '', label: 'Select client' }, ...companies.map((company) => ({ value: company.id, label: company.name }))]}
              />
            ) : (
              <MobileSheetSelect
                name="to_profile_id"
                label="Team member"
                showDesktopLabel
                required
                value={sendMember}
                onChange={setSendMember}
                emptyLabel="Select team member"
                options={[{ value: '', label: 'Select team member' }, ...team.map((person) => ({ value: person.id, label: person.name }))]}
              />
            )}
            {sendTo === 'client' ? (
              <MobileSheetSelect
                label="Take from"
                showDesktopLabel
                value={sendFrom}
                onChange={(value) => setSendFrom(value === 'team' ? 'team' : 'office')}
                options={[
                  { value: 'office', label: 'Office' },
                  { value: 'team', label: 'Team member' },
                ]}
              />
            ) : null}
            {sendTo === 'client' && sendFrom === 'team' ? (
              <MobileSheetSelect
                name="from_profile_id"
                label="Team member"
                showDesktopLabel
                required
                value={sendFromMember}
                onChange={setSendFromMember}
                emptyLabel="Who has it"
                options={[
                  { value: '', label: 'Who has it' },
                  ...sendFromParties.map((person) => ({ value: person.id, label: `${person.name} · ${person.quantity}` })),
                ]}
              />
            ) : null}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input name="quantity" type="number" min={1} defaultValue={1} required className={inputClass} aria-label="Quantity" />
              <SubmitButton className="min-h-10 bg-[#1C1B1A] px-3 text-xs font-semibold text-[#FCF9F2]" pendingLabel="Sending…">
                Send
              </SubmitButton>
            </div>
            <input name="note" placeholder="Note (optional)" className={inputClass} />
          </ActionForm>

          <ActionForm action={receiveIntoOffice} className="space-y-2 border border-[#CCC5BD] bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A]">Receive into Office</p>
            <input type="hidden" name="stock_id" value={returnProduct} />
            <input type="hidden" name="from_holder" value={returnFrom} />
            <MobileSheetSelect
              label="Product"
              showDesktopLabel
              value={returnProduct}
              onChange={(value) => {
                setReturnProduct(value)
                setReturnParty('')
              }}
              emptyLabel="Select product"
              options={[
                { value: '', label: 'Select product' },
                ...cards
                  .filter((card) => card.withClient > 0 || card.withTeam > 0)
                  .map((card) => ({ value: card.stockId, label: `${card.name} · ${card.sku}` })),
              ]}
            />
            <MobileSheetSelect
              label="From"
              showDesktopLabel
              value={returnFrom}
              onChange={(value) => {
                setReturnFrom(value === 'team' ? 'team' : 'client')
                setReturnParty('')
              }}
              options={[
                { value: 'client', label: 'Client company' },
                { value: 'team', label: 'Team member' },
              ]}
            />
            <MobileSheetSelect
              name={returnFrom === 'client' ? 'company_id' : 'holder_profile_id'}
              label={returnFrom === 'client' ? 'Client' : 'Team member'}
              showDesktopLabel
              required
              value={returnParty}
              onChange={setReturnParty}
              emptyLabel={returnParties.length ? 'Select who has it' : 'Nobody is holding this'}
              options={[
                { value: '', label: returnParties.length ? 'Select who has it' : 'Nobody is holding this' },
                ...returnParties.map((party) => ({ value: party.id, label: `${party.name} · ${party.quantity}` })),
              ]}
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                name="quantity"
                type="number"
                min={1}
                max={returnHeld || undefined}
                defaultValue={1}
                required
                className={inputClass}
                aria-label="Quantity"
              />
              <SubmitButton className="min-h-10 bg-[#1C1B1A] px-3 text-xs font-semibold text-[#FCF9F2]" pendingLabel="Receiving…">
                Receive
              </SubmitButton>
            </div>
            <input name="note" placeholder="Condition or return note (optional)" className={inputClass} />
            {returnParty ? (
              <p className="text-[11px] text-[#7C766F]">They hold {returnHeld}. Receiving that many squares the balance off.</p>
            ) : null}
          </ActionForm>
        </div>
      ) : null}

      {canMove ? (
        <details className="border border-[#CCC5BD] bg-white px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-[#4A4640]">Receive from supplier</summary>
          <ActionForm action={receiveSample} className="mt-2 grid items-end gap-2 md:grid-cols-4" resetOnSuccess>
            <MobileSheetSelect
              name="product_id"
              label="Product"
              showDesktopLabel
              required
              emptyLabel="Select product"
              className="md:col-span-2"
              options={[{ value: '', label: 'Select product' }, ...catalogue.map((product) => ({ value: product.id, label: product.name }))]}
            />
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7C766F]">Quantity</span>
              <input name="quantity" type="number" min={1} defaultValue={1} required className={inputClass} />
            </label>
            {showCost ? (
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7C766F]">Unit cost</span>
                <input name="unit_cost" type="number" step="0.01" min={0} placeholder="0.00" className={inputClass} />
              </label>
            ) : (
              <input type="hidden" name="unit_cost" value="0" />
            )}
            <SubmitButton className="min-h-10 border border-[#1C1B1A] px-3 text-xs font-semibold md:col-span-4" pendingLabel="Receiving…">
              Add to office
            </SubmitButton>
          </ActionForm>
        </details>
      ) : null}

      {filtered.length === 0 ? (
        <p className="border border-[#CCC5BD] bg-white px-4 py-8 text-center text-sm text-[#7C766F]">
          {cards.length === 0 ? 'No sample stock yet.' : 'No samples match that search.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <button
              key={card.stockId}
              type="button"
              onClick={() => setOpenId(card.stockId)}
              className="flex items-start gap-2 border border-[#CCC5BD] bg-white p-2 text-left hover:border-[#1C1B1A]"
            >
              <ProductThumb src={card.imageUrl} alt={card.name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#1C1B1A]">{card.name}</span>
                <span className="block truncate text-[11px] text-[#7C766F]">{card.sku}</span>
                <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  <Count label="Office" value={card.inOffice} />
                  <Count label="Team" value={card.withTeam} />
                  <Count label="Clients" value={card.withClient} />
                  <Count label="Supplier" value={card.pendingSupplier} />
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#4A4640]">{holderLabel(card)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpenId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sample-detail-title"
            className="h-full w-full max-w-md overflow-y-auto border-l border-[#CCC5BD] bg-[#FCF9F2] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="sample-detail-title" className="text-lg font-bold text-[#1C1B1A]">
                  {open.name}
                </h2>
                <p className="text-xs text-[#7C766F]">{open.sku}</p>
              </div>
              <button type="button" onClick={() => setOpenId(null)} className="text-xs font-semibold text-[#7C766F]">
                Close
              </button>
            </div>
            <Link href={`/crm/products/${open.productId}`} className="mt-3 inline-block text-xs font-semibold text-[#9E4300] underline">
              Open product
            </Link>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {[
                ['In office', open.inOffice],
                ['With team', open.withTeam],
                ['With clients', open.withClient],
                ['Pending supplier', open.pendingSupplier],
              ].map(([label, value]) => (
                <div key={String(label)} className="border border-[#CCC5BD] bg-white px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7C766F]">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {showCost ? <p className="mt-2 text-xs text-[#7C766F]">Unit cost {formatCurrency(open.unitCost)}</p> : null}
            <HolderList title="Clients" rows={open.clients} empty="No client is holding this sample." unassigned={open.withClient - open.clients.reduce((sum, row) => sum + row.quantity, 0)} />
            <HolderList title="Team" rows={open.team} empty="No team member is holding this sample." unassigned={open.withTeam - open.team.reduce((sum, row) => sum + row.quantity, 0)} />
          </div>
        </div>
      ) : null}

      <div className="border border-[#CCC5BD] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#1C1B1A]">Movement history</h2>
        {movements.length === 0 ? <p className="text-sm text-[#7C766F]">No movements recorded.</p> : null}
        {movements.map((movement) => (
          <p key={movement.id} className="border-t border-[#E7E1D8] py-1.5 text-xs text-[#4A4640]">
            {movement.when} · {movement.productName} · {movement.quantity} · {movement.from} → {movement.to}
            {movement.who ? ` · ${movement.who}` : ''}
            {movement.actor ? ` · by ${movement.actor}` : ''}
            {movement.note ? ` · ${movement.note}` : ''}
          </p>
        ))}
      </div>
    </div>
  )
}

function HolderList({
  title,
  rows,
  empty,
  unassigned,
}: {
  title: string
  rows: HolderLine[]
  empty: string
  unassigned: number
}) {
  return (
    <div className="mt-4">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">{title}</h3>
      {rows.length === 0 ? <p className="mt-1 text-xs text-[#7C766F]">{empty}</p> : null}
      <ul className="mt-1 space-y-1">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between gap-3 border border-[#CCC5BD] bg-white px-2 py-1.5 text-xs">
            <span className="truncate">{row.name}</span>
            <span className="font-semibold">{row.quantity}</span>
          </li>
        ))}
      </ul>
      {unassigned > 0 ? (
        <p className="mt-1 text-[11px] text-[#7C766F]">{unassigned} not tied to a name yet.</p>
      ) : null}
    </div>
  )
}
