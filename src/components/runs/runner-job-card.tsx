'use client'

import { useRef, useState } from 'react'
import { useAction } from '@/lib/use-action'
import {
  completeDeliveryAction,
  completeRunnerJob,
  releaseRunnerJob,
  startRunnerJob,
} from '@/app/crm/orders/fulfilment-actions'
import { compressImage, canvasToPngFile } from './image-tools'
import { SignaturePad, type SignaturePadHandle } from './signature-pad'

export type RunnerJobView = {
  id: string
  orderId: string
  orderNumber: string
  client: string
  kind: string
  kindLabel: string
  status: string
  statusLabel: string
  scheduledFor: string | null
  from: string | null
  to: string | null
  address: string | null
  contactPhone: string | null
  notes: string | null
  deliveryId: string | null
  assignee: string | null
  mine: boolean
  lines: { id: string; name: string; expected: number }[]
}

const input = 'w-full border border-[#D8CFC2] bg-white px-2 py-2 text-sm'
const btn = 'min-h-11 px-4 py-2 text-sm font-medium disabled:opacity-50'

export function RunnerJobCard({
  job,
  isRunner,
  requireSignature,
  requireSealPhoto,
  readOnly = false,
}: {
  job: RunnerJobView
  isRunner: boolean
  readOnly?: boolean
  requireSignature: boolean
  requireSealPhoto: boolean
}) {
  const { pending, error, run } = useAction()
  const [mode, setMode] = useState<'idle' | 'complete' | 'release'>('idle')
  const formRef = useRef<HTMLFormElement | null>(null)
  const sigRef = useRef<SignaturePadHandle | null>(null)
  const isDelivery = job.kind === 'delivery'
  const canAct = !readOnly && job.status !== 'open' && (!isRunner || job.mine)

  const submitCounts = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    run(async () => {
      const fd = new FormData(form)
      for (const key of ['photo', 'seal_photo']) {
        const f = fd.get(key)
        if (f instanceof File && f.size > 0) fd.set(key, await compressImage(f))
        else fd.delete(key)
      }
      if (isDelivery) {
        const pad = sigRef.current
        if (pad && !pad.isEmpty()) {
          const c = pad.canvas()
          const png = c ? await canvasToPngFile(c, 'signature.png') : null
          if (png) fd.set('signature', png)
        } else if (requireSignature) {
          return { error: 'Ask the receiver to sign before you submit' }
        }
        if (requireSealPhoto && !(fd.get('seal_photo') instanceof File)) {
          return { error: 'Add a photo of the seal or signed challan' }
        }
        return completeDeliveryAction(fd)
      }
      return completeRunnerJob(fd)
    }, { onSuccess: () => setMode('idle') })
  }

  return (
    <article className="space-y-3 border border-[#E5DFD5] bg-white p-3 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[#1C1C18]">{job.kindLabel}</div>
          <div className="text-xs text-[#7A7267]">
            {job.orderNumber}
            {job.client ? ` · ${job.client}` : ''}
            {job.scheduledFor ? ` · ${job.scheduledFor}` : ''}
          </div>
        </div>
        <span className="border border-[#E5DFD5] bg-[#FAF7F2] px-2 py-0.5 text-[11px]">
          {job.statusLabel}
          {!isRunner ? ` · ${job.assignee || 'Unassigned'}` : ''}
        </span>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {job.from && (<><dt className="text-[#7A7267]">From</dt><dd>{job.from}</dd></>)}
        {job.to && (<><dt className="text-[#7A7267]">To</dt><dd>{job.to}</dd></>)}
        {job.address && (<><dt className="text-[#7A7267]">Address</dt><dd className="whitespace-pre-line">{job.address}</dd></>)}
        {job.contactPhone && (
          <>
            <dt className="text-[#7A7267]">Contact</dt>
            <dd><a href={`tel:${job.contactPhone.replace(/\s+/g, '')}`} className="text-[#9E4300] underline">{job.contactPhone}</a></dd>
          </>
        )}
        {job.notes && (<><dt className="text-[#7A7267]">Note</dt><dd>{job.notes}</dd></>)}
      </dl>

      <ul className="space-y-1 border-t border-[#EFE9E0] pt-2 text-xs">
        {job.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-2">
            <span>{l.name}</span>
            <span className="font-medium">{l.expected} pcs</span>
          </li>
        ))}
        {job.lines.length === 0 && <li className="text-[#7A7267]">No products listed on this job.</li>}
      </ul>

      {error && <p role="alert" className="border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}

      {job.status === 'open' && (
        <p className="text-xs text-[#7A7267]">Waiting for someone to be assigned from the order’s Fulfilment tab.</p>
      )}

      {canAct && mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {job.status === 'assigned' && (
            <button type="button" disabled={pending} className={`${btn} border border-[#806A50] bg-white`} onClick={() => run(() => startRunnerJob(job.orderId, job.id))}>
              On my way
            </button>
          )}
          <button type="button" disabled={pending} className={`${btn} bg-[#806A50] text-white`} onClick={() => setMode('complete')}>
            {isDelivery ? 'Record delivery' : 'Count and complete'}
          </button>
          <button type="button" disabled={pending} className={`${btn} border border-[#D8CFC2] bg-white text-[#7A7267]`} onClick={() => setMode('release')}>
            Can’t do this
          </button>
        </div>
      )}

      {canAct && mode === 'release' && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            run(() => releaseRunnerJob(fd), { onSuccess: () => setMode('idle') })
          }}
        >
          <input type="hidden" name="job_id" value={job.id} />
          <input type="hidden" name="order_id" value={job.orderId} />
          <label className="block text-xs">
            Why can’t you do it?
            <input name="reason" required className={input} placeholder="e.g. Bike broke down, on leave" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={`${btn} bg-[#806A50] text-white`}>Hand back</button>
            <button type="button" className={`${btn} border border-[#D8CFC2]`} onClick={() => setMode('idle')}>Back</button>
          </div>
        </form>
      )}

      {canAct && mode === 'complete' && (
        <form ref={formRef} className="space-y-3" onSubmit={submitCounts}>
          <input type="hidden" name="job_id" value={job.id} />
          {job.deliveryId && <input type="hidden" name="delivery_id" value={job.deliveryId} />}
          <p className="text-xs text-[#7A7267]">
            {isDelivery
              ? 'Enter what the receiver accepted. Anything damaged or missing is flagged to operations.'
              : 'Count every piece. Short or damaged counts are flagged to operations straight away.'}
          </p>
          {job.lines.map((l) => (
            <fieldset key={l.id} className="space-y-1 border border-[#EFE9E0] p-2">
              <legend className="px-1 text-xs font-medium">{l.name} · expected {l.expected}</legend>
              <input type="hidden" name="line_id" value={l.id} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  {isDelivery ? 'Received' : 'Counted (good)'}
                  <input name={`counted_${l.id}`} type="number" min={0} inputMode="numeric" required defaultValue={l.expected} className={input} />
                </label>
                <label className="text-xs">
                  Damaged
                  <input name={`damaged_${l.id}`} type="number" min={0} inputMode="numeric" defaultValue={0} className={input} />
                </label>
              </div>
              {!isDelivery && (
                <input name={`note_${l.id}`} className={input} placeholder="Note (optional)" />
              )}
            </fieldset>
          ))}

          {isDelivery ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  Receiver name
                  <input name="receiver_name" required className={input} />
                </label>
                <label className="text-xs">
                  Receiver phone
                  <input name="receiver_phone" type="tel" inputMode="tel" className={input} />
                </label>
              </div>
              <SignaturePad ref={sigRef} label={requireSignature ? 'Receiver signature (required)' : 'Receiver signature'} />
              <label className="block text-xs">
                Seal / signed challan photo{requireSealPhoto ? ' (required)' : ''}
                <input name="seal_photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="mt-1 block w-full text-xs" />
              </label>
              <label className="block text-xs">
                Note
                <input name="note" className={input} placeholder="Optional" />
              </label>
            </>
          ) : (
            <label className="block text-xs">
              Photo of the boxes (optional)
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="mt-1 block w-full text-xs" />
            </label>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={`${btn} bg-[#806A50] text-white`}>
              {pending ? 'Saving…' : isDelivery ? 'Confirm delivery' : 'Confirm count'}
            </button>
            <button type="button" disabled={pending} className={`${btn} border border-[#D8CFC2]`} onClick={() => setMode('idle')}>Back</button>
          </div>
        </form>
      )}
    </article>
  )
}
