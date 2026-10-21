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
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((row) => {
              const selected = row.id === itemId
              return (
                <div
                  key={row.id}
                  className={`border p-4 text-left transition-colors ${
                    selected ? 'border-[#1C1B1A] bg-[#FCF9F2] ring-1 ring-[#1C1B1A]' : 'border-[#CCC5BD] bg-[#FCF9F2] hover:border-[#1C1B1A]'
                  }`}
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
                    <div className="aspect-[4/3] overflow-hidden bg-[#F1EEE7] p-4 flex items-center justify-center">
                      <ProductImage src={row.imageUrl} alt={row.title} size="md" fit="contain" className="h-full w-full bg-transparent" />
                    </div>
                    <p className="mt-3 font-serif text-lg text-[#1C1B1A]">{row.title}</p>
                    {row.memberNames.length ? (
                      <p className="mt-1 font-mono text-xs text-[#7C766F]">{row.memberNames.join(' · ')}</p>
                    ) : null}
                  </button>
                  {selected && row.sizeOptions.length ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#CCC5BD] pt-3">
                      {row.sizeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={size === option}
                          onClick={() => setSize(option)}
                          className={`border px-3 py-1 font-mono text-xs transition-colors ${
                            size === option ? 'border-[#1C1B1A] bg-[#1C1B1A] text-[#FCF9F2]' : 'border-[#CCC5BD] bg-[#FCF9F2] text-[#4A4640]'
                          }`}
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
          {problem ? <p className="font-mono text-xs text-red-700">{problem}</p> : null}
          <button
            type="button"
            onClick={continueChoose}
            className="bg-[#000000] hover:bg-[#9E4300] px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#FCF9F2] transition-colors"
          >
            Continue
          </button>
        </div>
      ) : null}

      {step === 'details' ? (
        <div className="space-y-4 border border-[#CCC5BD] bg-[#FCF9F2] p-6">
          <div className="border-b border-[#CCC5BD] pb-3">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300] block mb-1">
              Recipient &amp; Delivery Details
            </span>
            <p className="font-serif text-xl text-[#1C1B1A]">
              {item?.title}
              {size ? ` · Size: ${size}` : ''}
            </p>
          </div>
          <Field label="Full name" value={details.name} onChange={(name) => setDetails({ ...details, name })} />
          <Field label="Phone number (10 digits)" value={details.phone} onChange={(phone) => setDetails({ ...details, phone })} />
          <Field label="Delivery street address" value={details.address} onChange={(address) => setDetails({ ...details, address })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" value={details.city} onChange={(city) => setDetails({ ...details, city })} />
            <Field label="State" value={details.state} onChange={(state) => setDetails({ ...details, state })} />
            <Field label="PIN Code" value={details.pin} onChange={(pin) => setDetails({ ...details, pin })} />
          </div>
          {problem ? <p className="font-mono text-xs text-red-700">{problem}</p> : null}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="border border-[#CCC5BD] bg-[#FCF9F2] px-4 py-2 text-xs uppercase tracking-wider text-[#1C1B1A] hover:bg-[#F6F3EC]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={continueDetails}
              className="bg-[#000000] hover:bg-[#9E4300] px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#FCF9F2] transition-colors"
            >
              Review Selection
            </button>
          </div>
        </div>
      ) : null}

      {step === 'confirm' && item ? (
        <ActionForm action={submitGiftChoice} className="space-y-4 border border-[#CCC5BD] bg-[#FCF9F2] p-6">
          <input type="hidden" name="selection_id" value={selectionId} />
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="size" value={size} />
          <input type="hidden" name="employee_name" value={details.name} />
          <input type="hidden" name="phone" value={details.phone} />
          <input type="hidden" name="address" value={details.address} />
          <input type="hidden" name="city" value={details.city} />
          <input type="hidden" name="state" value={details.state} />
          <input type="hidden" name="pin" value={details.pin} />
          <h2 className="font-serif text-2xl text-[#1C1B1A]">Confirm your gift</h2>
          <dl className="space-y-2 border-t border-[#CCC5BD] pt-4 font-mono text-xs">
            <Row label="Gift" value={item.title} />
            <Row label="Size" value={size || '—'} />
            <Row label="Name" value={details.name} />
            <Row label="Phone" value={details.phone} />
            <Row label="Address" value={details.address} />
            <Row label="City" value={details.city} />
            <Row label="State" value={details.state} />
            <Row label="PIN" value={details.pin} />
          </dl>
          <p className="font-mono text-xs text-[#7C766F]">This selection cannot be changed after submission.</p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('details')}
              className="border border-[#CCC5BD] bg-[#FCF9F2] px-4 py-2 text-xs uppercase tracking-wider text-[#1C1B1A] hover:bg-[#F6F3EC]"
            >
              Back
            </button>
            <SubmitButton
              className="bg-[#000000] hover:bg-[#9E4300] px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#FCF9F2] transition-colors"
              pendingLabel="Submitting…"
            >
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
    <label className="block font-sans text-xs font-semibold uppercase tracking-wider text-[#4A4640]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2 font-sans text-sm text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none"
      />
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#CCC5BD] py-2">
      <dt className="text-[#7C766F]">{label}</dt>
      <dd className="text-right font-medium text-[#1C1B1A]">{value}</dd>
    </div>
  )
}
