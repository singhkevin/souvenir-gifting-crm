'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { receiveIntoOffice, receiveSample, sendSample, moveSample } from './actions'
import { filterSamples } from '@/lib/samples/ledger'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { ProductThumb } from '@/components/ui/product-thumb'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export type SampleParty = { id: string; name: string; quantity: number }

export type SampleCardModel = {
  id: string
  productId: string
  name: string
  sku: string
  imageUrl: string | null
  inOffice: number
  withTeam: number
  withClient: number
  pendingSupplier: number
  unitCostLabel: string | null
  holders: string[]
  clients: SampleParty[]
  team: SampleParty[]
}

export type MovementModel = {
  id: string
  productId: string
  productName: string
  quantity: number
  fromLabel: string
  toLabel: string
  who: string | null
  actor: string | null
  condition: string | null
  note: string | null
  when: string
}

type Named = { id: string; name: string; sku?: string }

const fieldClass = 'min-h-9 w-full border border-[#CCC5BD] bg-white px-2 py-1 text-xs text-[#1C1B1A]'
const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A7267]'

function countsLine(card: SampleCardModel) {
  return `Office ${card.inOffice} · Team ${card.withTeam} · Clients ${card.withClient} · Supplier ${card.pendingSupplier}`
}

function movementLine(row: MovementModel) {
  return [
    row.when,
    row.productName,
    String(row.quantity),
    `${row.fromLabel} → ${row.toLabel}`,
    row.who,
    row.actor ? `by ${row.actor}` : null,
    row.condition,
    row.note,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function SamplesBoard({
  cards,
  movements,
  products,
  companies,
  team,
  canManage,
  showCost,
  notice,
  received,
  moved,
  returned,
  sent,
}: {
  cards: SampleCardModel[]
  movements: MovementModel[]
  products: Named[]
  companies: Named[]
  team: Named[]
  canManage: boolean
  showCost: boolean
  notice: string
  received: boolean
  moved: boolean
  returned: boolean
  sent: boolean
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = useMemo(() => filterSamples(cards, query), [cards, query])
  const selected = cards.find((card) => card.id === selectedId) || null

  useEffect(() => {
    if (!selectedId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])
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
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Samples</h1>
        <p className="mt-1 text-xs text-[#7A7267]">
          Office stock for staff only. Send a piece to a client or a team member, and receive it back into the office.
        </p>
      </div>

      {notice ? <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</div> : null}
      {received ? <div className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Sample received from the supplier.</div> : null}
      {sent ? <div className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Sample send recorded.</div> : null}
      {returned ? <div className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Sample received into the office.</div> : null}
      {moved ? <div className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Sample movement recorded.</div> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['In office', totals.office],
          ['With team', totals.team],
          ['With clients', totals.client],
          ['Pending supplier', totals.supplier],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-[#E6E0D6] bg-white px-3 py-2">
            <p className={labelClass}>{label}</p>
            <p className="text-lg font-semibold text-[#1C1B1A]">{value}</p>
          </div>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">Search samples</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, SKU, or company"
          className={fieldClass}
        />
      </label>

      {canManage ? (
        <div className="grid gap-2 xl:grid-cols-3">
          <SendForm cards={cards} companies={companies} team={team} />
          <ReceiveForm cards={cards} />
          <SupplierForm products={products} showCost={showCost} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelectedId(card.id)}
            className="flex w-full items-center gap-2 border border-[#E6E0D6] bg-white p-2 text-left hover:border-[#806A50]"
          >
            <ProductThumb src={card.imageUrl} alt={card.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[#1C1B1A]">{card.name}</span>
              <span className="block truncate text-[11px] text-[#7A7267]">{card.sku}</span>
              <span className="block truncate text-[11px] text-[#4A4640]">{countsLine(card)}</span>
            </span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="border border-[#E6E0D6] bg-white px-3 py-6 text-center text-sm text-[#7A7267]">
          {cards.length === 0 ? 'No sample stock yet.' : 'No samples match that search.'}
        </p>
      ) : null}

      <div className="border border-[#E6E0D6] bg-white px-3 py-2">
        <h2 className="font-serif text-base text-[#1C1B1A]">Recent movements</h2>
        <div className="mt-1">
          {movements.slice(0, 12).map((row) => (
            <p key={row.id} className="border-t border-[#E6E0D6] py-1 text-[11px] text-[#4A4640]">
              {movementLine(row)}
            </p>
          ))}
          {movements.length === 0 ? <p className="text-sm text-[#7A7267]">No movements recorded.</p> : null}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelectedId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sample-detail-title"
            className="h-full w-full max-w-md overflow-y-auto border-l border-[#CCC5BD] bg-[#FCF9F2] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <SampleDetail
              key={selected.id}
              card={selected}
              movements={movements.filter((row) => row.productId === selected.productId)}
              companies={companies}
              team={team}
              cards={cards}
              canManage={canManage}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SampleDetail({
  card,
  movements,
  companies,
  team,
  cards,
  canManage,
  onClose,
}: {
  card: SampleCardModel
  movements: MovementModel[]
  companies: Named[]
  team: Named[]
  cards: SampleCardModel[]
  canManage: boolean
  onClose: () => void
}) {
  const clientNamed = card.clients.reduce((sum, client) => sum + client.quantity, 0)
  const teamNamed = card.team.reduce((sum, member) => sum + member.quantity, 0)
  const clientGap = Math.max(0, card.withClient - clientNamed)
  const teamGap = Math.max(0, card.withTeam - teamNamed)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <ProductThumb src={card.imageUrl} alt={card.name} size={40} />
          <div className="min-w-0">
            <h2 id="sample-detail-title" className="truncate text-lg font-semibold text-[#1C1B1A]">
              {card.name}
            </h2>
            <p className="text-[11px] text-[#7A7267]">{card.sku}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-[#7A7267]">
          Close
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        {[
          ['In office', card.inOffice],
          ['With team', card.withTeam],
          ['With clients', card.withClient],
          ['Pending supplier', card.pendingSupplier],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-[#E6E0D6] bg-white px-2 py-1.5">
            <dt className={labelClass}>{label}</dt>
            <dd className="text-base font-semibold text-[#1C1B1A]">{value}</dd>
          </div>
        ))}
      </dl>
      {card.unitCostLabel ? <p className="text-xs text-[#7A7267]">Unit cost · {card.unitCostLabel}</p> : null}

      <div className="space-y-1 text-xs text-[#1C1B1A]">
        <p className={labelClass}>Clients holding this sample</p>
        {card.clients.length === 0 ? <p className="text-[#7A7267]">No client is recorded as holding this sample.</p> : null}
        {card.clients.map((client) => (
          <p key={client.id}>
            {client.name} · {client.quantity}
          </p>
        ))}
        {clientGap > 0 ? <p className="text-[#7A7267]">Client not recorded · {clientGap}</p> : null}
      </div>

      <div className="space-y-1 text-xs text-[#1C1B1A]">
        <p className={labelClass}>Team holding this sample</p>
        {card.team.length === 0 ? <p className="text-[#7A7267]">No team member is recorded as holding this sample.</p> : null}
        {card.team.map((member) => (
          <p key={member.id}>
            {member.name} · {member.quantity}
          </p>
        ))}
        {teamGap > 0 ? <p className="text-[#7A7267]">Team member not recorded · {teamGap}</p> : null}
      </div>

      <Link href={`/crm/products/${card.productId}`} className="inline-flex text-xs font-semibold text-[#806A50] underline">
        Open product
      </Link>

      {canManage ? (
        <div className="space-y-2">
          <SendForm cards={cards} companies={companies} team={team} locked={card} />
          <ReceiveForm cards={cards} locked={card} />
          <OtherMovement card={card} companies={companies} team={team} />
        </div>
      ) : null}

      <div>
        <p className={labelClass}>Movements</p>
        {movements.length === 0 ? <p className="text-xs text-[#7A7267]">No movements for this product in the recent list.</p> : null}
        {movements.map((row) => (
          <p key={row.id} className="border-t border-[#E6E0D6] py-1 text-[11px] text-[#4A4640]">
            {movementLine(row)}
          </p>
        ))}
      </div>
    </div>
  )
}

function SendForm({
  cards,
  companies,
  team,
  locked,
}: {
  cards: SampleCardModel[]
  companies: Named[]
  team: Named[]
  locked?: SampleCardModel
}) {
  const [productId, setProductId] = useState(locked?.productId || '')
  const [destination, setDestination] = useState('client')
  const [fromProfileId, setFromProfileId] = useState('')
  const card = cards.find((item) => item.productId === productId) || locked || null
  const sources = card?.team || []

  return (
    <ActionForm action={sendSample} className="space-y-2 border border-[#E6E0D6] bg-white p-3" resetOnSuccess>
      <p className="text-xs font-semibold text-[#806A50]">Send sample</p>
      {locked ? (
        <input type="hidden" name="product_id" value={locked.productId} />
      ) : (
        <MobileSheetSelect
          name="product_id"
          label="Product"
          required
          showDesktopLabel
          value={productId}
          onChange={(value) => {
            setProductId(value)
            setFromProfileId('')
          }}
          emptyLabel="Select product"
          options={[
            { value: '', label: 'Select product' },
            ...cards.map((item) => ({ value: item.productId, label: `${item.name} · ${item.sku} · Office ${item.inOffice}` })),
          ]}
        />
      )}
      <MobileSheetSelect
        name="destination"
        label="Goes to"
        showDesktopLabel
        value={destination}
        onChange={(value) => {
          setDestination(value)
          if (value !== 'client') setFromProfileId('')
        }}
        options={[
          { value: 'client', label: 'Client company' },
          { value: 'team', label: 'Team member' },
        ]}
      />
      {destination === 'client' ? (
        <MobileSheetSelect
          name="company_id"
          label="Client"
          required
          showDesktopLabel
          emptyLabel="Select client"
          options={[{ value: '', label: 'Select client' }, ...companies.map((company) => ({ value: company.id, label: company.name }))]}
        />
      ) : (
        <MobileSheetSelect
          name="profile_id"
          label="Team member"
          required
          showDesktopLabel
          emptyLabel="Select team member"
          options={[{ value: '', label: 'Select team member' }, ...team.map((member) => ({ value: member.id, label: member.name }))]}
        />
      )}
      {destination === 'client' && sources.length > 0 ? (
        <MobileSheetSelect
          name="from_profile_id"
          label="From"
          showDesktopLabel
          value={fromProfileId}
          onChange={setFromProfileId}
          options={[
            { value: '', label: 'From office' },
            ...sources.map((member) => ({ value: member.id, label: `From ${member.name} · ${member.quantity}` })),
          ]}
        />
      ) : (
        <input type="hidden" name="from_holder" value="office" />
      )}
      {destination === 'client' && fromProfileId ? <input type="hidden" name="from_holder" value="team" /> : null}
      {!fromProfileId && destination === 'client' && sources.length > 0 ? <input type="hidden" name="from_holder" value="office" /> : null}
      <div className="grid grid-cols-2 gap-2">
        <input name="quantity" type="number" min={1} required defaultValue={1} className={fieldClass} aria-label="Quantity" />
        <SubmitButton className="bg-[#806A50] px-2 py-1 text-xs font-semibold text-white" pendingLabel="Sending…">
          Send
        </SubmitButton>
      </div>
      <input name="note" placeholder="Notes (optional)" className={fieldClass} />
    </ActionForm>
  )
}

function ReceiveForm({ cards, locked }: { cards: SampleCardModel[]; locked?: SampleCardModel }) {
  const choices = cards.filter((card) => card.clients.length > 0)
  const [productId, setProductId] = useState(locked?.productId || '')
  const [companyId, setCompanyId] = useState('')
  const card = (locked && locked.productId === productId ? locked : null) || cards.find((item) => item.productId === productId) || null
  const clients = card?.clients || []
  const held = clients.find((client) => client.id === companyId)?.quantity || 0

  return (
    <ActionForm action={receiveIntoOffice} className="space-y-2 border border-[#806A50]/30 bg-[#F4EFE6] p-3" resetOnSuccess>
      <p className="text-xs font-semibold text-[#806A50]">Receive into Office</p>
      {locked ? (
        <input type="hidden" name="product_id" value={locked.productId} />
      ) : (
        <MobileSheetSelect
          name="product_id"
          label="Product"
          required
          showDesktopLabel
          value={productId}
          onChange={(value) => {
            setProductId(value)
            setCompanyId('')
          }}
          emptyLabel="Select product"
          options={[
            { value: '', label: choices.length ? 'Select product' : 'No client is holding a sample' },
            ...choices.map((item) => ({ value: item.productId, label: `${item.name} · ${item.sku}` })),
          ]}
        />
      )}
      <MobileSheetSelect
        name="company_id"
        label="Client holding it"
        required
        showDesktopLabel
        value={companyId}
        onChange={setCompanyId}
        emptyLabel="Select client"
        options={[
          { value: '', label: clients.length ? 'Select client' : 'No client holds this sample' },
          ...clients.map((client) => ({ value: client.id, label: `${client.name} · ${client.quantity}` })),
        ]}
      />
      <input
        key={`${productId}:${companyId}`}
        name="quantity"
        type="number"
        min={1}
        max={held || undefined}
        required
        defaultValue={1}
        className={fieldClass}
        aria-label="Quantity"
      />
      <SubmitButton className="w-full bg-[#806A50] px-2 py-2 text-xs font-semibold text-white" pendingLabel="Receiving…">
        Receive into Office
      </SubmitButton>
      <input name="condition" placeholder="Condition (optional)" className={fieldClass} />
      <input name="note" placeholder="Return notes (optional)" className={fieldClass} />
      {companyId ? <p className="text-[11px] text-[#7A7267]">This client holds {held}.</p> : null}
    </ActionForm>
  )
}

function SupplierForm({ products, showCost }: { products: Named[]; showCost: boolean }) {
  return (
    <ActionForm action={receiveSample} className="space-y-2 border border-[#E6E0D6] bg-white p-3" resetOnSuccess>
      <p className="text-xs font-semibold text-[#1C1B1A]">Receive from supplier</p>
      <MobileSheetSelect
        name="product_id"
        label="Product"
        required
        showDesktopLabel
        emptyLabel="Select product"
        options={[
          { value: '', label: 'Select product' },
          ...products.map((product) => ({ value: product.id, label: `${product.name} · ${product.sku || ''}` })),
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <input name="quantity" type="number" min={1} required defaultValue={1} className={fieldClass} aria-label="Quantity" />
        {showCost ? (
          <input name="unit_cost" type="number" min={0} step="0.01" placeholder="Unit cost" className={fieldClass} aria-label="Unit cost" />
        ) : (
          <input type="hidden" name="unit_cost" value="0" />
        )}
      </div>
      <SubmitButton className="w-full border border-[#806A50] px-2 py-1 text-xs font-semibold text-[#806A50]" pendingLabel="Receiving…">
        Receive from supplier
      </SubmitButton>
    </ActionForm>
  )
}

function OtherMovement({ card, companies, team }: { card: SampleCardModel; companies: Named[]; team: Named[] }) {
  return (
    <details className="border border-[#E6E0D6] bg-white p-2 text-xs">
      <summary className="cursor-pointer text-[#7A7267]">Other movement</summary>
      <ActionForm action={moveSample} className="mt-2 space-y-2">
        <input type="hidden" name="stock_id" value={card.id} />
        <div className="grid grid-cols-2 gap-2">
          <MobileSheetSelect
            name="from_holder"
            label="From"
            defaultValue="office"
            options={[
              { value: 'office', label: 'From office' },
              { value: 'team', label: 'From team' },
              { value: 'client', label: 'From client' },
              { value: 'supplier', label: 'From supplier' },
            ]}
          />
          <MobileSheetSelect
            name="to_holder"
            label="To"
            defaultValue="team"
            options={[
              { value: 'team', label: 'To team' },
              { value: 'office', label: 'To office' },
              { value: 'client', label: 'To client' },
              { value: 'supplier', label: 'To supplier' },
            ]}
          />
        </div>
        <input name="quantity" type="number" min={1} defaultValue={1} required className={fieldClass} aria-label="Quantity" />
        <MobileSheetSelect
          name="company_id"
          label="Client"
          emptyLabel="Client, when the sample is with a client"
          options={[
            { value: '', label: 'Client, when the sample is with a client' },
            ...companies.map((company) => ({ value: company.id, label: company.name })),
          ]}
        />
        <MobileSheetSelect
          name="profile_id"
          label="Team member"
          emptyLabel="Team member, when the sample is with the team"
          options={[
            { value: '', label: 'Team member, when the sample is with the team' },
            ...team.map((member) => ({ value: member.id, label: member.name })),
          ]}
        />
        <input name="note" placeholder="Notes (optional)" className={fieldClass} />
        <SubmitButton className="w-full border px-2 py-1 text-xs font-semibold" pendingLabel="Recording…">
          Record movement
        </SubmitButton>
      </ActionForm>
    </details>
  )
}
