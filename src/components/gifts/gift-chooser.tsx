'use client'

import { useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { submitGiftChoice } from '@/app/gift/actions'
import { giftChoiceProblem } from '@/lib/gifts/rules'

export type GiftChoiceItem = {
  id: string
  title: string
  imageUrl: string | null
  kind: 'product' | 'combo'
  memberNames: string[]
  sizeOptions: string[]
}

type Details = {
  name: string
  phone: string
  address: string
  city: string
  state: string
  pin: string
}

const EMPTY: Details = { name: '', phone: '', address: '', city: '', state: '', pin: '' }

export function GiftChooser({
  selectionId,
  selectionName,
  items,
}: {
  selectionId: string
  selectionName: string
  items: GiftChoiceItem[]
}) {
  const [itemId, setItemId] = useState('')
  const [size, setSize] = useState('')
  const [details, setDetails] = useState<Details>(EMPTY)
  const [step, setStep] = useState<'choose' | 'details' | 'confirm'>('choose')
  const [problem, setProblem] = useState<string | null>(null)

  const item = items.find((row) => row.id === itemId) || null

  function continueChoose() {
    if (!item) {
      setProblem('Choose one gift.')
      return
    }
    if (item.sizeOptions.length > 0 && !item.sizeOptions.includes(size)) {
      setProblem('Choose a size.')
      return
    }
    setProblem(null)
    setStep('details')
  }

  function continueDetails() {
    const message = giftChoiceProblem({
      ...details,
      size,
      sizeOptions: item?.sizeOptions || [],
    })
    if (message) {
      setProblem(message)
      return
    }
    setProblem(null)
    setStep('confirm')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50]">Gift selection</p>
        <h1 className="mt-2 font-serif text-3xl text-[#1B2430]">{selectionName}</h1>
        <p className="mt-2 text-sm text-[#5C6570]">Choose one gift. After you confirm, the choice is locked.</p>
      </div>

      {step === 'choose' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((row) => {
              const selected = row.id === itemId
              return (
                <div
                  key={row.id}
                  className={`rounded-2xl border p-3 text-left ${selected ? 'border-[#806A50] ring-1 ring-[#806A50]' : 'border-[#E8E4DE] bg-white'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setItemId(row.id)
                      setSize('')
                      setProblem(null)
                    }}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#F6F4F1]">
                      <ProductImage src={row.imageUrl} alt={row.title} size="md" fit="contain" className="h-full w-full bg-transparent" />
                    </div>
                    <p className="mt-3 font-medium text-[#1B2430]">{row.title}</p>
                    {row.memberNames.length ? (
                      <p className="mt-1 text-xs text-[#5C6570]">{row.memberNames.join(' · ')}</p>
                    ) : null}
                  </button>
                  {selected && row.sizeOptions.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.sizeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={size === option}
                          onClick={() => setSize(option)}
                          className={`rounded-full border px-3 py-1 text-xs ${size === option ? 'border-[#241C12] bg-[#241C12] text-white' : 'border-[#E8E4DE]'}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
          <button type="button" onClick={continueChoose} className="rounded-lg bg-[#241C12] px-4 py-2.5 text-sm font-semibold text-white">
            Continue
          </button>
        </div>
      ) : null}

      {step === 'details' ? (
        <div className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-4">
          <p className="text-sm text-[#5C6570]">
            {item?.title}
            {size ? ` · ${size}` : ''}
          </p>
          <Field label="Name" value={details.name} onChange={(name) => setDetails({ ...details, name })} />
          <Field label="Phone (10 digits)" value={details.phone} onChange={(phone) => setDetails({ ...details, phone })} />
          <Field label="Shipping address" value={details.address} onChange={(address) => setDetails({ ...details, address })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" value={details.city} onChange={(city) => setDetails({ ...details, city })} />
            <Field label="State" value={details.state} onChange={(state) => setDetails({ ...details, state })} />
            <Field label="PIN" value={details.pin} onChange={(pin) => setDetails({ ...details, pin })} />
          </div>
          {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('choose')} className="rounded-lg border px-4 py-2 text-sm">
              Back
            </button>
            <button type="button" onClick={continueDetails} className="rounded-lg bg-[#241C12] px-4 py-2.5 text-sm font-semibold text-white">
              Review
            </button>
          </div>
        </div>
      ) : null}

      {step === 'confirm' && item ? (
        <ActionForm action={submitGiftChoice} className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <input type="hidden" name="selection_id" value={selectionId} />
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="size" value={size} />
          <input type="hidden" name="employee_name" value={details.name} />
          <input type="hidden" name="phone" value={details.phone} />
          <input type="hidden" name="address" value={details.address} />
          <input type="hidden" name="city" value={details.city} />
          <input type="hidden" name="state" value={details.state} />
          <input type="hidden" name="pin" value={details.pin} />
          <h2 className="font-serif text-2xl">Confirm your gift</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Gift" value={item.title} />
            <Row label="Size" value={size || '—'} />
            <Row label="Name" value={details.name} />
            <Row label="Phone" value={details.phone} />
            <Row label="Address" value={details.address} />
            <Row label="City" value={details.city} />
            <Row label="State" value={details.state} />
            <Row label="PIN" value={details.pin} />
          </dl>
          <p className="text-sm text-[#5C6570]">This cannot be edited after you submit.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('details')} className="rounded-lg border px-4 py-2 text-sm">
              Back
            </button>
            <SubmitButton className="rounded-lg bg-[#241C12] px-4 py-2.5 text-sm font-semibold text-white" pendingLabel="Submitting…">
              Submit choice
            </SubmitButton>
          </div>
        </ActionForm>
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs text-[#5C6570]">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E8E4DE] px-3 py-2 text-sm text-[#1B2430]" />
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#F0EBE3] py-2">
      <dt className="text-[#5C6570]">{label}</dt>
      <dd className="text-right font-medium text-[#1B2430]">{value}</dd>
    </div>
  )
}
